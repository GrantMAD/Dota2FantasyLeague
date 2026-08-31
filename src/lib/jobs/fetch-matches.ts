/**
 * Match Fetching Job
 * 
 * Fetches matches for active tournaments from data provider
 * and syncs them to the database
 * 
 * Run schedule: Every 1 hour during active season
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import type { Match, Tournament } from '@/types/database';

interface FetchResult {
  fetched: number;
  updated: number;
  scheduled: number;
  errors: string[];
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

export async function fetchMatches(): Promise<FetchResult> {
  const startedAt = new Date();
  const result: FetchResult = {
    fetched: 0,
    updated: 0,
    scheduled: 0,
    errors: [],
    duration: 0,
    startedAt,
    completedAt: new Date(),
  };

  try {
    const { getDataProvider } = await import('../data-providers/provider-config');
    const provider = await getDataProvider();

    console.log('[fetchMatches] Starting match fetch');

    const jobExecutionId = await logJobExecution('fetch-matches', 'started');

    try {
      // Get active tournaments
      const activeTournaments = await getActiveTournaments();
      console.log(`[fetchMatches] Found ${activeTournaments.length} active tournaments`);

      for (const tournament of activeTournaments) {
        try {
          // Fetch matches for this tournament
          const matches = await provider.fetchMatches(tournament.id.toString(), {
            status: 'scheduled',
            limit: 100,
          });

          console.log(
            `[fetchMatches] Tournament ${tournament.name}: ${matches.length} scheduled matches`
          );

          // Get existing matches
          const existingMatches = await getExistingMatches(tournament.id.toString());

          // Process matches
          for (const match of matches) {
            try {
              const existing = existingMatches.get(match.id);

              if (existing) {
                result.updated++;
              } else {
                // Insert new match into database
                const supabase = getSupabaseServerClient();
                const { error } = await supabase
                  .from('matches')
                  .insert({
                    series_id: tournament.id,
                    team_a_id: parseInt(match.team1Id),
                    team_b_id: parseInt(match.team2Id),
                    status: 'scheduled',
                    scheduled_time: new Date(match.scheduledAt).toISOString(),
                    external_match_id: match.id.toString(),
                    last_synced_at: new Date().toISOString(),
                  });

                if (error) {
                  throw error;
                }
                result.fetched++;
              }
            } catch (error) {
              result.errors.push(
                `Failed to process match ${match.id}: ${(error as Error).message}`
              );
            }
          }

          // Also fetch concluded matches for details
          const concludedMatches = await provider.fetchMatches(tournament.id.toString(), {
            status: 'concluded',
            limit: 50,
          });

          // Schedule detail fetching for concluded matches
          for (const match of concludedMatches) {
            try {
              const hasDetails = await checkMatchDetails(match.id);
              if (!hasDetails) {
                // Queue match for detail fetching by updating status
                const supabase = getSupabaseServerClient();
                const { error } = await supabase
                  .from('matches')
                  .update({
                    status: 'completed',
                    last_synced_at: new Date().toISOString(),
                  })
                  .eq('external_match_id', match.id.toString())
                  .is('detailed_stats_fetched_at', null);

                if (!error) {
                  result.scheduled++;
                }
              }
            } catch {
              // Non-critical error, continue
            }
          }
        } catch (error) {
          result.errors.push(
            `Failed to fetch matches for tournament ${tournament.id}: ${(error as Error).message}`
          );
        }
      }

      await logJobExecution('fetch-matches', 'completed', {
        fetched: result.fetched,
        updated: result.updated,
        scheduled: result.scheduled,
        errors: result.errors.length,
      }, jobExecutionId);

      console.log('[fetchMatches] Completed successfully');
    } catch (error) {
      await logJobExecution('fetch-matches', 'failed', {
        error: (error as Error).message,
      }, jobExecutionId);
      throw error;
    }
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error('[fetchMatches] Failed:', errorMsg);
    result.errors.push(errorMsg);
  }

  result.completedAt = new Date();
  result.duration = result.completedAt.getTime() - result.startedAt.getTime();

  return result;
}

async function getActiveTournaments(): Promise<Tournament[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('status', 'active')
    .or('status.eq.upcoming');

  if (error) {
    console.warn(`Failed to fetch active tournaments: ${error.message}`);
    return [];
  }

  return data || [];
}

async function getExistingMatches(tournamentId: string): Promise<Map<string, Match>> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('series_id', tournamentId);

  if (error) {
    console.warn(`Failed to fetch existing matches: ${error.message}`);
    return new Map();
  }

  const matchMap = new Map<string, Match>();
  for (const match of data || []) {
    if (match.external_match_id) {
      matchMap.set(match.external_match_id, match);
    }
  }

  return matchMap;
}

async function checkMatchDetails(matchId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('matches')
    .select('detailed_stats_fetched_at')
    .eq('external_match_id', matchId.toString())
    .single();

  if (error || !data) {
    return false;
  }

  return data.detailed_stats_fetched_at !== null;
}

async function logJobExecution(
  jobName: string,
  status: 'started' | 'completed' | 'failed',
  metadata?: Record<string, unknown>,
  executionId?: string
): Promise<string> {
  const supabase = getSupabaseServerClient();

  if (executionId) {
    const { error } = await supabase
      .from('job_execution_log')
      .update({
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
    const { data, error } = await supabase
      .from('job_execution_log')
      .insert({
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
