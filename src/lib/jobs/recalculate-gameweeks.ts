import { createClient } from '@supabase/supabase-js';

interface JobResult {
  success: boolean;
  gameweeksRecalculated: number;
  lineupsUpdated: number;
  fantasySeasonsUpdated: number;
  leaderboardsGenerated: number;
  errors: string[];
  duration: number;
}

interface Lineup {
  id: number;
  fantasy_season_id: number;
  gameweek_id: number;
  carry_id: number;
  mid_id: number;
  offlane_id: number;
  support_id: number;
  hard_support_id: number;
  bench_1_id: number | null;
  bench_2_id: number | null;
  bench_3_id: number | null;
  captain_player_id: number;
  vice_captain_player_id: number | null;
}

interface GameweekScore {
  player_id: number;
  total_points: number;
}

class RecalculateGameweeks {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  /**
   * Calculate lineup total points for a specific lineup
   * Applies captain multiplier and aggregates all player scores
   */
  private async calculateLineupTotal(lineup: Lineup): Promise<number> {
    let totalPoints = 0;

    // Get all player IDs in the lineup
    const playerIds = [
      lineup.carry_id,
      lineup.mid_id,
      lineup.offlane_id,
      lineup.support_id,
      lineup.hard_support_id,
      lineup.bench_1_id,
      lineup.bench_2_id,
      lineup.bench_3_id,
    ].filter((id) => id !== null) as number[];

    if (playerIds.length === 0) return 0;

    // Get fantasy points for all players in this gameweek
    const { data: pointsData } = await this.supabase
      .from('fantasy_points_breakdown')
      .select('player_id, total_points')
      .eq('gameweek_id', lineup.gameweek_id)
      .in('player_id', playerIds);

    const playerPointsMap = new Map<number, number>();
    pointsData?.forEach((row: any) => {
      playerPointsMap.set(row.player_id, row.total_points || 0);
    });

    // Sum points for each player, applying captain multiplier
    playerIds.forEach((playerId) => {
      let playerScore = playerPointsMap.get(playerId) || 0;

      // Apply captain multiplier (2x)
      if (playerId === lineup.captain_player_id) {
        playerScore *= 2.0;
      }
      // Apply vice-captain multiplier (1x unless captain didn't play)
      else if (playerId === lineup.vice_captain_player_id) {
        const captainScore = playerPointsMap.get(lineup.captain_player_id) || 0;
        if (captainScore === 0) {
          playerScore *= 2.0; // Vice-captain becomes captain if captain didn't play
        }
      }

      totalPoints += playerScore;
    });

    return Math.round(totalPoints * 100) / 100;
  }

  /**
   * Update a single fantasy lineup's total points
   */
  private async updateLineupTotal(lineup: Lineup): Promise<boolean> {
    try {
      const totalPoints = await this.calculateLineupTotal(lineup);

      const { error } = await (this.supabase
        .from('fantasy_lineups') as any)
        .update({ total_points: totalPoints } as any)
        .eq('id', lineup.id);

      if (error) {
        console.error(`Failed to update lineup ${lineup.id}:`, error);
        return false;
      }

      return true;
    } catch (err: any) {
      console.error(`Error updating lineup ${lineup.id}:`, err);
      return false;
    }
  }

  /**
   * Update fantasy season totals by aggregating all lineups
   */
  private async updateFantasySeasonTotal(fantasySeasonId: number): Promise<boolean> {
    try {
      // Get all lineups for this fantasy season
      const { data: lineupData } = (await this.supabase
        .from('fantasy_lineups')
        .select('total_points')
        .eq('fantasy_season_id', fantasySeasonId)) as any;
      const lineups: any[] = Array.isArray(lineupData) ? lineupData : [];

      if (lineups.length === 0) return false;

      const totalPoints = lineups.reduce((sum, lineup: any) => sum + (lineup.total_points || 0), 0);

      const { error } = await (this.supabase
        .from('fantasy_seasons') as any)
        .update({ total_points: Math.round(totalPoints * 100) / 100 } as any)
        .eq('id', fantasySeasonId);

      if (error) {
        console.error(`Failed to update fantasy season ${fantasySeasonId}:`, error);
        return false;
      }

      return true;
    } catch (err: any) {
      console.error(`Error updating fantasy season ${fantasySeasonId}:`, err);
      return false;
    }
  }

