import { createClient } from '@supabase/supabase-js';

interface JobResult {
  success: boolean;
  managersRanked: number;
  ownershipRecordsUpdated: number;
  errors: string[];
  duration: number;
}

class CalculateGlobalRankings {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  /**
   * Calculate global rankings for all fantasy seasons and snapshot them
   */
  private async calculateGlobalRankings(seasonId: number): Promise<number> {
    try {
      // Fetch all fantasy seasons for the current season, ordered by points
      const { data: fantasySeasons, error: fetchError } = await this.supabase
        .from('fantasy_seasons')
        .select('id, total_points')
        .eq('season_id', seasonId)
        .order('total_points', { ascending: false }) as any;

      if (fetchError || !fantasySeasons) {
        console.error('Failed to fetch fantasy seasons:', fetchError);
        return 0;
      }

      let rank = 1;
      let prevPoints: number | null = null;
      let tieCount = 0;
      let ranked = 0;

      // Find the latest closed gameweek for the snapshot
      const { data: latestGameweek } = await this.supabase
        .from('gameweeks')
        .select('id')
        .eq('season_id', seasonId)
        .eq('status', 'closed')
        .order('end_time', { ascending: false })
        .limit(1)
        .single() as any;

      for (const fs of fantasySeasons) {
        // Handle ties
        if (fs.total_points === prevPoints) {
          tieCount++;
        } else {
          rank += tieCount;
          tieCount = 1;
          prevPoints = fs.total_points;
        }

        // Update fantasy_seasons table
        await (this.supabase
          .from('fantasy_seasons') as any)
          .update({ global_rank: rank })
          .eq('id', fs.id);

        // Create snapshot in season_standings
        if (latestGameweek) {
           await (this.supabase
            .from('season_standings') as any)
            .upsert({
              fantasy_season_id: fs.id,
              gameweek_id: latestGameweek.id,
              rank: rank,
              total_points: fs.total_points,
              league_id: null // Global standing
            }, { onConflict: 'fantasy_season_id,gameweek_id' });
        }

        ranked++;
      }

      return ranked;
    } catch (err: any) {
      console.error('Error calculating global rankings:', err);
      return 0;
    }
  }

  /**
   * Calculate ownership percentage for all players
   */
  private async calculateOwnership(seasonId: number): Promise<number> {
    try {
       // Get total number of active fantasy squads
       const { count: totalSquads, error: squadCountError } = await this.supabase
         .from('fantasy_squads')
         .select('id', { count: 'exact', head: true });

       if (squadCountError || totalSquads === null || totalSquads === 0) {
         return 0;
       }

       // Get count of how many squads each player is in
       // We can use an RPC call or group by if possible, but let's do a grouped query
       // Supabase doesn't natively support grouped aggregates well in the JS client without RPC,
       // so we might have to fetch all members or use an RPC.
       // For simplicity, we'll fetch all active squad members and count in memory if it's small,
       // or we'd ideally use a DB view or RPC. Assuming moderate size:
       
       const { data: squadMembers, error: membersError } = await this.supabase
         .from('fantasy_squad_members')
         .select('player_id')
         .is('removed_date', null) as any;

       if (membersError || !squadMembers) {
         return 0;
       }

       const playerCounts: Record<number, number> = {};
       for (const member of squadMembers) {
         playerCounts[member.player_id] = (playerCounts[member.player_id] || 0) + 1;
       }

       let updated = 0;

       // Find current gameweek
       const { data: currentGameweek } = await this.supabase
        .from('gameweeks')
        .select('id')
        .eq('season_id', seasonId)
        .eq('status', 'active')
        .single() as any;

       if (!currentGameweek) return 0;

       // Update player_prices with ownership %
       for (const [playerIdStr, count] of Object.entries(playerCounts)) {
         const playerId = parseInt(playerIdStr, 10);
         const ownershipPercentage = Math.round((count / totalSquads) * 10000) / 100; // e.g., 25.45%

         // We assume player_prices row for current gameweek already exists from update-player-prices job
         // If not, we might need to upsert.
         await (this.supabase
           .from('player_prices') as any)
           .update({ ownership_percentage: ownershipPercentage })
           .eq('player_id', playerId)
           .eq('gameweek_id', currentGameweek.id);
         
         updated++;
       }

       // What about players with 0 ownership?
       // We could zero them out or leave as default.
       
       return updated;
    } catch (err: any) {
       console.error('Error calculating ownership:', err);
       return 0;
    }
  }


  async execute(): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: false,
      managersRanked: 0,
      ownershipRecordsUpdated: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Get active season
      const { data: season } = await this.supabase
        .from('seasons')
        .select('id')
        .eq('status', 'active')
        .single() as any;
      
      if (!season) {
         result.errors.push('No active season found');
         result.duration = Date.now() - startTime;
         return result;
      }

      result.managersRanked = await this.calculateGlobalRankings(season.id);
      result.ownershipRecordsUpdated = await this.calculateOwnership(season.id);

      result.success = true;
    } catch (err: any) {
      result.errors.push(`Fatal error in global rankings job: ${err.message}`);
      console.error('Global rankings job failed:', err);
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function calculateGlobalRankings(): Promise<JobResult> {
  const job = new CalculateGlobalRankings();
  return job.execute();
}

export default calculateGlobalRankings;
