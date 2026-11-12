import { createClient } from '@supabase/supabase-js';

interface JobResult {
  success: boolean;
  gameweeksRecalculated: number;
  lineupsUpdated: number;
  fantasySeasonsUpdated: number;
  errors: string[];
  duration: number;
  hasMore?: boolean;
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
   * Pure in-memory calculation of lineup total points from pre-fetched gameweek maps.
   * Completely avoids N+1 database queries per lineup.
   */
  private computeLineupTotalInMemory(
    lineup: Lineup,
    playersWhoPlayed: Set<number>,
    benchPlayerRoles: Map<number, string>,
    playerPointsMap: Map<number, number>,
  ): number {
    let totalPoints = 0;

    const starterSlots = [
      { id: lineup.carry_id, role: 'Carry' },
      { id: lineup.mid_id, role: 'Mid' },
      { id: lineup.offlane_id, role: 'Offlane' },
      { id: lineup.support_id, role: 'Support' },
      { id: lineup.hard_support_id, role: 'Hard Support' },
    ];

    const starterIds = starterSlots.map(s => s.id).filter((id): id is number => id !== null);
    const benchIds = [
      lineup.bench_1_id,
      lineup.bench_2_id,
      lineup.bench_3_id,
    ].filter((id): id is number => id !== null);

    const allIds = [...starterIds, ...benchIds];
    if (allIds.length === 0) return 0;

    const activeStarters: number[] = [];
    const usedBench = new Set<number>();
    const availableBench = benchIds.filter(id => playersWhoPlayed.has(id));

    starterSlots.forEach(slot => {
      if (slot.id === null) return;

      if (!playersWhoPlayed.has(slot.id)) {
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

    const isBenchBoostActive = lineup.bench_boost_gameweek_id === lineup.gameweek_id;
    const finalScoringIds = isBenchBoostActive ? allIds : activeStarters;

    if (finalScoringIds.length === 0) return 0;

    const captainPlayed = playersWhoPlayed.has(lineup.captain_player_id);

    finalScoringIds.forEach((playerId) => {
      let playerScore = playerPointsMap.get(playerId) || 0;

      if (playerId === lineup.captain_player_id) {
        if (lineup.triple_captain_gameweek_id === lineup.gameweek_id) {
          playerScore *= 3.0;
        } else {
          playerScore *= 2.0;
        }
      } else if (playerId === lineup.vice_captain_player_id) {
        if (!captainPlayed) {
          if (lineup.triple_captain_gameweek_id === lineup.gameweek_id) {
            playerScore *= 3.0;
          } else {
            playerScore *= 2.0;
          }
        }
      }

      totalPoints += playerScore;
    });

    return Math.round(totalPoints * 100) / 100;
  }

  /**
   * Calculate lineup total points for a specific lineup (standalone calculation)
   */
  private async calculateLineupTotal(lineup: Lineup): Promise<number> {
    const starterSlots = [
      { id: lineup.carry_id, role: 'Carry' },
      { id: lineup.mid_id, role: 'Mid' },
      { id: lineup.offlane_id, role: 'Offlane' },
      { id: lineup.support_id, role: 'Support' },
      { id: lineup.hard_support_id, role: 'Hard Support' },
    ];
    const starterIds = starterSlots.map(s => s.id).filter((id) => id !== null) as number[];
    const benchIds = [lineup.bench_1_id, lineup.bench_2_id, lineup.bench_3_id].filter((id) => id !== null) as number[];
    const allIds = [...starterIds, ...benchIds];
    if (allIds.length === 0) return 0;

    const [perfsRes, benchRolesRes] = await Promise.all([
      this.supabase.from('player_performances').select('player_id, fantasy_points_breakdown(total_points)').eq('gameweek_id', lineup.gameweek_id).in('player_id', allIds),
      this.supabase.from('professional_players').select('id, primary_role').in('id', benchIds),
    ]);

    const playersWhoPlayed = new Set<number>();
    const playerPointsMap = new Map<number, number>();
    ((perfsRes.data ?? []) as PlayerPointsRow[]).forEach((row) => {
      playersWhoPlayed.add(row.player_id);
      const pts = Number(row.fantasy_points_breakdown?.total_points ?? 0);
      playerPointsMap.set(row.player_id, (playerPointsMap.get(row.player_id) || 0) + pts);
    });

    const benchPlayerRoles = new Map<number, string>();
    ((benchRolesRes.data ?? []) as BenchPlayerRoleRow[]).forEach((p) => {
      benchPlayerRoles.set(p.id, p.primary_role);
    });

    return this.computeLineupTotalInMemory(lineup, playersWhoPlayed, benchPlayerRoles, playerPointsMap);
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
   * Main job entry point
   */
  async execute(options: { gameweekLimit?: number } = {}): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: false,
      gameweeksRecalculated: 0,
      lineupsUpdated: 0,
      fantasySeasonsUpdated: 0,
      errors: [],
      duration: 0,
      hasMore: false,
    };

    try {
      // Find gameweeks that are active or closed — active ones score in real-time,
      // closed ones are fully finalised.
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

      // Pre-fetch professional player roles into a memory map once
      const { data: benchPlayersData } = await this.supabase
        .from('professional_players')
        .select('id, primary_role');
      const benchPlayerRoles = new Map<number, string>();
      (benchPlayersData ?? []).forEach((p: BenchPlayerRoleRow) => {
        benchPlayerRoles.set(p.id, p.primary_role);
      });

      // Sort gameweeks: active first, then newest closed gameweeks
      const sortedGameweeks = [...gameweeks].sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;
        return b.id - a.id;
      });

      // Default to 2 gameweeks (active + latest closed) if gameweekLimit not specified
      const gameweekLimit = options.gameweekLimit ?? 2;
      let gameweeksToProcess = sortedGameweeks;
      if (sortedGameweeks.length > gameweekLimit) {
        gameweeksToProcess = sortedGameweeks.slice(0, gameweekLimit);
        result.hasMore = true;
        console.log(
          `[recalculateGameweeks] gameweekLimit=${gameweekLimit}: processing ${gameweeksToProcess.length} of ${sortedGameweeks.length} gameweeks`
        );
      }

      const updatedFantasySeasons = new Set<number>();

      // Process each gameweek
      for (const gameweek of gameweeksToProcess) {
        try {
          // Pre-fetch all player performances & points for this gameweek in 1 query
          const { data: rawPerfsWithPoints } = await this.supabase
            .from('player_performances')
            .select('player_id, fantasy_points_breakdown(total_points)')
            .eq('gameweek_id', gameweek.id);
          const perfsWithPoints = (rawPerfsWithPoints ?? []) as PlayerPointsRow[];

          const playersWhoPlayed = new Set<number>();
          const playerPointsMap = new Map<number, number>();
          perfsWithPoints.forEach((row) => {
            playersWhoPlayed.add(row.player_id);
            const pts = Number(row.fantasy_points_breakdown?.total_points ?? 0);
            const current = playerPointsMap.get(row.player_id) || 0;
            playerPointsMap.set(row.player_id, current + pts);
          });

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

          if (!lineups || lineups.length === 0) continue;

          // Compute and update each lineup's total points in parallel
          const lineupUpdatePromises = (lineups as Array<Lineup & { fantasy_seasons: { triple_captain_gameweek_id: number | null; bench_boost_gameweek_id: number | null } | null }>).map(
            async (rawLineup) => {
              const lineup: Lineup = {
                ...rawLineup,
                triple_captain_gameweek_id: rawLineup.fantasy_seasons?.triple_captain_gameweek_id || null,
                bench_boost_gameweek_id: rawLineup.fantasy_seasons?.bench_boost_gameweek_id || null,
              };
              const totalPoints = this.computeLineupTotalInMemory(
                lineup,
                playersWhoPlayed,
                benchPlayerRoles,
                playerPointsMap,
              );

              const { error: updateErr } = await (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this.supabase.from('fantasy_lineups') as any
              ).update({ total_points: totalPoints })
                .eq('id', lineup.id);

              if (!updateErr) {
                return lineup.fantasy_season_id;
              }
              return null;
            }
          );

          const updatedSeasonIds = await Promise.all(lineupUpdatePromises);
          for (const sId of updatedSeasonIds) {
            if (sId) {
              result.lineupsUpdated++;
              updatedFantasySeasons.add(sId);
            }
          }

          result.gameweeksRecalculated++;
        } catch (err: unknown) {
          result.errors.push(`Error processing gameweek ${gameweek.id}: ${errorMessage(err)}`);
        }
      }

      // Update fantasy season totals in parallel for all affected seasons
      const seasonUpdatePromises = Array.from(updatedFantasySeasons).map(async (fantasySeasonId) => {
        return this.updateFantasySeasonTotal(fantasySeasonId);
      });
      const seasonResults = await Promise.all(seasonUpdatePromises);
      result.fantasySeasonsUpdated += seasonResults.filter(Boolean).length;

      result.success = true;
    } catch (err: unknown) {
      result.errors.push(`Fatal error in recalculate gameweeks job: ${errorMessage(err)}`);
      console.error('Recalculate gameweeks job failed:', err);
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function recalculateGameweeks(
  options: { gameweekLimit?: number } = {}
): Promise<JobResult> {
  const calculator = new RecalculateGameweeks();
  return calculator.execute(options);
}

export default recalculateGameweeks;
