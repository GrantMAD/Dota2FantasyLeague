import { createClient } from '@supabase/supabase-js';

interface JobResult {
  success: boolean;
  matchesProcessed: number;
  performancesCreated: number;
  substitutionsApplied: number;
  errors: string[];
  duration: number;
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

interface Match {
  id: number;
  gameweek_id: number;
  status: string;
  detailed_stats_fetched_at: string;
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

    const { error } = await (this.supabase
      .from('player_performances') as any)
      .upsert(performance as any, {
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
      const { data: lineupData, error: lineupsError } = (await this.supabase
        .from('fantasy_lineups')
        .select('id, fantasy_season_id, carry_id, mid_id, offlane_id, support_id, hard_support_id, bench_1_id, bench_2_id, bench_3_id')
        .eq('gameweek_id', gameweekId)
        .eq('locked', true)) as any;
      const lineups: any[] = Array.isArray(lineupData) ? lineupData : [];

      if (lineupsError) {
        console.warn('Failed to fetch lineups for substitution:', lineupsError);
        return 0;
      }

      if (lineups.length === 0) {
        return 0;
      }

      // For each lineup, check if starters have performances
      for (const lineup of lineups) {
        const starterIds = [(lineup as any).carry_id, (lineup as any).mid_id, (lineup as any).offlane_id, (lineup as any).support_id, (lineup as any).hard_support_id];
        const benchIds = [(lineup as any).bench_1_id, (lineup as any).bench_2_id, (lineup as any).bench_3_id].filter((id) => id !== null);

        // Get performances for all players in this lineup
        const { data: performances } = await this.supabase
          .from('fantasy_points_breakdown')
          .select('player_id')
          .eq('gameweek_id', gameweekId)
          .in('player_id', [...starterIds, ...benchIds]);

        const performingPlayerIds = new Set(performances?.map((p: any) => p.player_id) || []);

        // Check which starters didn't perform
        const nonPerformingStarters: { [key: string]: number } = {};
        const starterRoles = ['carry', 'mid', 'offlane', 'support', 'hard_support'];

        starterRoles.forEach((role, index) => {
          const starterId = starterIds[index];
          if (starterId && !performingPlayerIds.has(starterId)) {
            nonPerformingStarters[role] = starterId;
          }
        });

        // For each non-performing starter, try to substitute with bench player
        for (const [role, starterId] of Object.entries(nonPerformingStarters)) {
          // Get player role to match bench player
          const { data: starterData } = await this.supabase
            .from('professional_players')
            .select('primary_role')
            .eq('id', starterId)
            .single();

          if (!(starterData as any)) continue;

          // Find bench player with matching role who did perform
          for (const benchId of benchIds) {
            if (!benchId || performingPlayerIds.has(benchId)) continue;

            const { data: benchPlayer } = await this.supabase
              .from('professional_players')
              .select('primary_role')
              .eq('id', benchId)
              .single();

            if ((benchPlayer as any)?.primary_role === (starterData as any).primary_role) {
              // Perform substitution: update lineup to move bench player to starter position
              const updateData: any = {};
              updateData[`${role}_id`] = benchId;

              // Also clear this bench slot
              const benchIndex = benchIds.indexOf(benchId);
              if (benchIndex !== -1) {
                updateData[`bench_${benchIndex + 1}_id`] = null;
              }

              const { error: updateError } = await (this.supabase
                .from('fantasy_lineups') as any)
                .update(updateData)
                .eq('id', (lineup as any).id);

              if (!updateError) {
                substitutionsApplied++;
              }
              break; // Only substitute once per starter
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error applying bench substitutions:', err);
    }

    return substitutionsApplied;
  }

  /**
   * Main job entry point
   */
  async execute(): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: false,
      matchesProcessed: 0,
      performancesCreated: 0,
      substitutionsApplied: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Get all completed matches that have detailed stats
      const { data: matches, error: matchError } = await this.supabase
        .from('matches')
        .select('id, gameweek_id, status, detailed_stats_fetched_at')
        .eq('status', 'completed')
        .not('detailed_stats_fetched_at', 'is', null);

      if (matchError) {
        result.errors.push(`Failed to fetch matches: ${matchError.message}`);
        result.duration = Date.now() - startTime;
        return result;
      }

      const matchesList: any[] = Array.isArray(matches) ? matches : [];
      const matchCount = matchesList.length;
      if (matchCount === 0) {
        console.log('[ProcessMatches] No completed matches with detailed stats to process');
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      console.log(`[ProcessMatches] Processing ${matchCount} completed matches...`);
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
          const performancesToUpsert: PlayerPerformance[] = chunkStats.map((stats: any) => ({
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
          const { error: upsertError } = await (this.supabase
            .from('player_performances') as any)
            .upsert(performancesToUpsert as any, {
              onConflict: 'player_id,match_id',
            });

          if (upsertError) {
            result.errors.push(`Failed to upsert performances chunk: ${upsertError.message}`);
          } else {
            result.performancesCreated += performancesToUpsert.length;
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
    } catch (err: any) {
      result.errors.push(`Fatal error in process completed matches job: ${err.message}`);
      console.error('Process completed matches job failed:', err);
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function processCompletedMatches(): Promise<JobResult> {
  const processor = new ProcessCompletedMatches();
  return processor.execute();
}

export default processCompletedMatches;
