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
  triple_captain_gameweek_id?: number | null;
  bench_boost_gameweek_id?: number | null;
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

    // Separate starters from bench players
    const starterSlots = [
      { id: lineup.carry_id, role: 'Carry' },
      { id: lineup.mid_id, role: 'Mid' },
      { id: lineup.offlane_id, role: 'Offlane' },
      { id: lineup.support_id, role: 'Support' },
      { id: lineup.hard_support_id, role: 'Hard Support' },
    ];
    
    const starterIds = starterSlots.map(s => s.id).filter((id) => id !== null) as number[];

    const benchIds = [
      lineup.bench_1_id,
      lineup.bench_2_id,
      lineup.bench_3_id,
    ].filter((id) => id !== null) as number[];
    
    const allIds = [...starterIds, ...benchIds];
    if (allIds.length === 0) return 0;

    // Fetch player performances to see who actually played matches in this gameweek
    const { data: performances } = await this.supabase
      .from('player_performance')
      .select('player_id')
      .eq('gameweek_id', lineup.gameweek_id)
      .in('player_id', allIds);

    const playersWhoPlayed = new Set<number>();
    performances?.forEach((p: any) => playersWhoPlayed.add(p.player_id));
    
    // Fetch bench player roles for substitutions
    const { data: benchPlayersData } = await this.supabase
      .from('professional_players')
      .select('id, primary_role')
      .in('id', benchIds);
      
    const benchPlayerRoles = new Map<number, string>();
    benchPlayersData?.forEach((p: any) => {
      benchPlayerRoles.set(p.id, p.primary_role);
    });

    // Auto-bench substitution logic
    const activeStarters: number[] = [];
    const usedBench = new Set<number>();
    const availableBench = benchIds.filter(id => playersWhoPlayed.has(id));

    starterSlots.forEach(slot => {
      if (slot.id === null) return;
      
      if (!playersWhoPlayed.has(slot.id)) {
        // Starter didn't play, find first eligible bench player with the matching role
        const subId = availableBench.find(
          bId => !usedBench.has(bId) && benchPlayerRoles.get(bId) === slot.role
        );
        if (subId) {
          usedBench.add(subId);
          activeStarters.push(subId);
        }
      } else {
        activeStarters.push(slot.id);
      }
    });

    // Bench players only score if Bench Boost chip is active this gameweek
    const isBenchBoostActive = lineup.bench_boost_gameweek_id === lineup.gameweek_id;
    const finalScoringIds = isBenchBoostActive ? allIds : activeStarters;

    if (finalScoringIds.length === 0) return 0;

    // Get fantasy points for all relevant players in this gameweek
    const { data: pointsData } = await this.supabase
      .from('fantasy_points_breakdown')
      .select('player_id, total_points')
      .eq('gameweek_id', lineup.gameweek_id)
      .in('player_id', finalScoringIds);

    const playerPointsMap = new Map<number, number>();
    pointsData?.forEach((row: any) => {
      playerPointsMap.set(row.player_id, row.total_points || 0);
    });

    const captainPlayed = playersWhoPlayed.has(lineup.captain_player_id);

    // Sum points for each scoring player, applying captain multiplier
    finalScoringIds.forEach((playerId) => {
      let playerScore = playerPointsMap.get(playerId) || 0;

      // Apply Triple Captain or normal Captain multiplier
      if (playerId === lineup.captain_player_id) {
        if (lineup.triple_captain_gameweek_id === lineup.gameweek_id) {
          playerScore *= 3.0; // Triple captain
        } else {
          playerScore *= 2.0; // Normal captain
        }
      }
      // Apply vice-captain multiplier (1x unless captain didn't play)
      else if (playerId === lineup.vice_captain_player_id) {
        if (!captainPlayed) {
          if (lineup.triple_captain_gameweek_id === lineup.gameweek_id) {
            playerScore *= 3.0; // Vice-captain becomes triple captain if captain didn't play
          } else {
            playerScore *= 2.0; // Vice-captain becomes captain if captain didn't play
          }
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
            .select(`
              *,
              fantasy_seasons (
                triple_captain_gameweek_id,
                bench_boost_gameweek_id
              )
            `)
            .eq('gameweek_id', (gameweek as any).id);

          if (lineupsError) {
            result.errors.push(`Failed to fetch lineups for gameweek ${(gameweek as any).id}`);
            continue;
          }

          if (!lineups) continue;

          // Update each lineup's total points
          for (const rawLineup of (lineups as any[])) {
            const lineup = {
              ...rawLineup,
              triple_captain_gameweek_id: rawLineup.fantasy_seasons?.triple_captain_gameweek_id || null,
              bench_boost_gameweek_id: rawLineup.fantasy_seasons?.bench_boost_gameweek_id || null,
            };
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
