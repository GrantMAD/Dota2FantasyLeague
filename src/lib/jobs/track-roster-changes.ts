/**
 * Roster Change Tracking Job
 * 
 * Monitors professional player team transfers and roster changes
 * Tracks team membership history for accurate player availability
 * 
 * Run schedule: Daily at 2 AM UTC
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import type { ProfessionalPlayer } from '@/types/database';

interface TrackingResult {
  tracked: number;
  rosterChanges: number;
  unavailablePlayers: number;
  errors: string[];
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

export async function trackRosterChanges(): Promise<TrackingResult> {
  const startedAt = new Date();
  const result: TrackingResult = {
    tracked: 0,
    rosterChanges: 0,
    unavailablePlayers: 0,
    errors: [],
    duration: 0,
    startedAt,
    completedAt: new Date(),
  };

  try {
    const { getDataProvider } = await import('../data-providers/provider-config');
    const provider = await getDataProvider();

    console.log('[trackRosterChanges] Starting roster tracking');

    const jobExecutionId = await logJobExecution('track-roster-changes', 'started');

    try {
      // Get all active players
      const players = await getActivePlayers();
      console.log(`[trackRosterChanges] Checking ${players.length} players for changes`);

      for (const player of players) {
        try {
          // Fetch roster history for this player
          const history = await provider.fetchRosterHistory(
            player.data_provider_id || player.id.toString(),
            {
              from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              to: new Date(),
            }
          );

          if (history.length === 0) {
            result.tracked++;
            continue;
          }

          console.log(
            `[trackRosterChanges] Player ${player.name}: ${history.length} roster changes`
          );

          // Get existing roster history
          const existingHistory = await getPlayerRosterHistory(player.id);

          // Process new changes
          for (const change of history) {
            try {
              const existingChange = existingHistory.find(
                h => h.changed_at === change.changedAt.toISOString().split('T')[0] &&
                     h.team_id === parseInt(change.teamId)
              );

              if (!existingChange) {
                // New roster change - insert into team_roster_history table
                const supabase = getSupabaseServerClient();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { error } = await (supabase.from('team_roster_history') as any).insert({
                  team_id: parseInt(change.teamId),
                  player_id: player.id,
                  change_type: change.changeType,
                  changed_at: new Date(change.changedAt).toISOString(),
                  previous_team_id: change.previousTeam ? parseInt(change.previousTeam) : null,
                  role: change.role,
                });

                if (error) {
                  throw error;
                }

                result.rosterChanges++;

                // If player left a team, mark as temporarily unavailable
                if (change.changeType === 'left') {
                  const { error: updateError } = await supabase
                    .from('professional_players')
                    .update({
                      availability_status: 'unavailable',
                      last_synced_at: new Date().toISOString(),
                    })
                    .eq('id', player.id);

                  if (!updateError) {
                    result.unavailablePlayers++;
                  }

                  console.log(
                    `[trackRosterChanges] Player ${player.name} left team (temporarily unavailable)`
                  );
                }
              }
            } catch (error) {
              result.errors.push(
                `Failed to process change for player ${player.id}: ${(error as Error).message}`
              );
            }
          }

          result.tracked++;
        } catch (error) {
          result.errors.push(
            `Failed to track roster changes for player ${player.id}: ${(error as Error).message}`
          );
        }
      }

      // Update player availability based on current team
      await updatePlayerAvailability();

      await logJobExecution('track-roster-changes', 'completed', {
        tracked: result.tracked,
        rosterChanges: result.rosterChanges,
        unavailablePlayers: result.unavailablePlayers,
        errors: result.errors.length,
      }, jobExecutionId);

      console.log('[trackRosterChanges] Completed successfully');
    } catch (error) {
      await logJobExecution('track-roster-changes', 'failed', {
        error: (error as Error).message,
      }, jobExecutionId);
      throw error;
    }
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error('[trackRosterChanges] Failed:', errorMsg);
    result.errors.push(errorMsg);
  }

  result.completedAt = new Date();
  result.duration = result.completedAt.getTime() - result.startedAt.getTime();

  return result;
}

async function getActivePlayers(): Promise<ProfessionalPlayer[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('professional_players')
    .select('*')
    .eq('availability_status', 'available')
    .limit(500);

  if (error) {
    console.warn(`Failed to fetch active players: ${error.message}`);
    return [];
  }

  return data || [];
}

interface RosterChangeRecord {
  id: number;
  team_id: number;
  player_id: number;
  change_type: string;
  changed_at: string;
  previous_team_id?: number;
  role?: string;
}

async function getPlayerRosterHistory(playerId: number): Promise<RosterChangeRecord[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('team_roster_history')
    .select('*')
    .eq('player_id', playerId)
    .order('changed_at', { ascending: false });

  if (error) {
    console.warn(`Failed to fetch player roster history: ${error.message}`);
    return [];
  }

  return (data as RosterChangeRecord[]) || [];
}

async function updatePlayerAvailability(): Promise<void> {
  const supabase = getSupabaseServerClient();

  // Get all players currently in team rosters
  const { data: rosterPlayers, error: rosterError } = await supabase
    .from('professional_players')
    .select('id')
    .not('team_id', 'is', null);

  if (rosterError) {
    console.warn(`Failed to fetch roster players: ${rosterError.message}`);
    return;
  }

  const activePlayerIds = ((rosterPlayers as Array<{ id: number }>) || []).map((p) => p.id);

  // Get all players marked as available
  const { data: availablePlayers, error: availableError } = await supabase
    .from('professional_players')
    .select('id')
    .eq('availability_status', 'available');

  if (availableError) {
    console.warn(`Failed to fetch available players: ${availableError.message}`);
    return;
  }

  // Mark players not in any roster as unavailable
  const unavailablePlayerIds = ((availablePlayers as Array<{ id: number }>) || [])
    .map((p) => p.id)
    .filter((id) => !activePlayerIds.includes(id));

  if (unavailablePlayerIds.length > 0) {
    const { error: updateError } = await supabase
      .from('professional_players')
      .update({
        availability_status: 'unavailable',
        last_synced_at: new Date().toISOString(),
      })
      .in('id', unavailablePlayerIds);

    if (updateError) {
      console.warn(`Failed to update player availability: ${updateError.message}`);
    } else {
      console.log(`[trackRosterChanges] Updated ${unavailablePlayerIds.length} players to unavailable`);
    }
  }
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
