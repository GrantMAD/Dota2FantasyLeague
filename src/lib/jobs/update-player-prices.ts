import { createClient } from '@supabase/supabase-js';

interface PriceUpdateResult {
  success: boolean;
  playersProcessed: number;
  pricesUpdated: number;
  errors: string[];
  duration: number;
}

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

class UpdatePlayerPrices {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getRecentFormDelta(_playerId: number, _seasonId: number): number {
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getOwnershipFactor(_playerId: number, _seasonId: number): number {
    return 0;
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
      // Resolve active season once
      const { data: seasonData } = await (this.supabase.from('seasons') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      const seasonId = Number((seasonData as any)?.id ?? 1); // eslint-disable-line @typescript-eslint/no-explicit-any

      // Resolve latest closed gameweek once
      const { data: gwData } = await (this.supabase.from('gameweeks') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select('id')
        .eq('status', 'closed')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      const gameweekId = Number((gwData as any)?.id ?? 1); // eslint-disable-line @typescript-eslint/no-explicit-any

      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        // Fetch one page of players ordered by id so pagination is stable
        const { data: playerData, error: playersError } = await (this.supabase // eslint-disable-line @typescript-eslint/no-explicit-any
          .from('professional_players') as any)
          .select('id')
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (playersError) {
          result.errors.push(`Failed to fetch players at offset ${offset}: ${playersError.message}`);
          break;
        }

        const players = (Array.isArray(playerData) ? playerData : []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (players.length === 0) {
          hasMore = false;
          break;
        }

        const playerIds = players.map((p: any) => Number(p.id)); // eslint-disable-line @typescript-eslint/no-explicit-any

        // Bulk-fetch latest prices for this batch — one query instead of N individual lookups
        const { data: priceRows } = await (this.supabase.from('player_prices') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .select('player_id, price, gameweek_id')
          .eq('season_id', seasonId)
          .in('player_id', playerIds)
          .order('gameweek_id', { ascending: false });

        // Map of playerId -> latest price (first entry per player since ordered desc)
        const priceMap = new Map<number, number>();
        for (const row of priceRows ?? []) {
          const pid = Number(row.player_id);
          if (!priceMap.has(pid)) priceMap.set(pid, Number(row.price ?? 5.0));
        }

        // Build bulk upsert payload for this batch
        const upsertRows: object[] = [];
        for (const player of players) {
          try {
            const playerId = Number((player as any).id); // eslint-disable-line @typescript-eslint/no-explicit-any
            const currentPrice = priceMap.get(playerId) ?? 5.0;
            const recentFormDelta = this.getRecentFormDelta(playerId, seasonId);
            const ownershipFactor = this.getOwnershipFactor(playerId, seasonId);
            const nextPrice = calculateDynamicPriceChange(currentPrice, recentFormDelta, ownershipFactor, 0.5);

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result.errors.push(`Error building price for player ${(player as any).id}: ${(err as Error).message}`);
          }
        }

        // Bulk upsert the entire batch in one query instead of N individual upserts
        if (upsertRows.length > 0) {
          const { error: upsertError } = await (this.supabase.from('player_prices') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
            .upsert(upsertRows, { onConflict: 'season_id,player_id,gameweek_id' });

          if (upsertError) {
            result.errors.push(`Bulk upsert failed at offset ${offset}: ${upsertError.message}`);
          } else {
            result.pricesUpdated += upsertRows.length;
            // Also keep professional_players.current_price in sync for fast direct indexing
            const playerPriceUpdates = (upsertRows as Array<{ player_id: number; price: number }>).map((row) =>
              (this.supabase.from('professional_players') as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                .update({ current_price: row.price })
                .eq('id', row.player_id)
            );
            await Promise.allSettled(playerPriceUpdates);
          }
        }

        offset += PAGE_SIZE;
        // Fewer rows than PAGE_SIZE means we have reached the last page
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
