/**
 * Tournament Discovery Job
 * 
 * Discovers new tournaments from data provider
 * and creates tournament records in the database
 * 
 * Run schedule: Every 6 hours
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import type { Tournament } from '@/types/database';

interface DiscoveryResult {
  discovered: number;
  updated: number;
  errors: string[];
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

export async function discoverTournaments(): Promise<DiscoveryResult> {
  const startedAt = new Date();
  const result: DiscoveryResult = {
    discovered: 0,
    updated: 0,
    errors: [],
    duration: 0,
    startedAt,
    completedAt: new Date(),
  };

  try {
    const { getDataProvider } = await import('../data-providers/provider-config');
    const provider = await getDataProvider();

    console.log('[discoverTournaments] Starting tournament discovery');

    const jobExecutionId = await logJobExecution('discover-tournaments', 'started');

    try {
      // Fetch active and upcoming tournaments
      const tournaments = await provider.fetchTournaments({
        status: 'upcoming',
        limit: 100,
      });

      console.log(`[discoverTournaments] Found ${tournaments.length} tournaments`);

      // Get existing tournaments
      const existingTournaments = await getExistingTournaments();
      const supabase = getSupabaseServerClient();

      // Process each tournament
      for (const tournament of tournaments) {
        try {
          const existing = existingTournaments.get(tournament.id);

          if (existing) {
            // Update existing tournament
            const { error } = await supabase
              .from('tournaments')
              .update({
                name: tournament.name,
                status: 'active',
                tier: tournament.tier,
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', existing.id);

            if (error) throw error;
            result.updated++;
          } else {
            // Create new tournament
            // Get or create a default season first
            const { data: season } = await supabase
              .from('seasons')
              .select('id')
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            const seasonId = season?.id || 1;

            // Validate dates exist before converting
            if (!tournament.startDate || !tournament.endDate) {
              throw new Error(`Tournament ${tournament.id} missing start or end date`);
            }

            const { error } = await supabase
              .from('tournaments')
              .insert({
                season_id: seasonId,
                name: tournament.name,
                slug: tournament.id.toString(),
                status: 'upcoming',
                tier: tournament.tier,
                start_date: new Date(tournament.startDate).toISOString().split('T')[0],
                end_date: new Date(tournament.endDate).toISOString().split('T')[0],
                eligible: true,
                last_synced_at: new Date().toISOString(),
              });

            if (error) throw error;
            result.discovered++;
            console.log(`[discoverTournaments] Discovered new tournament: ${tournament.name}`);
          }
        } catch (error) {
          result.errors.push(
            `Failed to process tournament ${tournament.id}: ${(error as Error).message}`
          );
        }
      }

      await logJobExecution('discover-tournaments', 'completed', {
        discovered: result.discovered,
        updated: result.updated,
        errors: result.errors.length,
      }, jobExecutionId);

      console.log('[discoverTournaments] Completed successfully');
    } catch (error) {
      await logJobExecution('discover-tournaments', 'failed', {
        error: (error as Error).message,
      }, jobExecutionId);
      throw error;
    }
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error('[discoverTournaments] Failed:', errorMsg);
    result.errors.push(errorMsg);
  }

  result.completedAt = new Date();
  result.duration = result.completedAt.getTime() - result.startedAt.getTime();

  return result;
}

async function getExistingTournaments(): Promise<Map<string, Tournament>> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('tournaments')
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch existing tournaments: ${error.message}`);
  }

  const tournamentMap = new Map<string, Tournament>();
  for (const tournament of data || []) {
    tournamentMap.set(tournament.slug, tournament);
  }

  return tournamentMap;
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
