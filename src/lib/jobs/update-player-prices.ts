import { createClient } from '@supabase/supabase-js';

interface PriceUpdateResult {
  success: boolean;
  playersProcessed: number;
  pricesUpdated: number;
  errors: string[];
  duration: number;
}

/**
 * Calculates the new price for a player after applying dynamic market movement.
 *
 * Formula:
 *   movement = (recentFormDelta × 0.1) + (ownershipFactor × 0.5)
 *   newPrice  = currentPrice + clamp(movement, -maxWeeklyMove, +maxWeeklyMove)
 *
 * @param currentPrice    - Player's current price in millions (e.g. 5.0 = $5M)
 * @param recentFormDelta - Difference between avg score in last 2 GWs vs prior 2 GWs.
 *                          Positive = improving form, negative = declining form.
 * @param ownershipFactor - Fraction of active squads owning this player (0.0 – 1.0).
 *                          High ownership → price rises; low ownership → price falls.
 * @param maxWeeklyMove   - Maximum price movement allowed per update cycle (in millions).
 */
export function calculateDynamicPriceChange(
  currentPrice: number,
  recentFormDelta: number,
  ownershipFactor: number,
  maxWeeklyMove: number,
): number {
  const movement = recentFormDelta * 0.1 + ownershipFactor * 0.5;
  const bounded = Math.max(-maxWeeklyMove, Math.min(maxWeeklyMove, movement));
  return Number((currentPrice + bounded).toFixed(2));
}

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

interface PerformanceRow {
  player_id: number;
  gameweek_id: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_minute: number;
}

// ---------------------------------------------------------------------------
// Core score function — maps a raw performance row to a single numeric value.
// Deliberately simple: kills/assists reward output, deaths penalise it,
// GPM rewards economic efficiency (normalised to the same magnitude as K/A/D).
// ---------------------------------------------------------------------------
function scorePerformance(row: PerformanceRow): number {
  return row.kills + row.assists - row.deaths + row.gold_per_minute / 100;
}

// ---------------------------------------------------------------------------
// Main job class
// ---------------------------------------------------------------------------

class UpdatePlayerPrices {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  /**
   * Bulk-fetches player_performances for up to the last 4 closed gameweeks
   * for a given batch of player IDs, then returns a map of:
   *   playerId → recentFormDelta
   *
   * "Recent form delta" = avg score across the 2 most recent GWs
   *                       minus avg score across the 2 GWs before that.
   * A positive delta means the player is in better form than previously.
   *
   * Players with fewer than 1 performance in either window return delta = 0
   * (neutral — price unchanged from form signal).
   */
  private async buildFormDeltaMap(
    playerIds: number[],
    recentGameweekIds: number[], // ordered newest → oldest, up to 4
  ): Promise<Map<number, number>> {
    const formMap = new Map<number, number>();
    if (playerIds.length === 0 || recentGameweekIds.length === 0) return formMap;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: perfRows, error } = await (this.supabase.from('player_performances') as any)
      .select('player_id, gameweek_id, kills, deaths, assists, gold_per_minute')
      .in('player_id', playerIds)
      .in('gameweek_id', recentGameweekIds);

    if (error || !perfRows) return formMap;

    // Group performances by player, then by gameweek
    const byPlayer = new Map<number, Map<number, number[]>>();
    for (const row of perfRows as PerformanceRow[]) {
      const pid = Number(row.player_id);
      const gwid = Number(row.gameweek_id);
      if (!byPlayer.has(pid)) byPlayer.set(pid, new Map());
      const gwMap = byPlayer.get(pid)!;
      if (!gwMap.has(gwid)) gwMap.set(gwid, []);
      gwMap.get(gwid)!.push(scorePerformance(row));
    }

    // recentGameweekIds is ordered newest → oldest
    const recentWindow = recentGameweekIds.slice(0, 2);  // last 2 GWs
    const priorWindow  = recentGameweekIds.slice(2, 4);  // 2 GWs before that

