import { createClient } from '@supabase/supabase-js';
import {
  getMatchLifecyclePlayerIds,
  notifyMatchLifecycleMilestone,
} from './match-lifecycle-notifications';

interface JobResult {
  success: boolean;
  matchesProcessed: number;
  performancesCreated: number;
  substitutionsApplied: number;
  errors: string[];
  duration: number;
  hasMore?: boolean;
}

interface MatchPlayerStats {
  id: string;
  match_id: number;
  player_id: number;
  team_id: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_minute: number;
  experience_per_minute: number;
  last_hits: number;
  denies: number;
  hero_damage: number;
  tower_damage: number;
  healing: number;
  wards_placed: number;
  wards_destroyed: number;
}

interface CompletedMatchRow {
  id: number;
  external_match_id: string | null;
  gameweek_id: number;
  status: string;
  detailed_stats_fetched_at: string;
}

interface LockedLineupRow {
  id: number;
  carry_id: number | null;
  mid_id: number | null;
  offlane_id: number | null;
  support_id: number | null;
  hard_support_id: number | null;
  bench_1_id: number | null;
  bench_2_id: number | null;
  bench_3_id: number | null;
}

interface PlayerRoleRow {
  primary_role: string | null;
}

interface PerformanceParticipantRow {
  player_id: number;
}

type StarterRole = 'carry' | 'mid' | 'offlane' | 'support' | 'hard_support';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface PlayerPerformance {
  player_id: number;
  match_id: number;
  gameweek_id: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_minute: number;
  experience_per_minute: number;
  last_hits: number;
  denies: number;
  hero_damage: number;
  building_damage: number;
  wards_placed: number;
  wards_destroyed: number;
  healing: number;
}

class ProcessCompletedMatches {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  /**
   * Create or update player_performances from match_player_stats
   */
  private async createPlayerPerformance(stats: MatchPlayerStats, gameweekId: number): Promise<boolean> {
    const performance: PlayerPerformance = {
      player_id: stats.player_id,
      match_id: stats.match_id,
      gameweek_id: gameweekId,
      kills: stats.kills,
      deaths: stats.deaths,
      assists: stats.assists,
      gold_per_minute: stats.gold_per_minute,
      experience_per_minute: stats.experience_per_minute,
      last_hits: stats.last_hits,
      denies: stats.denies,
      hero_damage: stats.hero_damage,
      building_damage: stats.tower_damage,
      wards_placed: stats.wards_placed,
      wards_destroyed: stats.wards_destroyed,
      healing: stats.healing,
    };

    const { error } = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.supabase.from('player_performances') as any
    ).upsert(performance, {
      onConflict: 'player_id,match_id',
    });

    if (error) {
      console.error(`Failed to create performance for player ${stats.player_id} match ${stats.match_id}:`, error);
      return false;
    }

