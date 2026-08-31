/**
 * Match Details Fetching Job
 * 
 * Fetches detailed statistics for concluded matches
 * Extracts player-level stats and calculates fantasy scores
 * 
 * Run schedule: Every 30 minutes after match conclusion
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import type { Match, MatchPlayerStats } from '@/types/database';

interface FetchDetailsResult {
  fetched: number;
  scored: number;
  errors: string[];
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

export async function fetchMatchDetails(): Promise<FetchDetailsResult> {
  const startedAt = new Date();
  const result: FetchDetailsResult = {
    fetched: 0,
    scored: 0,
    errors: [],
    duration: 0,
    startedAt,
    completedAt: new Date(),
  };

  try {
    const { getDataProvider } = await import('../data-providers/provider-config');
    const provider = await getDataProvider();

    console.log('[fetchMatchDetails] Starting match detail fetch');

    const jobExecutionId = await logJobExecution('fetch-match-details', 'started');

    try {
      // Get pending matches (concluded but no details yet)
      const pendingMatches = await getPendingMatches();
      console.log(`[fetchMatchDetails] Found ${pendingMatches.length} matches pending details`);

      // Process matches in batches
      const batchSize = 10;
      for (let i = 0; i < pendingMatches.length; i += batchSize) {
        const batch = pendingMatches.slice(i, i + batchSize);

        for (const match of batch) {
          try {
            // Fetch detailed stats from provider
            const details = await provider.fetchMatchDetails(match.external_match_id || match.id.toString());
            console.log(`[fetchMatchDetails] Fetched details for match ${match.id}`);

            // Extract player stats from nested teams structure and store in match_player_stats table
            const statsToInsert: Omit<MatchPlayerStats, 'id' | 'created_at' | 'updated_at'>[] = [];
            
            for (const team of details.teams || []) {
              for (const player of team.players || []) {
                statsToInsert.push({
                  match_id: match.id,
                  player_id: parseInt(player.playerId),
                  team_id: parseInt(team.teamId),
                  hero_id: player.heroId,
                  hero_name: player.heroName,
                  kills: player.kills || 0,
                  deaths: player.deaths || 0,
                  assists: player.assists || 0,
                  gold_per_minute: player.goldPerMinute || 0,
                  experience_per_minute: player.experiencePerMinute || 0,
                  last_hits: player.lastHits || 0,
                  denies: player.denies || 0,
                  hero_damage: player.heroDamage || 0,
                  tower_damage: player.towerDamage || 0,
                  healing: player.healing || 0,
                  wards_placed: player.wardsPlaced || 0,
                  wards_destroyed: player.wardsDestroyed || 0,
                  first_blood_achieved: player.firstBloodAchieved || false,
                  roshan_kills: player.roshansKilled || 0,
                });
              }
            }

            if (statsToInsert.length > 0) {
              const supabase = getSupabaseServerClient();
              const { error: statsError } = await supabase.from('match_player_stats').insert(statsToInsert);

              if (statsError) {
                throw statsError;
              }
            }

            result.fetched++;

            // Calculate fantasy scores for all players in match
            const scores = await calculateFantasyScoresForMatch(match, details);
            console.log(
              `[fetchMatchDetails] Calculated ${scores.length} fantasy scores for match ${match.id}`
            );

            // Insert fantasy scores into database
            if (scores.length > 0) {
              const supabase = getSupabaseServerClient();
              const { error: scoresError } = await supabase.from('gameweek_scores').insert(scores);

              if (scoresError) {
                console.warn(`Failed to insert fantasy scores: ${scoresError.message}`);
              }
            }

            result.scored += scores.length;

            // Mark match as having details fetched
            const supabase = getSupabaseServerClient();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('matches') as any).update({
              detailed_stats_fetched_at: new Date().toISOString(),
              last_synced_at: new Date().toISOString(),
            })
              .eq('id', match.id);
          } catch (error) {
            result.errors.push(
              `Failed to fetch details for match ${match.id}: ${(error as Error).message}`
            );
          }
        }
      }

      await logJobExecution('fetch-match-details', 'completed', {
        fetched: result.fetched,
        scored: result.scored,
        errors: result.errors.length,
      }, jobExecutionId);

      console.log('[fetchMatchDetails] Completed successfully');
    } catch (error) {
      await logJobExecution('fetch-match-details', 'failed', {
        error: (error as Error).message,
      }, jobExecutionId);
      throw error;
    }
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error('[fetchMatchDetails] Failed:', errorMsg);
    result.errors.push(errorMsg);
  }

  result.completedAt = new Date();
  result.duration = result.completedAt.getTime() - result.startedAt.getTime();

  return result;
}

async function getPendingMatches(): Promise<Match[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'completed')
    .is('detailed_stats_fetched_at', null)
    .limit(50);

  if (error) {
    console.warn(`Failed to fetch pending matches: ${error.message}`);
    return [];
  }

  return data || [];
}

interface PlayerStatistic {
  playerId: string;
  heroId: string;
  heroName: string;
  kills: number;
  deaths: number;
  assists: number;
  goldPerMinute: number;
  experiencePerMinute: number;
  lastHits: number;
  denies: number;
  heroDamage: number;
  towerDamage: number;
  healing: number;
  wardsPlaced: number;
  wardsDestroyed: number;
  firstBloodAchieved: boolean;
  roshansKilled: number;
}

interface FantasyScore {
  fantasy_season_id: number | null;
  player_id: number;
  gameweek_id: number;
  total_points: number;
  captain_multiplier: number;
  points_with_multiplier: number;
  is_auto_substituted: boolean;
}

async function calculateFantasyScoresForMatch(
  match: Match,
  details: {
    teams: Array<{
      teamId: string;
      players: PlayerStatistic[];
    }>;
  }
): Promise<FantasyScore[]> {
  const scores: FantasyScore[] = [];

  // Extract player stats and calculate fantasy scores
  if (!details.teams || details.teams.length === 0) {
    return scores;
  }

  for (const team of details.teams) {
    for (const playerStat of team.players || []) {
      try {
        // Basic scoring calculation
        // This is a simplified version - full scoring logic should be more complex
        let points = 0;

        // Combat points
        points += playerStat.kills * 5;
        points -= playerStat.deaths * 2;
        points += playerStat.assists * 1.5;

        // Economy points
        points += Math.floor((playerStat.goldPerMinute || 0) / 50);
        points += Math.floor((playerStat.experiencePerMinute || 0) / 50);

        // Objective points
        points += Math.floor((playerStat.heroDamage || 0) / 10000);
        points += (playerStat.wardsPlaced || 0) * 0.5;
        points -= (playerStat.wardsDestroyed || 0) * 0.25;

        scores.push({
          fantasy_season_id: null,
          player_id: parseInt(playerStat.playerId),
          gameweek_id: match.gameweek_id || 0,
          total_points: points,
          captain_multiplier: 1.0,
          points_with_multiplier: points,
          is_auto_substituted: false,
        });
      } catch (error) {
        console.warn(
          `Failed to calculate score for player ${playerStat.playerId}: ${error}`
        );
      }
    }
  }

  return scores;
}

async function logJobExecution(
  jobName: string,
  status: 'started' | 'completed' | 'failed',
  metadata?: Record<string, unknown>,
  executionId?: string
): Promise<string> {
  const supabase = getSupabaseServerClient();

  if (executionId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('job_execution_log') as any).update({
      status,
      completed_at: new Date().toISOString(),
      metadata,
    })
      .eq('id', executionId);

    if (error) {
      console.warn(`Failed to update job execution log: ${error.message}`);
    }

    return executionId;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('job_execution_log') as any).insert({
      job_name: jobName,
      status,
      started_at: new Date().toISOString(),
      metadata,
    })
      .select('id')
      .single();

    if (error) {
      console.warn(`Failed to create job execution log: ${error.message}`);
      return `job-${Date.now()}`;
    }

    return data?.id || `job-${Date.now()}`;
  }
}
