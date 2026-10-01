import { createClient } from '@supabase/supabase-js';

interface JobResult {
  success: boolean;
  managersRanked: number;
  ownershipRecordsUpdated: number;
  errors: string[];
  duration: number;
}

interface FantasySeasonPointsRow {
  id: number;
  total_points: number;
}

interface GameweekIdRow {
  id: number;
}

interface SquadMemberPlayerRow {
  player_id: number;
}

interface SeasonIdRow {
  id: number;
}

interface FilteredMutationQuery extends PromiseLike<unknown> {
  eq(column: string, value: number): FilteredMutationQuery;
}

interface FilteredMutationTable<TValues> {
  update(values: TValues): FilteredMutationQuery;
}

interface UpsertTable<TValues> {
  upsert(values: TValues, options: { onConflict: string }): PromiseLike<unknown>;
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
        .order('total_points', { ascending: false });

      if (fetchError || !fantasySeasons) {
        console.error('Failed to fetch fantasy seasons:', fetchError);
        return 0;
      }

      let rank = 1;
      let prevPoints: number | null = null;
      let tieCount = 0;
      let ranked = 0;

      // Find the latest closed gameweek for the snapshot
      const { data: latestGameweekData } = await this.supabase
        .from('gameweeks')
        .select('id')
        .eq('season_id', seasonId)
        .eq('status', 'closed')
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      const latestGameweek = latestGameweekData as GameweekIdRow | null;

      for (const fs of fantasySeasons as FantasySeasonPointsRow[]) {
        // Handle ties
        if (fs.total_points === prevPoints) {
          tieCount++;
        } else {
          rank += tieCount;
          tieCount = 1;
          prevPoints = fs.total_points;
        }

        // Update fantasy_seasons table
        const seasonUpdates = this.supabase.from('fantasy_seasons') as unknown as FilteredMutationTable<{ global_rank: number }>;
        await seasonUpdates.update({ global_rank: rank })
          .eq('id', fs.id);

        // Create snapshot in season_standings
        if (latestGameweek) {
          const { data: latestLineupData } = await this.supabase
            .from('fantasy_lineups')
            .select('total_points')
            .eq('fantasy_season_id', fs.id)
            .eq('gameweek_id', latestGameweek.id)
            .maybeSingle();
          const latestLineup = latestLineupData as { total_points: number | null } | null;

          const standingUpsert = this.supabase.from('season_standings') as unknown as UpsertTable<{
            fantasy_season_id: number;
            gameweek_id: number;
            rank: number;
            total_points: number;
            gameweek_points: number;
            league_id: null;
          }>;
          await standingUpsert.upsert({
              fantasy_season_id: fs.id,
              gameweek_id: latestGameweek.id,
              rank: rank,
              total_points: fs.total_points,
              gameweek_points: latestLineup?.total_points ?? 0,
              league_id: null // Global standing
            }, { onConflict: 'fantasy_season_id,gameweek_id' });
        }

        ranked++;
      }

      return ranked;
    } catch (error: unknown) {
      console.error('Error calculating global rankings:', error);
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
         .is('removed_date', null);

       if (membersError || !squadMembers) {
         return 0;
       }

       const playerCounts: Record<number, number> = {};
      for (const member of squadMembers as SquadMemberPlayerRow[]) {
         playerCounts[member.player_id] = (playerCounts[member.player_id] || 0) + 1;
       }

       let updated = 0;

       // Find current gameweek
      const { data: currentGameweekData } = await this.supabase
        .from('gameweeks')
        .select('id')
        .eq('season_id', seasonId)
        .eq('status', 'active')
        .single();
             const currentGameweek = currentGameweekData as GameweekIdRow | null;

       if (!currentGameweek) return 0;

       // Update player_prices with ownership %
       for (const [playerIdStr, count] of Object.entries(playerCounts)) {
         const playerId = parseInt(playerIdStr, 10);
         const ownershipPercentage = Math.round((count / totalSquads) * 10000) / 100; // e.g., 25.45%

         // We assume player_prices row for current gameweek already exists from update-player-prices job
         // If not, we might need to upsert.
         await this.supabase
           .from('player_prices')
         const priceUpdate = this.supabase.from('player_prices') as unknown as FilteredMutationTable<{ ownership_percentage: number }>;
         await priceUpdate.update({ ownership_percentage: ownershipPercentage })
           .eq('player_id', playerId)
           .eq('gameweek_id', currentGameweek.id);
         
         updated++;
       }

       // What about players with 0 ownership?
       // We could zero them out or leave as default.
       
       return updated;
     } catch (error: unknown) {
       console.error('Error calculating ownership:', error);
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
      const { data: seasonData } = await this.supabase
        .from('seasons')
        .select('id')
        .eq('status', 'active')
        .single();
      const season = seasonData as SeasonIdRow | null;
      
      if (!season) {
         result.errors.push('No active season found');
         result.duration = Date.now() - startTime;
         return result;
      }

      result.managersRanked = await this.calculateGlobalRankings(season.id);
      result.ownershipRecordsUpdated = await this.calculateOwnership(season.id);

      result.success = true;
    } catch (error: unknown) {
      result.errors.push(`Fatal error in global rankings job: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Global rankings job failed:', error);
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