  /**
   * Generate leaderboard rankings for a closed gameweek
   */
  private async generateGameweekLeaderboard(gameweekId: number, seasonId: number): Promise<number> {
    try {
      // Get all lineups for this gameweek, ordered by total_points descending
      const { data: lineups, error: lineupsError } = (await (this.supabase
        .from('fantasy_lineups') as any)
        .select(
          `
          id,
          fantasy_season_id,
          total_points,
          fantasy_seasons(user_id)
        `,
        )
        .eq('gameweek_id', gameweekId)
        .order('total_points', { ascending: false })) as any;

      if (lineupsError || !lineups) return 0;

      // Update global_rank for fantasy_seasons based on this gameweek
      const userRanks = new Map<string, number>();
      let rank = 1;

      (lineups as any[]).forEach((lineup: any) => {
        const userId = (lineup as any).fantasy_seasons?.user_id;
        if (userId && !userRanks.has(userId)) {
          userRanks.set(userId, rank);
          rank++;
        }
      });

      // Update fantasy_seasons with new ranks
      let updated = 0;
      for (const [userId, newRank] of userRanks.entries()) {
        const { error: updateError } = await (this.supabase
          .from('fantasy_seasons') as any)
          .update({ global_rank: newRank } as any)
          .eq('user_id', userId)
          .eq('season_id', seasonId);

        if (!updateError) updated++;
      }

      return updated;
    } catch (err: any) {
      console.error(`Error generating leaderboard for gameweek ${gameweekId}:`, err);
      return 0;
    }
  }

  /**
   * Main job entry point
   */
  async execute(): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: false,
      gameweeksRecalculated: 0,
      lineupsUpdated: 0,
      fantasySeasonsUpdated: 0,
      leaderboardsGenerated: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Find gameweeks that have closed (all matches completed)
      const { data: gameweekData, error: gameweekError } = (await this.supabase
        .from('gameweeks')
        .select('id, season_id, status')
        .eq('status', 'closed')) as any;
      const gameweeks: any[] = Array.isArray(gameweekData) ? gameweekData : [];

      if (gameweekError) {
        result.errors.push(`Failed to fetch gameweeks: ${gameweekError.message}`);
        result.duration = Date.now() - startTime;
        return result;
      }

      if (gameweeks.length === 0) {
        console.log('No closed gameweeks to recalculate');
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      const updatedFantasySeasons = new Set<number>();

      // Process each gameweek
      for (const gameweek of gameweeks) {
        try {
          // Get all lineups for this gameweek
          const { data: lineups, error: lineupsError } = await this.supabase
            .from('fantasy_lineups')
            .select('*')
            .eq('gameweek_id', (gameweek as any).id);

          if (lineupsError) {
            result.errors.push(`Failed to fetch lineups for gameweek ${(gameweek as any).id}`);
            continue;
          }

          if (!lineups) continue;

          // Update each lineup's total points
          for (const lineup of (lineups as any[])) {
            const updated = await this.updateLineupTotal(lineup as Lineup);
            if (updated) {
              result.lineupsUpdated++;
              updatedFantasySeasons.add((lineup as any).fantasy_season_id);
            }
          }

          // Generate leaderboard for this gameweek
          const leaderboardsGenerated = await this.generateGameweekLeaderboard((gameweek as any).id, (gameweek as any).season_id);
          result.leaderboardsGenerated += leaderboardsGenerated;

          result.gameweeksRecalculated++;
        } catch (err: any) {
          result.errors.push(`Error processing gameweek ${gameweek.id}: ${err.message}`);
        }
      }

      // Update fantasy season totals for all affected seasons
      for (const fantasySeasonId of updatedFantasySeasons) {
        const updated = await this.updateFantasySeasonTotal(fantasySeasonId);
        if (updated) {
          result.fantasySeasonsUpdated++;
        }
      }

      result.success = true;
    } catch (err: any) {
      result.errors.push(`Fatal error in recalculate gameweeks job: ${err.message}`);
      console.error('Recalculate gameweeks job failed:', err);
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function recalculateGameweeks(): Promise<JobResult> {
  const calculator = new RecalculateGameweeks();
  return calculator.execute();
}

export default recalculateGameweeks;