    for (const [pid, gwMap] of byPlayer.entries()) {
      const avg = (gwIds: number[]): number | null => {
        const scores: number[] = [];
        for (const gwid of gwIds) {
          const vals = gwMap.get(gwid);
          if (vals && vals.length > 0) {
            scores.push(vals.reduce((a, b) => a + b, 0) / vals.length);
          }
        }
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      };

      const recentAvg = avg(recentWindow);
      const priorAvg  = avg(priorWindow);

      if (recentAvg !== null && priorAvg !== null) {
        formMap.set(pid, recentAvg - priorAvg);
      } else if (recentAvg !== null) {
        // Only recent data available — treat prior as 0 (assume average baseline)
        formMap.set(pid, recentAvg);
      }
      // If no data at all, leave out of map → will default to 0 in execute()
    }

    return formMap;
  }

  /**
   * Builds a map of playerId → ownershipFactor (0.0 – 1.0) for the given
   * batch by counting active squad memberships relative to all active squads
   * in the season.
   *
   * A player owned by 40% of managers → ownershipFactor = 0.40
   * This drives an upward price signal proportional to demand.
   *
   * Uses a two-step query to avoid PostgREST's single-level relation filter
   * limitation — we first resolve fantasy_season IDs then query squad members.
   */
  private async buildOwnershipMap(
    playerIds: number[],
    seasonId: number,
    fantasySeasonIds: number[],
    totalActiveSquads: number,
  ): Promise<Map<number, number>> {
    const ownershipMap = new Map<number, number>();
    if (playerIds.length === 0 || totalActiveSquads === 0 || fantasySeasonIds.length === 0) return ownershipMap;

    // Step 1: Resolve squad IDs that belong to this season (via fantasy_season_ids)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: squadRows } = await (this.supabase.from('fantasy_squads') as any)
      .select('id')
      .in('fantasy_season_id', fantasySeasonIds);

    const squadIds: number[] = (squadRows ?? []).map((r: { id: number }) => Number(r.id));
    if (squadIds.length === 0) return ownershipMap;

    // Step 2: Count active memberships for this batch of players within those squads
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ownershipRows, error } = await (this.supabase.from('fantasy_squad_members') as any)
      .select('player_id')
      .in('player_id', playerIds)
      .in('squad_id', squadIds)
      .is('removed_date', null);

    if (error || !ownershipRows) return ownershipMap;

    // Count occurrences per player
    const countMap = new Map<number, number>();
    for (const row of ownershipRows as Array<{ player_id: number }>) {
      const pid = Number(row.player_id);
      countMap.set(pid, (countMap.get(pid) ?? 0) + 1);
    }

    for (const [pid, count] of countMap.entries()) {
      ownershipMap.set(pid, Math.min(1, count / totalActiveSquads));
    }

    return ownershipMap;
  }

  async execute(): Promise<PriceUpdateResult> {
    const startTime = Date.now();
    const result: PriceUpdateResult = {
      success: false,
      playersProcessed: 0,
      pricesUpdated: 0,
      errors: [],
      duration: 0,
    };

    const PAGE_SIZE = 500;

    try {
      // -----------------------------------------------------------------------
      // 1. Resolve active season
      // -----------------------------------------------------------------------
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: seasonData } = await (this.supabase.from('seasons') as any)
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seasonId = Number((seasonData as any)?.id ?? 1);

      // -----------------------------------------------------------------------
      // 2. Resolve the last 4 closed gameweeks (for form calculation)
      // -----------------------------------------------------------------------
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: closedGwData } = await (this.supabase.from('gameweeks') as any)
        .select('id')
        .eq('season_id', seasonId)
        .eq('status', 'closed')
        .order('id', { ascending: false })
        .limit(4);

      const recentGameweekIds: number[] = (closedGwData ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => Number(r.id),
      );

      // The gameweek we write prices into = the most recently closed one
      const gameweekId = recentGameweekIds[0] ?? 1;

      // -----------------------------------------------------------------------
      // 3. Resolve all fantasy_season IDs for this season, then count squads.
      //    Two-step approach avoids PostgREST's single-level relation filter
      //    limitation. Results are reused across all player batches.
      // -----------------------------------------------------------------------
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fantasySeasonRows } = await (this.supabase.from('fantasy_seasons') as any)
        .select('id')
        .eq('season_id', seasonId);

      const fantasySeasonIds: number[] = (fantasySeasonRows ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => Number(r.id),
      );

      // Count total active squads (one squad per fantasy_season)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: totalSquadsCount } = await (this.supabase.from('fantasy_squads') as any)
        .select('id', { count: 'exact', head: true })
        .in('fantasy_season_id', fantasySeasonIds.length > 0 ? fantasySeasonIds : [-1]);

      const totalActiveSquads = Number(totalSquadsCount ?? 0);

      // -----------------------------------------------------------------------
      // 4. Paginate through available players
      // -----------------------------------------------------------------------
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: playerData, error: playersError } = await this.supabase
          .from('professional_players')
          .select('id')
          .eq('availability_status', 'available')
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (playersError) {
          result.errors.push(`Failed to fetch players at offset ${offset}: ${playersError.message}`);
          break;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const players = (Array.isArray(playerData) ? playerData : []) as any[];
        if (players.length === 0) {
          hasMore = false;
          break;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const playerIds = players.map((p: any) => Number(p.id));

        // -------------------------------------------------------------------
        // 5. Bulk-fetch current prices for this batch
        // -------------------------------------------------------------------
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: priceRows } = await (this.supabase.from('player_prices') as any)
          .select('player_id, price, gameweek_id')
          .eq('season_id', seasonId)
          .in('player_id', playerIds)
          .order('gameweek_id', { ascending: false });

        const priceMap = new Map<number, number>();
        for (const row of priceRows ?? []) {
          const pid = Number(row.player_id);
          if (!priceMap.has(pid)) priceMap.set(pid, Number(row.price ?? 5.0));
        }

        // -------------------------------------------------------------------
        // 6. Bulk-build form delta and ownership maps for this batch
        // -------------------------------------------------------------------
        const [formDeltaMap, ownershipMap] = await Promise.all([
          this.buildFormDeltaMap(playerIds, recentGameweekIds),
          this.buildOwnershipMap(playerIds, seasonId, fantasySeasonIds, totalActiveSquads),
        ]);

        // -------------------------------------------------------------------
        // 7. Build upsert payload
        // -------------------------------------------------------------------
        const upsertRows: object[] = [];
        for (const player of players) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const playerId = Number((player as any).id);
            const currentPrice    = priceMap.get(playerId)    ?? 5.0;
            const recentFormDelta = formDeltaMap.get(playerId) ?? 0;
            const ownershipFactor = ownershipMap.get(playerId) ?? 0;

            const nextPrice = calculateDynamicPriceChange(
              currentPrice,
              recentFormDelta,
              ownershipFactor,
              0.5,
            );

            upsertRows.push({
              season_id: seasonId,
              player_id: playerId,
              gameweek_id: gameweekId,
              price: nextPrice,
              price_change: Number((nextPrice - currentPrice).toFixed(2)),
              ownership_percentage: Math.max(0, Math.min(100, ownershipFactor * 100)),
            });

            result.playersProcessed++;
          } catch (err: unknown) {
            result.errors.push(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              `Error building price for player ${(player as any).id}: ${(err as Error).message}`,
            );
          }
        }

        // -------------------------------------------------------------------
        // 8. Bulk upsert + sync current_price on professional_players
        // -------------------------------------------------------------------
        if (upsertRows.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: upsertError } = await (this.supabase.from('player_prices') as any)
            .upsert(upsertRows, { onConflict: 'season_id,player_id,gameweek_id' });

          if (upsertError) {
            result.errors.push(`Bulk upsert failed at offset ${offset}: ${upsertError.message}`);
          } else {
            result.pricesUpdated += upsertRows.length;
            // Keep professional_players.current_price in sync for fast lookups
            const playerPriceUpdates = (upsertRows as Array<{ player_id: number; price: number }>).map(
              (row) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (this.supabase.from('professional_players') as any)
                  .update({ current_price: row.price })
                  .eq('id', row.player_id),
            );
            await Promise.allSettled(playerPriceUpdates);
          }
        }

        offset += PAGE_SIZE;
        if (players.length < PAGE_SIZE) hasMore = false;
      }

      result.success = true;
    } catch (err: unknown) {
      result.errors.push(`Fatal error in price update job: ${(err as Error).message}`);
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function updatePlayerPrices(): Promise<PriceUpdateResult> {
  const job = new UpdatePlayerPrices();
  return job.execute();
}

export default updatePlayerPrices;
