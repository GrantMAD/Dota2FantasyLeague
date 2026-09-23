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
      // If provider is OpenDota, use the single bulk /proPlayers endpoint to detect team transfers
      // rather than spamming 500 individual teammate HTTP requests that hit rate limits.
      if (provider.name === 'OpenDota') {
        const { fetchRawOpenDotaProPlayers } = await import('../data-providers/opendota-provider');
        const rawPlayers = await fetchRawOpenDotaProPlayers();
        const supabase = getSupabaseServerClient();

        // Get all DB teams for mapping provider team_id -> DB team id
        const { data: dbTeams } = await supabase
          .from('professional_teams')
          .select('id, data_provider_id');
        const teamMap = new Map<string, number>();
        for (const t of dbTeams || []) {
          if (t.data_provider_id) {
            teamMap.set(String(t.data_provider_id), t.id);
          }
        }

        // Get players currently in our DB
        const { data: dbPlayers } = await supabase
          .from('professional_players')
          .select('id, data_provider_id, team_id, name');

        const dbPlayerMap = new Map<string, { id: number; team_id: number | null; name: string }>();
        for (const p of dbPlayers || []) {
          if (p.data_provider_id) {
            dbPlayerMap.set(String(p.data_provider_id), p);
          }
        }

        for (const raw of rawPlayers) {
          const rawId = String(raw.account_id || raw.steamid);
          const dbPlayer = dbPlayerMap.get(rawId);
          if (!dbPlayer) continue;

          result.tracked++;

          const newTeamId = raw.team_id && raw.team_id !== 0
            ? (teamMap.get(String(raw.team_id)) ?? null)
            : null;

          // Check if team changed
          if (newTeamId !== dbPlayer.team_id) {
            const previousTeam = dbPlayer.team_id;
            const changeType = newTeamId ? (previousTeam ? 'transferred' : 'joined') : 'left';

            // Insert into history
            await (supabase.from('team_roster_history') as any).insert({
              team_id: newTeamId || previousTeam || 0,
              player_id: dbPlayer.id,
              change_type: changeType,
              changed_at: new Date().toISOString(),
              previous_team_id: previousTeam,
            });

            // Update player record
            await supabase
              .from('professional_players')
              .update({
                team_id: newTeamId,
                availability_status: newTeamId ? 'available' : 'unavailable',
                availability_reason: newTeamId ? null : 'Left team, currently a free agent',
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', dbPlayer.id);

            result.rosterChanges++;
            if (!newTeamId) {
              result.unavailablePlayers++;
            }
          }
        }
      } else {
        // STRATZ provider per-player history
        const players = await getActivePlayers();
        console.log(`[trackRosterChanges] Checking ${players.length} players for changes`);

        for (const player of players) {
          try {
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

            const existingHistory = await getPlayerRosterHistory(player.id);

            for (const change of history) {
              try {
                const existingChange = existingHistory.find(
                  h => h.changed_at === change.changedAt.toISOString().split('T')[0] &&
                       h.team_id === parseInt(change.teamId)
                );

                if (!existingChange) {
                  const supabase = getSupabaseServerClient();
                  await (supabase.from('team_roster_history') as any).insert({
                    team_id: parseInt(change.teamId),
                    player_id: player.id,
                    change_type: change.changeType,
                    changed_at: new Date(change.changedAt).toISOString(),
                    previous_team_id: change.previousTeam ? parseInt(change.previousTeam) : null,
                    role: change.role,
                  });

                  result.rosterChanges++;

                  if (change.changeType === 'left') {
                    const { error: updateError } = await supabase
                      .from('professional_players')
                      .update({
                        availability_status: 'unavailable',
                        availability_reason: 'Left team, currently a free agent',
                        last_synced_at: new Date().toISOString(),
                      })
                      .eq('id', player.id);

                    if (!updateError) {
                      result.unavailablePlayers++;
                    }
                  }

                  if (change.changeType === 'joined') {
                    await supabase
                      .from('professional_players')
                      .update({
                        team_id: parseInt(change.teamId),
                        availability_status: 'available',
                        availability_reason: null,
                        last_synced_at: new Date().toISOString(),
                      })
                      .eq('id', player.id);
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
