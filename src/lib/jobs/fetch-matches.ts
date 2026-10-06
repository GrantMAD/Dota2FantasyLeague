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
import { findGameweekForMatch } from './match-gameweek-routing';

interface FetchResult {
  fetched: number;
  updated: number;
  scheduled: number;
  errors: string[];
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

interface GameweekReference {
  id: number;
  season_id: number;
  gameweek_number: number;
  start_date: string;
  end_date: string;
}

interface SeriesReference {
  id: number;
  gameweek_id: number;
}

interface TeamReference {
  id: number;
  data_provider_id: string | null;
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
    const supabase = getSupabaseServerClient();

    console.log('[fetchMatches] Starting match fetch');

    const jobExecutionId = await logJobExecution('fetch-matches', 'started');

    try {
      // 1. Get active/eligible tournaments from DB
      const activeTournaments = await getActiveTournaments();
      console.log(`[fetchMatches] Found ${activeTournaments.length} active tournaments`);

      if (activeTournaments.length === 0) {
        console.log('[fetchMatches] No active or eligible tournaments found to sync');
      }

      // Assign each provider match by its scheduled date, not by whichever
      // gameweek happens to be Active when this job runs.
      const seasonIds = [...new Set(activeTournaments.map((tournament) => tournament.season_id))];
      const gameweeksBySeason = new Map<number, GameweekReference[]>();
      if (seasonIds.length > 0) {
        const { data: gameweekRows, error: gameweekError } = await supabase
          .from('gameweeks')
          .select('id, season_id, gameweek_number, start_date, end_date')
          .in('season_id', seasonIds)
          .order('gameweek_number', { ascending: true });

        if (gameweekError) {
          throw new Error(`Failed to load gameweek date ranges for match assignment: ${gameweekError.message}`);
        }

        for (const gameweek of (gameweekRows ?? []) as GameweekReference[]) {
          const seasonGameweeks = gameweeksBySeason.get(gameweek.season_id) ?? [];
          seasonGameweeks.push(gameweek);
          gameweeksBySeason.set(gameweek.season_id, seasonGameweeks);
        }
      }

      // 2. Pre-load professional teams map (by data_provider_id and id)
      //    Also build a name-map so we can detect stale placeholder names.
      const { data: dbTeams } = await supabase
        .from('professional_teams')
        .select('id, name, data_provider_id');
      const teamIdMap = new Map<string, number>();
      const teamNameMap = new Map<number, string>(); // id → current name
      for (const t of dbTeams || []) {
        if (t.data_provider_id) teamIdMap.set(String(t.data_provider_id), t.id);
        teamIdMap.set(String(t.id), t.id);
        teamNameMap.set(t.id, t.name ?? '');
      }

      for (const tournament of activeTournaments) {
        try {
          const tournamentGameweeks = gameweeksBySeason.get(tournament.season_id) ?? [];
          if (tournamentGameweeks.length === 0) {
            result.errors.push(
              `No configured gameweeks found for tournament ${tournament.id} in season ${tournament.season_id}`
            );
            continue;
          }

          // Extract provider league id from slug if present (e.g. "20145-res-unchained" -> "20145")
          const leagueExternalId = tournament.slug ? tournament.slug.split('-')[0] : tournament.id.toString();

          // Fetch matches for this tournament
          const matches = await provider.fetchMatches(leagueExternalId, {
            status: 'scheduled',
            limit: 100,
          });

          console.log(
            `[fetchMatches] Tournament ${tournament.name} (${leagueExternalId}): ${matches.length} matches returned`
          );

          if (!matches || matches.length === 0) {
            continue;
          }

          const { existingMatches, seriesByGameweek } = await getTournamentMatchState(supabase, tournament.id);
          const routedMatchIds = new Set<string>();

          // Process matches
          for (const match of matches) {
            try {
              const scheduledTime = match.scheduledAt
                ? new Date(match.scheduledAt).toISOString()
                : null;
              if (!scheduledTime) {
                result.errors.push(
                  `Skipped match ${match.id} for tournament ${tournament.id}: provider did not supply a scheduled time`
                );
                continue;
              }

              const targetGameweek = findGameweekForMatch(scheduledTime, tournamentGameweeks);
              if (!targetGameweek) {
                result.errors.push(
                  `Skipped match ${match.id} for tournament ${tournament.id}: scheduled time ${scheduledTime} does not fall in exactly one configured gameweek`
                );
                continue;
              }

              const existingMatchesForId = existingMatches.get(match.id) ?? [];
              if (existingMatchesForId.length > 1) {
                result.errors.push(
                  `Skipped match ${match.id} for tournament ${tournament.id}: multiple database rows already use this external match ID`
                );
                continue;
              }
              const existing = existingMatchesForId[0];

              // Resolve Team A
              const teamAId = await resolveOrCreateTeam(match.team1Id, teamIdMap, teamNameMap, provider);

              // Resolve Team B
              const teamBId = await resolveOrCreateTeam(match.team2Id, teamIdMap, teamNameMap, provider);

              if (!teamAId || !teamBId) {
                // Cannot insert match without both valid team references
                continue;
              }

              let seriesRecord = seriesByGameweek.get(targetGameweek.id);
              if (!seriesRecord) {
                const { data: newSeries, error: seriesError } = await supabase
                  .from('tournament_series')
                  .insert({
                    tournament_id: tournament.id,
                    gameweek_id: targetGameweek.id,
                    series_number: 1,
                    best_of: 3,
                  })
                  .select('id, gameweek_id')
                  .single();

                if (seriesError) {
                  throw new Error(`Failed to create tournament series: ${seriesError.message}`);
                }
                seriesRecord = newSeries as SeriesReference;
                seriesByGameweek.set(targetGameweek.id, seriesRecord);
              }

              const status = match.status === 'concluded' ? 'completed' : 'scheduled';

              if (existing) {
                const oldGameweekId = existing.gameweek_id;
                if (oldGameweekId !== targetGameweek.id) {
                  const { error: performanceError } = await supabase
                    .from('player_performances')
                    .update({ gameweek_id: targetGameweek.id })
                    .eq('match_id', existing.id);
                  if (performanceError) {
                    throw new Error(
                      `Failed to reassign player performances for match ${existing.id}: ${performanceError.message}`
                    );
                  }
                }

                const { error: updateError } = await supabase
                  .from('matches')
                  .update({
                    series_id: seriesRecord.id,
                    gameweek_id: targetGameweek.id,
                    status,
                    team_a_id: teamAId,
                    team_b_id: teamBId,
                    scheduled_time: scheduledTime,
                    last_synced_at: new Date().toISOString(),
                  })
                  .eq('id', existing.id);
                if (updateError) {
                  throw new Error(`Failed to update match ${existing.id}: ${updateError.message}`);
                }

                existing.series_id = seriesRecord.id;
                existing.gameweek_id = targetGameweek.id;
                existing.scheduled_time = scheduledTime;
                result.updated++;
              } else {
                // Insert new match into database
                const { data: insertedMatch, error } = await supabase
                  .from('matches')
                  .insert({
                    series_id: seriesRecord.id,
                    gameweek_id: targetGameweek.id,
                    team_a_id: teamAId,
                    team_b_id: teamBId,
                    status,
                    scheduled_time: scheduledTime,
                    external_match_id: match.id.toString(),
                    last_synced_at: new Date().toISOString(),
                  })
                  .select('*')
                  .single();

                if (error) {
                  throw error;
                }
                const matchesForId = existingMatches.get(match.id) ?? [];
                matchesForId.push(insertedMatch as Match);
                existingMatches.set(match.id, matchesForId);
                result.fetched++;
              }
              routedMatchIds.add(match.id);
            } catch (error) {
              result.errors.push(
                `Failed to process match ${match.id}: ${(error as Error).message}`
              );
            }
          }

          // Concluded matches queue for detailed fantasy breakdown
          const concludedMatches = matches.filter(
            (match) => match.status === 'concluded' && routedMatchIds.has(match.id),
          );
          for (const match of concludedMatches) {
            try {
              const hasDetails = await checkMatchDetails(match.id);
              if (!hasDetails) {
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
              // Non-critical, continue
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
    .or('status.eq.eligible,status.eq.provisional,eligible.eq.true');

  if (error) {
    console.warn(`Failed to fetch active tournaments: ${error.message}`);
    return [];
  }

  return data || [];
}

async function getTournamentMatchState(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  tournamentId: number,
): Promise<{
  existingMatches: Map<string, Match[]>;
  seriesByGameweek: Map<number, SeriesReference>;
}> {
  const { data: rawSeriesRows, error: seriesError } = await supabase
    .from('tournament_series')
    .select('id, gameweek_id')
    .eq('tournament_id', tournamentId);

  if (seriesError) {
    throw new Error(`Failed to fetch series for tournament ${tournamentId}: ${seriesError.message}`);
  }

  const seriesRows = (rawSeriesRows ?? []) as SeriesReference[];
  const seriesByGameweek = new Map<number, SeriesReference>();
  for (const series of seriesRows) {
    if (!seriesByGameweek.has(series.gameweek_id)) {
      seriesByGameweek.set(series.gameweek_id, series);
    }
  }

  const seriesIds = seriesRows.map((series) => series.id);
  const existingMatches = new Map<string, Match[]>();
  if (seriesIds.length === 0) {
    return { existingMatches, seriesByGameweek };
  }

  const { data: matchRows, error: matchesError } = await supabase
    .from('matches')
    .select('*')
    .in('series_id', seriesIds);

  if (matchesError) {
    throw new Error(`Failed to fetch matches for tournament ${tournamentId}: ${matchesError.message}`);
  }

  for (const match of (matchRows ?? []) as Match[]) {
    if (!match.external_match_id) continue;
    const rows = existingMatches.get(match.external_match_id) ?? [];
    rows.push(match);
    existingMatches.set(match.external_match_id, rows);
  }

  return { existingMatches, seriesByGameweek };
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

/**
 * Resolves a team from the in-memory map or fetches its true name/logo from the provider
 */
async function resolveOrCreateTeam(
  teamProviderId: string | number | undefined,
  teamIdMap: Map<string, number>,
  teamNameMap: Map<number, string>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any
): Promise<number | null> {
  const INVALID_IDS = new Set(['0', 'null', 'undefined', 'nan', 'none', '']);
  if (!teamProviderId || INVALID_IDS.has(String(teamProviderId).toLowerCase())) return null;
  const pIdStr = String(teamProviderId);
  const existingDbId = teamIdMap.get(pIdStr);

  // If we already have a DB record for this provider ID, check whether its name
  // is still a placeholder (e.g. "Team 124"). If so, try to enrich it.
  if (existingDbId !== undefined) {
    const currentName = teamNameMap.get(existingDbId) ?? '';
    const isPlaceholder = /^Team \d+$/.test(currentName) || currentName === 'Team null' || currentName === '';
    if (!isPlaceholder) {
      // Name is fine — return immediately
      return existingDbId;
    }
    // Name is a placeholder — fall through to provider lookup and update
  }

  const supabase = getSupabaseServerClient();
  let teamName = `Team ${pIdStr}`;
  let logoUrl: string | undefined = undefined;

  try {
    const fetched = await provider.fetchTeam(pIdStr);
    if (fetched?.name && fetched.name.trim().length > 0 && !/^\d+$/.test(fetched.name)) {
      teamName = fetched.name.trim();
      logoUrl = fetched.logoUrl;
    }
  } catch {
    // Fall back to Team <id> if provider lookup fails
  }

  // If we have an existing DB id and just retrieved the real name, update it
  if (existingDbId !== undefined) {
    const currentName = teamNameMap.get(existingDbId) ?? '';
    // Only update if the new name is a genuine improvement (not still a placeholder)
    if (teamName !== currentName && !/^Team \d+$/.test(teamName) && teamName !== 'Team null') {
      await supabase.from('professional_teams')
        .update({ name: teamName, logo_url: logoUrl })
        .eq('id', existingDbId);
      teamNameMap.set(existingDbId, teamName);
      console.log(`[fetchMatches] Updated placeholder team ${existingDbId} name to "${teamName}"`);
    }
    return existingDbId;
  }

  // Check if team with this name already exists in database
  const { data: existingByNameData } = await supabase.from('professional_teams')
    .select('id, data_provider_id')
    .ilike('name', teamName)
    .maybeSingle();
  const existingByName = existingByNameData as TeamReference | null;

  if (existingByName) {
    teamIdMap.set(pIdStr, existingByName.id);
    return existingByName.id;
  }

  // Insert newly discovered team
  const { data: newTeamData, error } = await supabase.from('professional_teams')
    .insert({
      name: teamName,
      slug: `team-${pIdStr}`,
      data_provider_id: pIdStr,
      logo_url: logoUrl,
    })
    .select('id')
    .maybeSingle();
  const newTeam = newTeamData as { id: number } | null;

  if (newTeam) {
    teamIdMap.set(pIdStr, newTeam.id);
    return newTeam.id;
  }

  if (error?.code === '23505') {
    const { data: retryTeamData } = await supabase.from('professional_teams')
      .select('id')
      .or(`data_provider_id.eq.${pIdStr},name.ilike.${teamName}`)
      .maybeSingle();
    const retryTeam = retryTeamData as { id: number } | null;
    if (retryTeam) {
      teamIdMap.set(pIdStr, retryTeam.id);
      return retryTeam.id;
    }
  }

  return null;
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
