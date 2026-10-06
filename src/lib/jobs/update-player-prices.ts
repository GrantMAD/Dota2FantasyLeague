import { createClient } from '@supabase/supabase-js';

interface PriceUpdateResult {
  success: boolean;
  playersProcessed: number;
  pricesUpdated: number;
  errors: string[];
  duration: number;
}

/**
 * Calculates the new price once for a completed gameweek.
 *
 * Formula:
 *   movement = (gameweekFantasyPoints × 0.02) + (ownershipFactor × 0.1)
 *   newPrice  = currentPrice + clamp(movement, -maxWeeklyMove, +maxWeeklyMove)
 *
 * @param currentPrice    - Player's current price in millions (e.g. 5.0 = $5M)
 * @param gameweekFantasyPoints - Sum of the player's fantasy points in the latest closed gameweek.
 * @param ownershipFactor - Fraction of active squads owning this player (0.0 – 1.0).
 *                          Ownership adds a smaller demand signal, up to +$0.10M.
 * @param maxWeeklyMove   - Maximum price movement allowed per gameweek (in millions).
 */
export function calculateDynamicPriceChange(
  currentPrice: number,
  gameweekFantasyPoints: number,
  ownershipFactor: number,
  maxWeeklyMove: number,
): number {
  const movement = gameweekFantasyPoints * 0.02 + ownershipFactor * 0.1;
  const bounded = Math.max(-maxWeeklyMove, Math.min(maxWeeklyMove, movement));
  return Number((currentPrice + bounded).toFixed(2));
}

interface GameweekPointsRow {
  player_id: number;
  fantasy_points_breakdown:
    | { total_points: number | null }
    | { total_points: number | null }[]
    | null;
}

interface PlayerPriceRow {
  player_id: number;
  gameweek_id: number;
  price: number;
  price_change: number | null;
}

interface ProfessionalPlayerPriceRow {
  id: number;
  current_price: number | null;
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

  private async buildGameweekPointsMap(
    playerIds: number[],
    gameweekId: number,
  ): Promise<Map<number, number>> {
    const pointsMap = new Map<number, number>();
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await this.supabase.from('player_performances')
        .select('player_id, fantasy_points_breakdown(total_points)')
        .eq('gameweek_id', gameweekId)
        .in('player_id', playerIds)
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(`Failed to fetch fantasy points for gameweek ${gameweekId}: ${error.message}`);
      }

      const rows = (data ?? []) as GameweekPointsRow[];
      for (const row of rows) {
        const breakdown = Array.isArray(row.fantasy_points_breakdown)
          ? row.fantasy_points_breakdown[0]
          : row.fantasy_points_breakdown;
        const points = Number(breakdown?.total_points ?? 0);
        pointsMap.set(row.player_id, (pointsMap.get(row.player_id) ?? 0) + points);
      }

