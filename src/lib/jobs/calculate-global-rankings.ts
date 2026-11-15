import { createClient } from '@supabase/supabase-js';

interface JobResult {
  success: boolean;
  managersRanked: number;
  ownershipRecordsUpdated: number;
  errors: string[];
  duration: number;
  hasMore?: boolean;
}

interface FantasySeasonPointsRow {
  id: number;
  total_points: number;
  global_rank: number | null;
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

interface DatabaseError {
  message: string;
}

interface DatabaseMutationResult {
  error: DatabaseError | null;
}

interface FilteredMutationQuery extends PromiseLike<DatabaseMutationResult> {
  eq(column: string, value: number): FilteredMutationQuery;
}

interface FilteredMutationTable<TValues> {
  update(values: TValues): FilteredMutationQuery;
}

interface UpsertTable<TValues> {
  upsert(values: TValues, options: { onConflict: string }): PromiseLike<DatabaseMutationResult>;
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
  private async calculateGlobalRankings(seasonId: number, seasonLimit?: number): Promise<{ ranked: number; hasMore: boolean }> {
    const { data: fantasySeasons, error: fetchError } = await this.supabase
      .from('fantasy_seasons')
      .select('id, total_points, global_rank')
      .eq('season_id', seasonId)
      .order('total_points', { ascending: false });

    if (fetchError) {
      throw new Error(`Failed to fetch fantasy seasons: ${fetchError.message}`);
    }
    if (!fantasySeasons) throw new Error('Failed to fetch fantasy seasons: no data returned');

    // Apply seasonLimit for chunked execution within Vercel's function duration limit.
    let seasonsToProcess = fantasySeasons as FantasySeasonPointsRow[];
    let hasMore = false;
    if (seasonLimit && fantasySeasons.length > seasonLimit) {
      seasonsToProcess = seasonsToProcess.slice(0, seasonLimit);
      hasMore = true;
      console.log(
        `[calculateGlobalRankings] seasonLimit=${seasonLimit}: processing ${seasonsToProcess.length} of ${fantasySeasons.length} managers`
      );
    }

    let rank = 1;
    let prevPoints: number | null = null;
    let tieCount = 0;
    let ranked = 0;

    const { data: latestGameweekData, error: gameweekError } = await this.supabase
      .from('gameweeks')
      .select('id')
      .eq('season_id', seasonId)
      .eq('status', 'closed')
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (gameweekError) {
      throw new Error(`Failed to fetch the latest closed gameweek: ${gameweekError.message}`);
    }
    const latestGameweek = latestGameweekData as GameweekIdRow | null;

    const lineupPointsBySeason = new Map<number, number>();
    if (latestGameweek) {
      const { data: allLineups, error: lineupError } = await this.supabase
        .from('fantasy_lineups')
        .select('fantasy_season_id, total_points')
        .eq('gameweek_id', latestGameweek.id);
      if (lineupError) {
        throw new Error(`Failed to fetch gameweek points: ${lineupError.message}`);
      }
      for (const l of (allLineups ?? []) as Array<{ fantasy_season_id: number | null; total_points: number | null }>) {
        if (l.fantasy_season_id != null) {
          lineupPointsBySeason.set(l.fantasy_season_id, Number(l.total_points ?? 0));
        }
      }
    }

    const standingsToUpsert: Array<{
      fantasy_season_id: number;
      gameweek_id: number;
      rank: number;
      total_points: number;
      gameweek_points: number;
      league_id: null;
    }> = [];

    for (const fs of seasonsToProcess) {
      if (fs.total_points === prevPoints) {
        tieCount++;
      } else {
        rank += tieCount;
        tieCount = 1;
        prevPoints = fs.total_points;
      }

      const seasonUpdates = this.supabase.from('fantasy_seasons') as unknown as FilteredMutationTable<{
        global_rank: number;
        previous_rank: number | null;
      }>;
      const { error: updateError } = await seasonUpdates
        .update({ global_rank: rank, previous_rank: fs.global_rank })
        .eq('id', fs.id);
      if (updateError) {
        throw new Error(`Failed to update global rank for fantasy season ${fs.id}: ${updateError.message}`);
      }

      if (latestGameweek) {
        standingsToUpsert.push({
          fantasy_season_id: fs.id,
          gameweek_id: latestGameweek.id,
          rank,
          total_points: fs.total_points,
          gameweek_points: lineupPointsBySeason.get(fs.id) ?? 0,
          league_id: null,
        });
      }

      ranked++;
    }

    if (standingsToUpsert.length > 0) {
      const standingUpsert = this.supabase.from('season_standings') as unknown as UpsertTable<typeof standingsToUpsert>;
      const { error: standingError } = await standingUpsert.upsert(
        standingsToUpsert,
        { onConflict: 'fantasy_season_id,gameweek_id' }
      );
      if (standingError) {
        throw new Error(`Failed to save leaderboard snapshot: ${standingError.message}`);
      }
    }

    return { ranked, hasMore };
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
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
             const currentGameweek = currentGameweekData as GameweekIdRow | null;

       if (!currentGameweek) return 0;

       // Update player_prices with ownership % concurrently in batches
       const priceEntries = Object.entries(playerCounts);
       const batchSize = 20;
       for (let i = 0; i < priceEntries.length; i += batchSize) {
         const batch = priceEntries.slice(i, i + batchSize);
         await Promise.all(
           batch.map(async ([playerIdStr, count]) => {
             const playerId = parseInt(playerIdStr, 10);
             const ownershipPercentage = Math.round((count / totalSquads) * 10000) / 100; // e.g., 25.45%
             const priceUpdate = this.supabase.from('player_prices') as unknown as FilteredMutationTable<{ ownership_percentage: number }>;
             await priceUpdate.update({ ownership_percentage: ownershipPercentage })
               .eq('player_id', playerId)
               .eq('gameweek_id', currentGameweek.id);
             updated++;
           })
         );
       }

       // What about players with 0 ownership?
       // We could zero them out or leave as default.
       
       return updated;
     } catch (error: unknown) {
       console.error('Error calculating ownership:', error);
       return 0;
    }
  }


  async execute(options: { seasonLimit?: number } = {}): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: false,
      managersRanked: 0,
      ownershipRecordsUpdated: 0,
      errors: [],
      duration: 0,
      hasMore: false,
    };

    try {
      // Get active season — use maybeSingle + ordering so this works
      // even when multiple seasons are marked active simultaneously.
      const { data: seasonData, error: seasonError } = await this.supabase
        .from('seasons')
        .select('id')
        .eq('status', 'active')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (seasonError) throw new Error(`Failed to fetch active season: ${seasonError.message}`);
      const season = seasonData as SeasonIdRow | null;
      
      if (!season) {
         result.errors.push('No active season found');
         result.duration = Date.now() - startTime;
         return result;
      }

      const rankingResult = await this.calculateGlobalRankings(season.id, options.seasonLimit);
      result.managersRanked = rankingResult.ranked;
      result.hasMore = rankingResult.hasMore;
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

export async function calculateGlobalRankings(
  options: { seasonLimit?: number } = {}
): Promise<JobResult> {
  const job = new CalculateGlobalRankings();
  return job.execute(options);
}

export default calculateGlobalRankings;
