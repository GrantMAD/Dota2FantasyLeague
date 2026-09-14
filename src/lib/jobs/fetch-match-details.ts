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

      // Preload player and team maps for resolving IDs
      const { playerMap, teamMap } = await getEntityLookupMaps();

      // Process matches in batches
      const batchSize = 10;
      for (let i = 0; i < pendingMatches.length; i += batchSize) {
        const batch = pendingMatches.slice(i, i + batchSize);

        for (const match of batch) {
          try {
            const externalId = match.external_match_id || match.id.toString();
            // Fetch detailed stats from provider
            const details = await provider.fetchMatchDetails(externalId);
            console.log(`[fetchMatchDetails] Fetched details for match ${match.id} (external: ${externalId})`);

            // Extract player stats from nested teams structure and store in match_player_stats table
            const statsToInsert: Omit<MatchPlayerStats, 'id' | 'created_at' | 'updated_at'>[] = [];
            const supabase = getSupabaseServerClient();
            
            for (const team of details.teams || []) {
              const teamProviderId = String(team.teamId || '');
              let dbTeamId = teamMap.get(teamProviderId);
              
              // Fallback to match teams if provider team ID matches or cannot be found
              if (!dbTeamId) {
                if (teamProviderId && teamProviderId !== '0') {
                  const { data: newTeam } = await (supabase.from('professional_teams') as any)
                    .insert({
                      name: `Team ${teamProviderId}`,
                      slug: `team-${teamProviderId}`,
                      data_provider_id: teamProviderId,
                    })
                    .select('id')
                    .maybeSingle();
                  if (newTeam) {
                    dbTeamId = newTeam.id;
                    teamMap.set(teamProviderId, newTeam.id);
                  }
                }
                if (!dbTeamId) {
                  dbTeamId = match.team_a_id || match.team_b_id || 1;
                }
              }

              for (const player of team.players || []) {
                const playerProviderId = String(player.playerId || '');
                let dbPlayerId = playerMap.get(playerProviderId);

                if (!dbPlayerId && playerProviderId && playerProviderId !== '0' && playerProviderId !== 'unknown') {
                  // Check database in case player wasn't in initial in-memory chunk
                  const { data: existingPlayer } = await (supabase.from('professional_players') as any)
                    .select('id')
                    .or(`data_provider_id.eq.${playerProviderId},slug.eq.${playerProviderId}`)
                    .limit(1)
                    .maybeSingle();

                  if (existingPlayer) {
                    dbPlayerId = existingPlayer.id;
                    playerMap.set(playerProviderId, existingPlayer.id);
                  } else {
                    // Auto-register player if genuinely not in database
                    const playerName = player.heroName ? `Player (${player.heroName})` : `Player ${playerProviderId}`;
                    const { data: newPlayer } = await (supabase.from('professional_players') as any)
                      .insert({
                        name: playerName,
                        in_game_name: playerName,
                        slug: playerProviderId,
                        data_provider_id: playerProviderId,
                        primary_role: 'Carry',
                        team_id: dbTeamId,
                        availability_status: 'available',
                      })
                      .select('id')
                      .maybeSingle();

                    if (newPlayer) {
                      dbPlayerId = newPlayer.id;
                      playerMap.set(playerProviderId, newPlayer.id);
                    }
                  }
                }

                if (!dbPlayerId) {
                  // Skip player if we cannot resolve an internal database ID
                  continue;
                }

                const parseNum = (v: any): number => {
                  if (typeof v === 'number') return isNaN(v) ? 0 : Math.round(v);
                  if (typeof v === 'string') {
                    const parsed = Number(v);
                    return isNaN(parsed) ? 0 : Math.round(parsed);
                  }
                  if (typeof v === 'object' && v !== null) {
                    return Math.round(
                      Object.values(v).reduce((acc: number, item: any) => {
                        const n = Number(item);
                        return acc + (isNaN(n) ? 0 : n);
                      }, 0)
                    );
                  }
                  return 0;
                };

                const heroIdInt = parseInt(String(player.heroId || '0'), 10);

                statsToInsert.push({
                  match_id: match.id,
                  player_id: dbPlayerId,
                  team_id: dbTeamId,
                  hero_id: isNaN(heroIdInt) ? 0 : heroIdInt,
                  hero_name: player.heroName || `Hero ${player.heroId}`,
                  kills: parseNum(player.kills),
                  deaths: parseNum(player.deaths),
                  assists: parseNum(player.assists),
                  gold_per_minute: parseNum(player.goldPerMinute),
                  experience_per_minute: parseNum(player.experiencePerMinute),
                  last_hits: parseNum(player.lastHits),
                  denies: parseNum(player.denies),
                  hero_damage: parseNum(player.heroDamage),
                  tower_damage: parseNum(player.towerDamage),
                  healing: parseNum(player.healing),
                  wards_placed: parseNum(player.wardsPlaced),
                  wards_destroyed: parseNum(player.wardsDestroyed),
                  first_blood_achieved: Boolean(player.firstBloodAchieved),
                  roshan_kills: parseNum(player.roshansKilled),
                } as any);
              }
            }

            if (statsToInsert.length > 0) {
              // Delete existing stats for this match if re-fetching to prevent duplicate key conflicts
              await (supabase.from('match_player_stats') as any)
                .delete()
                .eq('match_id', match.id);

              const { error: statsError } = await (supabase.from('match_player_stats') as any)
                .insert(statsToInsert);

              if (statsError) {
                throw statsError;
              }
            }

            result.fetched++;
            result.scored += statsToInsert.length;

            // Mark match as having details fetched, and store duration / winner if available
            const updateMatchPayload: Record<string, unknown> = {
              detailed_stats_fetched_at: new Date().toISOString(),
              last_synced_at: new Date().toISOString(),
            };

            if (details.duration) {
              updateMatchPayload.duration_minutes = Math.round(details.duration / 60);
            }
            if (details.winner) {
              const winnerDbId = teamMap.get(String(details.winner));
              if (winnerDbId) {
                updateMatchPayload.winner_team_id = winnerDbId;
              }
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('matches') as any)
              .update(updateMatchPayload)
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

async function getEntityLookupMaps(): Promise<{
  playerMap: Map<string, number>;
  teamMap: Map<string, number>;
}> {
  const supabase = getSupabaseServerClient();

  const [playersRes, teamsRes] = await Promise.all([
    (supabase.from('professional_players') as any).select('id, data_provider_id'),
    (supabase.from('professional_teams') as any).select('id, data_provider_id'),
  ]);

  const playerMap = new Map<string, number>();
  for (const p of playersRes.data || []) {
    if (p.data_provider_id) {
      playerMap.set(String(p.data_provider_id), p.id);
    }
  }

  const teamMap = new Map<string, number>();
  for (const t of teamsRes.data || []) {
    if (t.data_provider_id) {
      teamMap.set(String(t.data_provider_id), t.id);
    }
  }

  return { playerMap, teamMap };
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
