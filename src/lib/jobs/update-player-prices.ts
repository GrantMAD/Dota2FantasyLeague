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

    try {
      // professional_players has no price or season_id column — prices live in player_prices
      const { data: playerData, error: playersError } = await this.supabase
        .from('professional_players')
        .select('id')
        .limit(500) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      if (playersError) {
        result.errors.push(`Failed to fetch players: ${playersError.message}`);
        result.duration = Date.now() - startTime;
        return result;
      }

      const players = (Array.isArray(playerData) ? playerData : []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

      // Resolve active season
      const { data: seasonData } = await (this.supabase.from('seasons') as any)
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      const seasonId = Number((seasonData as any)?.id ?? 1); // eslint-disable-line @typescript-eslint/no-explicit-any

      // Resolve latest closed gameweek
      const { data: gwData } = await (this.supabase.from('gameweeks') as any)
        .select('id')
        .eq('status', 'closed')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      const gameweekId = Number((gwData as any)?.id ?? 1); // eslint-disable-line @typescript-eslint/no-explicit-any

      for (const player of players) {
        try {
          const playerId = Number((player as any).id); // eslint-disable-line @typescript-eslint/no-explicit-any

          // Look up latest price from player_prices; default to 5.0 if no history
          const { data: priceRow } = await (this.supabase.from('player_prices') as any)
            .select('price')
            .eq('player_id', playerId)
            .order('gameweek_id', { ascending: false })
            .limit(1)
            .maybeSingle();
          const currentPrice = Number((priceRow as any)?.price ?? 5.0); // eslint-disable-line @typescript-eslint/no-explicit-any

          const recentFormDelta = this.getRecentFormDelta(playerId, seasonId);
          const ownershipFactor = this.getOwnershipFactor(playerId, seasonId);
          const nextPrice = calculateDynamicPriceChange(currentPrice, recentFormDelta, ownershipFactor, 0.5);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: insertError } = await (this.supabase.from('player_prices') as any).upsert(
            {
              season_id: seasonId,
              player_id: playerId,
              gameweek_id: gameweekId,
              price: nextPrice,
              price_change: Number((nextPrice - currentPrice).toFixed(2)),
              ownership_percentage: Math.max(0, Math.min(100, ownershipFactor * 100)),
            },
            { onConflict: 'season_id,player_id,gameweek_id' },
          );

          if (insertError) {
            result.errors.push(`Failed to update price for player ${playerId}: ${insertError.message}`);
            continue;
          }

          result.playersProcessed++;
          result.pricesUpdated++;
        } catch (err: unknown) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result.errors.push(`Error processing player ${(player as any).id}: ${(err as Error).message}`);
        }
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
