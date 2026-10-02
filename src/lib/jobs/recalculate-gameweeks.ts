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

interface PlayerParticipationRow {
  player_id: number;
}

interface PlayerPointsRow {
  player_id: number;
  fantasy_points_breakdown: { total_points: number | null } | null;
}

interface BenchPlayerRoleRow {
  id: number;
  primary_role: string;
}

interface SeasonLineupTotalRow {
  gameweek_id: number;
  total_points: number | null;
}

interface LeaderboardLineupRow {
  id: number;
  fantasy_season_id: number;
  total_points: number | null;
  fantasy_seasons: { user_id: string } | null;
}

interface ClosedGameweekRow {
  id: number;
  season_id: number;
  status: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
    const { data: rawPerformances } = await this.supabase
      .from('player_performances')
      .select('player_id')
      .eq('gameweek_id', lineup.gameweek_id)
      .in('player_id', allIds);
    const performances = (rawPerformances ?? []) as PlayerParticipationRow[];

    const playersWhoPlayed = new Set<number>();
    performances.forEach((performance) => playersWhoPlayed.add(performance.player_id));
    
    // Fetch bench player roles for substitutions
    const { data: benchPlayersData } = await this.supabase
      .from('professional_players')
      .select('id, primary_role')
      .in('id', benchIds);
      
    const benchPlayerRoles = new Map<number, string>();
    (benchPlayersData ?? []).forEach((p: BenchPlayerRoleRow) => {
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
    const { data: rawPerfsWithPoints } = await this.supabase
      .from('player_performances')
      .select('player_id, fantasy_points_breakdown(total_points)')
      .eq('gameweek_id', lineup.gameweek_id)
      .in('player_id', finalScoringIds);
    const perfsWithPoints = (rawPerfsWithPoints ?? []) as PlayerPointsRow[];

    const playerPointsMap = new Map<number, number>();
    perfsWithPoints.forEach((row) => {
      const pts = Number(row.fantasy_points_breakdown?.total_points ?? 0);
      const current = playerPointsMap.get(row.player_id) || 0;
      playerPointsMap.set(row.player_id, current + pts);
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

      const { error } = await (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.supabase.from('fantasy_lineups') as any
      ).update({ total_points: totalPoints })
        .eq('id', lineup.id);

      if (error) {
        console.error(`Failed to update lineup ${lineup.id}:`, error);
        return false;
      }

      return true;
    } catch (err: unknown) {
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
      const { data: rawLineupData } = await this.supabase
        .from('fantasy_lineups')
        .select('gameweek_id, total_points')
        .eq('fantasy_season_id', fantasySeasonId);
      const lineups = (rawLineupData ?? []) as SeasonLineupTotalRow[];

      if (lineups.length === 0) return false;

      const totalPoints = lineups.reduce((sum, lineup) => sum + (lineup.total_points || 0), 0);
      const latestLineup = [...lineups].sort((a, b) => (b.gameweek_id || 0) - (a.gameweek_id || 0))[0];
      const latestPoints = latestLineup?.total_points || 0;

      const { error } = await (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.supabase.from('fantasy_seasons') as any
      ).update({
          total_points: Math.round(totalPoints * 100) / 100,
          gameweek_points_latest: Math.round(latestPoints * 100) / 100,
        })
        .eq('id', fantasySeasonId);

      if (error) {
        console.error(`Failed to update fantasy season ${fantasySeasonId}:`, error);
        return false;
      }

      return true;
    } catch (err: unknown) {
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
      const { data: lineups, error: lineupsError } = await this.supabase
        .from('fantasy_lineups')
        .select(
          `
          id,
          fantasy_season_id,
          total_points,
          fantasy_seasons(user_id)
        `,
        )
        .eq('gameweek_id', gameweekId)
        .order('total_points', { ascending: false });

      if (lineupsError || !lineups) return 0;

      // Update global_rank for fantasy_seasons based on this gameweek
      const userRanks = new Map<string, number>();
      let rank = 1;

      (lineups as LeaderboardLineupRow[]).forEach((lineup) => {
        const userId = lineup.fantasy_seasons?.user_id;
        if (userId && !userRanks.has(userId)) {
          userRanks.set(userId, rank);
          rank++;
        }
      });

      // Update fantasy_seasons with new ranks
      let updated = 0;
      for (const [userId, newRank] of userRanks.entries()) {
        const { error: updateError } = await (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.supabase.from('fantasy_seasons') as any
        ).update({ global_rank: newRank })
          .eq('user_id', userId)
          .eq('season_id', seasonId);

        if (!updateError) updated++;
      }

      return updated;
    } catch (err: unknown) {
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
      // Find gameweeks that are active or closed — active ones score in real-time,
      // closed ones are fully finalised and also trigger leaderboard updates.
      const { data: rawGameweekData, error: gameweekError } = await this.supabase
        .from('gameweeks')
        .select('id, season_id, status')
        .in('status', ['closed', 'active']);
      const gameweeks = (rawGameweekData ?? []) as ClosedGameweekRow[];

      if (gameweekError) {
        result.errors.push(`Failed to fetch gameweeks: ${gameweekError.message}`);
        result.duration = Date.now() - startTime;
        return result;
      }

      if (gameweeks.length === 0) {
        console.log('No active or closed gameweeks to recalculate');
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
            .eq('gameweek_id', gameweek.id);

          if (lineupsError) {
            result.errors.push(`Failed to fetch lineups for gameweek ${gameweek.id}`);
            continue;
          }

          if (!lineups) continue;

          // Update each lineup's total points
          for (const rawLineup of (lineups as Array<Lineup & { fantasy_seasons: { triple_captain_gameweek_id: number | null; bench_boost_gameweek_id: number | null } | null }>)) {
            const lineup = {
              ...rawLineup,
              triple_captain_gameweek_id: rawLineup.fantasy_seasons?.triple_captain_gameweek_id || null,
              bench_boost_gameweek_id: rawLineup.fantasy_seasons?.bench_boost_gameweek_id || null,
            };
            const updated = await this.updateLineupTotal(lineup as Lineup);
            if (updated) {
              result.lineupsUpdated++;
              updatedFantasySeasons.add(lineup.fantasy_season_id);
            }
          }

          // Only generate leaderboard rankings for fully closed gameweeks —
          // active gameweek rankings change every match so we skip them here.
          if (gameweek.status === 'closed') {
            const leaderboardsGenerated = await this.generateGameweekLeaderboard(gameweek.id, gameweek.season_id);
            result.leaderboardsGenerated += leaderboardsGenerated;
          }

          result.gameweeksRecalculated++;
        } catch (err: unknown) {
          result.errors.push(`Error processing gameweek ${gameweek.id}: ${errorMessage(err)}`);
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
    } catch (err: unknown) {
      result.errors.push(`Fatal error in recalculate gameweeks job: ${errorMessage(err)}`);
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