    return true;
  }

  /**
   * Apply automatic bench substitutions for a gameweek
   * If a starter didn't play, replace them with an eligible bench player
   */
  private async applyBenchSubstitutions(gameweekId: number): Promise<number> {
    let substitutionsApplied = 0;

    try {
      // Get all fantasy lineups for this gameweek
      const { data: rawLineupData, error: lineupsError } = await this.supabase
        .from('fantasy_lineups')
        .select('id, fantasy_season_id, carry_id, mid_id, offlane_id, support_id, hard_support_id, bench_1_id, bench_2_id, bench_3_id')
        .eq('gameweek_id', gameweekId)
        .eq('locked', true);
      const lineups = (rawLineupData ?? []) as LockedLineupRow[];

      if (lineupsError) {
        console.warn('Failed to fetch lineups for substitution:', lineupsError);
        return 0;
      }

      if (lineups.length === 0) {
        return 0;
      }

      // For each lineup, check if starters have performances
      for (const lineup of lineups) {
        const starterIds = [lineup.carry_id, lineup.mid_id, lineup.offlane_id, lineup.support_id, lineup.hard_support_id];
        const benchIds = [lineup.bench_1_id, lineup.bench_2_id, lineup.bench_3_id].filter((id): id is number => id !== null);

        // Get performances for all players in this lineup
        const { data: performances } = await this.supabase
          .from('fantasy_points_breakdown')
          .select('player_id')
          .eq('gameweek_id', gameweekId)
          .in('player_id', [...starterIds, ...benchIds]);

        const performingPlayerIds = new Set(((performances ?? []) as PerformanceParticipantRow[]).map((player) => player.player_id));

        // Check which starters didn't perform
        const nonPerformingStarters: Partial<Record<StarterRole, number>> = {};
        const starterRoles: StarterRole[] = ['carry', 'mid', 'offlane', 'support', 'hard_support'];

        starterRoles.forEach((role, index) => {
          const starterId = starterIds[index];
          if (starterId && !performingPlayerIds.has(starterId)) {
            nonPerformingStarters[role] = starterId;
          }
        });

        // For each non-performing starter, try to substitute with bench player
        for (const [role, starterId] of Object.entries(nonPerformingStarters) as Array<[StarterRole, number]>) {
          // Get player role to match bench player
          const { data: starterData } = await this.supabase
            .from('professional_players')
            .select('primary_role')
            .eq('id', starterId)
            .single();
          const starterRole = starterData as PlayerRoleRow | null;

          if (!starterRole) continue;

          // Find bench player with matching role who did perform
          for (const benchId of benchIds) {
            if (!benchId || performingPlayerIds.has(benchId)) continue;

            const { data: benchPlayer } = await this.supabase
              .from('professional_players')
              .select('primary_role')
              .eq('id', benchId)
              .single();
            const benchRole = benchPlayer as PlayerRoleRow | null;

            if (benchRole?.primary_role === starterRole.primary_role) {
              // Perform substitution: update lineup to move bench player to starter position
              const updateData: Record<string, number | null> = {};
              updateData[`${role}_id`] = benchId;

              // Also clear this bench slot
              const benchIndex = benchIds.indexOf(benchId);
              if (benchIndex !== -1) {
                updateData[`bench_${benchIndex + 1}_id`] = null;
              }

              const { error: updateError } = await (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                this.supabase.from('fantasy_lineups') as any
              ).update(updateData)
                .eq('id', lineup.id);

              if (!updateError) {
                substitutionsApplied++;
              }
              break; // Only substitute once per starter
            }
          }
        }
      }
    } catch (err: unknown) {
      console.error('Error applying bench substitutions:', err);
    }

    return substitutionsApplied;
  }

  /**
   * Main job entry point
   */
  async execute(options: { matchLimit?: number } = {}): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: false,
      matchesProcessed: 0,
      performancesCreated: 0,
      substitutionsApplied: 0,
      errors: [],
      duration: 0,
      hasMore: false,
    };

    try {
      // Get completed matches that have detailed stats fetched recently (within the last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const matchLimit = options.matchLimit ?? 50;

      const { data: matches, error: matchError } = await this.supabase
        .from('matches')
        .select('id, external_match_id, gameweek_id, status, detailed_stats_fetched_at')
        .eq('status', 'completed')
        .not('detailed_stats_fetched_at', 'is', null)
        .gte('detailed_stats_fetched_at', sevenDaysAgo)
        .order('detailed_stats_fetched_at', { ascending: true });

      if (matchError) {
        result.errors.push(`Failed to fetch matches: ${matchError.message}`);
        result.duration = Date.now() - startTime;
        return result;
      }

      const allCandidateMatches = (matches ?? []) as CompletedMatchRow[];
      if (allCandidateMatches.length === 0) {
        console.log('[ProcessMatches] No completed matches with detailed stats to process');
        result.success = result.errors.length === 0;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Check which candidate matches already have performances in player_performances
      const candidateIds = allCandidateMatches.map((m) => m.id);
      const processedMatchIds = new Set<number>();
      const matchIdsWithStats = new Set<number>();
      // Use chunks of 50 matches (max 500 player rows) to stay well under Supabase/PostgREST 1000-row limit
      const CHECK_CHUNK = 50;
      for (let i = 0; i < candidateIds.length; i += CHECK_CHUNK) {
        const slice = candidateIds.slice(i, i + CHECK_CHUNK);

        // Check which matches have stats in match_player_stats
        const { data: statsRows, error: statsCheckError } = await this.supabase
          .from('match_player_stats')
          .select('match_id')
          .in('match_id', slice)
          .limit(1000);

        if (statsCheckError) {
          result.errors.push(`Failed to check match_player_stats: ${statsCheckError.message}`);
          result.duration = Date.now() - startTime;
          return result;
        }

        for (const row of (statsRows ?? []) as Array<{ match_id: number }>) {
          matchIdsWithStats.add(row.match_id);
        }

        // Check which matches already have performances
        const { data: existingPerformances, error: perfError } = await this.supabase
          .from('player_performances')
          .select('match_id')
          .in('match_id', slice)
          .limit(1000);

        if (perfError) {
          result.errors.push(`Failed to check existing performances: ${perfError.message}`);
          result.duration = Date.now() - startTime;
          return result;
        }

        for (const row of (existingPerformances ?? []) as Array<{ match_id: number }>) {
          processedMatchIds.add(row.match_id);
        }
      }

      // Only process matches that:
      //  1. Have rows in match_player_stats (there are stats to convert)
      //  2. Do NOT yet have rows in player_performances (not already processed)
      // Matches with detailed_stats_fetched_at but no match_player_stats rows are from
      // pub/untracked tournaments and can never produce performances — skip them permanently.
      const pendingMatches = allCandidateMatches.filter(
        (m) => matchIdsWithStats.has(m.id) && !processedMatchIds.has(m.id),
      );

      const skippedNoStats = allCandidateMatches.length - matchIdsWithStats.size;
      if (skippedNoStats > 0) {
        console.log(`[ProcessMatches] Skipping ${skippedNoStats} matches with no match_player_stats rows (untracked/pub matches).`);
      }
      result.hasMore = pendingMatches.length > matchLimit;
      const matchesList = pendingMatches.slice(0, matchLimit);
      const matchCount = matchesList.length;

      if (matchCount === 0) {
        console.log('[ProcessMatches] All completed matches already have performances created. 0 pending.');
        result.success = result.errors.length === 0;
        result.duration = Date.now() - startTime;
        return result;
      }

      console.log(`[ProcessMatches] Processing ${matchCount} completed matches (${pendingMatches.length} pending, hasMore=${result.hasMore})...`);
      const processedGameweeks = new Set<number>();

      // Process matches in chunks of 25 to avoid overwhelming network or memory
      const CHUNK_SIZE = 25;
      for (let i = 0; i < matchCount; i += CHUNK_SIZE) {
        const chunk = matchesList.slice(i, i + CHUNK_SIZE);
        const matchIds = chunk.map((m) => m.id);
        const matchGwMap = new Map<number, number>(chunk.map((m) => [m.id, m.gameweek_id]));

        // Fetch all player stats for this chunk of matches in ONE query
        const { data: chunkStats, error: statsError } = await this.supabase
          .from('match_player_stats')
          .select('*')
          .in('match_id', matchIds);

        if (statsError) {
          result.errors.push(`Failed to fetch stats for matches chunk ${i}-${i + chunk.length}: ${statsError.message}`);
          continue;
        }

        if (chunkStats && chunkStats.length > 0) {
          const performancesToUpsert: PlayerPerformance[] = (chunkStats as MatchPlayerStats[]).map((stats) => ({
            player_id: stats.player_id,
            match_id: stats.match_id,
            gameweek_id: matchGwMap.get(stats.match_id) || 0,
            kills: stats.kills,
            deaths: stats.deaths,
            assists: stats.assists,
            gold_per_minute: stats.gold_per_minute,
            experience_per_minute: stats.experience_per_minute,
            last_hits: stats.last_hits,
            denies: stats.denies,
            hero_damage: stats.hero_damage,
            building_damage: stats.tower_damage,
            wards_placed: stats.wards_placed,
            wards_destroyed: stats.wards_destroyed,
            healing: stats.healing,
          }));

          // Bulk upsert all performances for this chunk
          const { error: upsertError } = await (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.supabase.from('player_performances') as any
          ).upsert(performancesToUpsert, {
            onConflict: 'player_id,match_id',
          });

          if (upsertError) {
            result.errors.push(`Failed to upsert performances chunk: ${upsertError.message}`);
          } else {
            result.performancesCreated += performancesToUpsert.length;
            const statsByMatch = new Map<number, Set<number>>();
            for (const stats of chunkStats as MatchPlayerStats[]) {
              const playerIds = statsByMatch.get(stats.match_id) ?? new Set<number>();
              playerIds.add(stats.player_id);
              statsByMatch.set(stats.match_id, playerIds);
            }
            const matchesById = new Map(chunk.map((match) => [match.id, match]));
            try {
              const { data: substitutions, error: substitutionsError } = await this.supabase
                .from('match_player_substitutions')
                .select('match_id, rostered_player_id, stand_in_player_id')
                .in('match_id', matchIds);
              if (substitutionsError) {
                throw new Error(`Failed to load match substitutions: ${substitutionsError.message}`);
              }

              const notificationResult = await notifyMatchLifecycleMilestone(
                this.supabase,
                [...statsByMatch].map(([matchId]) => ({
                  id: matchId,
                  externalMatchId: matchesById.get(matchId)?.external_match_id || String(matchId),
                  playerIds: getMatchLifecyclePlayerIds(
                    matchId,
                    chunkStats as MatchPlayerStats[],
                    substitutions ?? [],
                  ),
                })),
                'data_processed',
              );
              result.errors.push(...notificationResult.errors);
            } catch (notificationError: unknown) {
              const message = errorMessage(notificationError);
              result.errors.push(`Failed to notify users that match data was processed: ${message}`);
              console.error('[ProcessMatches] Failed to notify match data processing:', notificationError);
            }
          }
        }

        result.matchesProcessed += chunk.length;
        chunk.forEach((m) => {
          if (m.gameweek_id) processedGameweeks.add(m.gameweek_id);
        });

        console.log(`[ProcessMatches] Processed ${result.matchesProcessed}/${matchCount} matches (${result.performancesCreated} performances saved)...`);
      }

      // Apply bench substitutions for all affected gameweeks
      for (const gameweekId of processedGameweeks) {
        const substitutions = await this.applyBenchSubstitutions(gameweekId);
        result.substitutionsApplied += substitutions;
      }

      result.success = true;
      console.log(`[ProcessMatches] Finished in ${Date.now() - startTime}ms. Created ${result.performancesCreated} performances.`);
    } catch (err: unknown) {
      result.errors.push(`Fatal error in process completed matches job: ${errorMessage(err)}`);
      console.error('Process completed matches job failed:', err);
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function processCompletedMatches(options: { matchLimit?: number } = {}): Promise<JobResult> {
  const processor = new ProcessCompletedMatches();
  return processor.execute(options);
}

export default processCompletedMatches;