      if (rows.length < pageSize) break;
      offset += pageSize;
    }

    return pointsMap;
  }

  /**
   * Builds a map of playerId → ownershipFactor (0.0 – 1.0) for the given
   * batch by counting active squad memberships relative to all active squads
   * in the season.
   *
   * A player owned by 40% of managers → ownershipFactor = 0.40.
   * This adds a modest demand signal to the fantasy-points movement.
   *
   * Uses a two-step query to avoid PostgREST's single-level relation filter
   * limitation — we first resolve fantasy_season IDs then query squad members.
   */
  private async buildOwnershipMap(
    playerIds: number[],
    fantasySeasonIds: number[],
    totalActiveSquads: number,
  ): Promise<Map<number, number>> {
    const ownershipMap = new Map<number, number>();
    if (playerIds.length === 0 || totalActiveSquads === 0 || fantasySeasonIds.length === 0) return ownershipMap;

    // Step 1: Resolve squad IDs that belong to this season (via fantasy_season_ids)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: squadRows, error: squadsError } = await (this.supabase.from('fantasy_squads') as any)
      .select('id')
      .in('fantasy_season_id', fantasySeasonIds);
    if (squadsError) throw new Error(`Failed to fetch season squads for ownership: ${squadsError.message}`);

    const squadIds: number[] = (squadRows ?? []).map((r: { id: number }) => Number(r.id));
    if (squadIds.length === 0) return ownershipMap;

    // Step 2: Count active memberships for this batch of players within those squads
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ownershipRows, error } = await (this.supabase.from('fantasy_squad_members') as any)
      .select('player_id')
      .in('player_id', playerIds)
      .in('squad_id', squadIds)
      .is('removed_date', null);

    if (error) throw new Error(`Failed to fetch player ownership: ${error.message}`);

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

  private async buildBasePriceMap(
    playerIds: number[],
    seasonId: number,
    gameweekId: number,
  ): Promise<Map<number, number>> {
    const currentGameweekResult = await this.supabase.from('player_prices')
      .select('player_id, gameweek_id, price, price_change')
      .eq('season_id', seasonId)
      .eq('gameweek_id', gameweekId)
      .in('player_id', playerIds);
    if (currentGameweekResult.error) {
      throw new Error(`Failed to fetch existing gameweek prices: ${currentGameweekResult.error.message}`);
    }

    const currentGameweekPrices = new Map<number, PlayerPriceRow>(
      (currentGameweekResult.data ?? []).map((row: PlayerPriceRow) => [row.player_id, row]),
    );
    const previousPrices = new Map<number, number>();
    const pageSize = 1000;
    let offset = 0;

    while (previousPrices.size < playerIds.length) {
      const { data, error } = await this.supabase.from('player_prices')
        .select('player_id, gameweek_id, price')
        .eq('season_id', seasonId)
        .in('player_id', playerIds)
        .lt('gameweek_id', gameweekId)
        .order('gameweek_id', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw new Error(`Failed to fetch previous gameweek prices: ${error.message}`);

      const rows = (data ?? []) as Array<{ player_id: number; price: number }>;
      for (const row of rows) {
        if (!previousPrices.has(row.player_id)) previousPrices.set(row.player_id, Number(row.price));
      }

      if (rows.length < pageSize) break;
      offset += pageSize;
    }

    const basePrices = new Map(previousPrices);
    for (const [playerId, row] of currentGameweekPrices) {
      if (basePrices.has(playerId)) continue;
      basePrices.set(playerId, Number(row.price) - Number(row.price_change ?? 0));
    }

    return basePrices;
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
      const { data: seasonData, error: seasonError } = await (this.supabase.from('seasons') as any)
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (seasonError) throw new Error(`Failed to resolve active season: ${seasonError.message}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seasonId = Number((seasonData as any)?.id);
      if (!Number.isInteger(seasonId)) throw new Error('No season is available for player pricing.');

      // -----------------------------------------------------------------------
      // 2. Resolve the latest closed gameweek. Prices are updated once per
      //    gameweek; repeat runs always recalculate from that week's base price.
      // -----------------------------------------------------------------------
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: closedGameweek, error: gameweekError } = await (this.supabase.from('gameweeks') as any)
        .select('id')
        .eq('season_id', seasonId)
        .eq('status', 'closed')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (gameweekError) throw new Error(`Failed to resolve latest closed gameweek: ${gameweekError.message}`);
      if (!closedGameweek) {
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }
      const gameweekId = Number(closedGameweek.id);

      // -----------------------------------------------------------------------
      // 3. Resolve all fantasy_season IDs for this season, then count squads.
      //    Two-step approach avoids PostgREST's single-level relation filter
      //    limitation. Results are reused across all player batches.
      // -----------------------------------------------------------------------
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fantasySeasonRows, error: fantasySeasonsError } = await (this.supabase.from('fantasy_seasons') as any)
        .select('id')
        .eq('season_id', seasonId);
      if (fantasySeasonsError) {
        throw new Error(`Failed to fetch fantasy seasons for ownership: ${fantasySeasonsError.message}`);
      }

      const fantasySeasonIds: number[] = (fantasySeasonRows ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => Number(r.id),
      );

      // Count total active squads (one squad per fantasy_season)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: totalSquadsCount, error: squadCountError } = await (this.supabase.from('fantasy_squads') as any)
        .select('id', { count: 'exact', head: true })
        .in('fantasy_season_id', fantasySeasonIds.length > 0 ? fantasySeasonIds : [-1]);
      if (squadCountError) throw new Error(`Failed to count season squads: ${squadCountError.message}`);

      const totalActiveSquads = Number(totalSquadsCount ?? 0);

      // -----------------------------------------------------------------------
      // 4. Paginate through available players
      // -----------------------------------------------------------------------
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: playerData, error: playersError } = await this.supabase
          .from('professional_players')
          .select('id, current_price')
          .eq('availability_status', 'available')
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (playersError) {
          throw new Error(`Failed to fetch players at offset ${offset}: ${playersError.message}`);
        }

        const players = (Array.isArray(playerData) ? playerData : []) as ProfessionalPlayerPriceRow[];
        if (players.length === 0) {
          hasMore = false;
          break;
        }

        const playerIds = players.map((player) => Number(player.id));

        // -------------------------------------------------------------------
        // 5. Build gameweek fantasy points, ownership, and stable base prices.
        // -------------------------------------------------------------------
        const [gameweekPointsMap, ownershipMap, basePriceMap] = await Promise.all([
          this.buildGameweekPointsMap(playerIds, gameweekId),
          this.buildOwnershipMap(playerIds, fantasySeasonIds, totalActiveSquads),
          this.buildBasePriceMap(playerIds, seasonId, gameweekId),
        ]);

        // -------------------------------------------------------------------
        // 6. Build idempotent price updates using this game's base price.
        // -------------------------------------------------------------------
        const upsertRows: Array<{
          season_id: number;
          player_id: number;
          gameweek_id: number;
          price: number;
          price_change: number;
          ownership_percentage: number;
        }> = [];
        for (const player of players) {
          const playerId = Number((player as { id: number }).id);
          const currentPrice = basePriceMap.get(playerId)
            ?? Number((player as { current_price: number | null }).current_price ?? 5.0);
          const gameweekFantasyPoints = gameweekPointsMap.get(playerId) ?? 0;
          const ownershipFactor = ownershipMap.get(playerId) ?? 0;
          const nextPrice = calculateDynamicPriceChange(
            currentPrice,
            gameweekFantasyPoints,
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
        }

        // -------------------------------------------------------------------
        // 8. Bulk upsert + sync current_price on professional_players
        // -------------------------------------------------------------------
        if (upsertRows.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: upsertError } = await (this.supabase.from('player_prices') as any)
            .upsert(upsertRows, { onConflict: 'season_id,player_id,gameweek_id' });

          if (upsertError) {
            throw new Error(`Bulk upsert failed at offset ${offset}: ${upsertError.message}`);
          }
          result.pricesUpdated += upsertRows.length;
          const playerPriceUpdates = await Promise.all(upsertRows.map((row) =>
            // The generated Supabase client types this update payload as `never`.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.supabase.from('professional_players') as any)
              .update({ current_price: row.price })
              .eq('id', row.player_id),
          ));
          const failedPlayerUpdate = playerPriceUpdates.find((update) => update.error);
          if (failedPlayerUpdate) {
            throw new Error(`Failed to sync a player's current price: ${failedPlayerUpdate.error.message}`);
          }
        }

        offset += PAGE_SIZE;
        if (players.length < PAGE_SIZE) hasMore = false;
      }

      result.success = result.errors.length === 0;
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
