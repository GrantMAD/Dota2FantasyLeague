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

      // 2. Resolve active gameweek (or default to GW 1 if none is active)
      let { data: currentGameweek } = await (supabase.from('gameweeks') as any)
        .select('id, season_id')
        .eq('status', 'active')
        .order('gameweek_number', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!currentGameweek) {
        const { data: latestGw } = await (supabase.from('gameweeks') as any)
          .select('id, season_id')
          .order('id', { ascending: true })
          .limit(1)
          .maybeSingle();
        currentGameweek = latestGw;
      }

      // Fallback gameweek creation if table is completely empty
      if (!currentGameweek) {
        let seasonId = 1;
        const { data: defaultSeason } = await supabase
          .from('seasons')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (defaultSeason) seasonId = defaultSeason.id;

        const { data: newGw } = await supabase
          .from('gameweeks')
          .insert({
            season_id: seasonId,
            gameweek_number: 1,
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            deadline: new Date().toISOString(),
          })
          .select('id, season_id')
          .single();
        currentGameweek = newGw;
      }

      const gameweekId = currentGameweek?.id || 1;

      // 3. Pre-load professional teams map (by data_provider_id and id)
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

          // Ensure a tournament_series record exists for this tournament & gameweek
          let { data: seriesRecord } = await (supabase.from('tournament_series') as any)
            .select('id')
            .eq('tournament_id', tournament.id)
            .eq('gameweek_id', gameweekId)
            .limit(1)
            .maybeSingle();

          if (!seriesRecord) {
            const { data: newSeries, error: seriesError } = await supabase
              .from('tournament_series')
              .insert({
                tournament_id: tournament.id,
                gameweek_id: gameweekId,
                series_number: 1,
                best_of: 3,
              })
              .select('id')
              .single();

            if (seriesError) {
              console.warn(`[fetchMatches] Failed to create tournament_series: ${seriesError.message}`);
              continue;
            }
            seriesRecord = newSeries;
          }

          const seriesId = seriesRecord?.id;
          if (!seriesId) continue;

          // Preload existing matches for this series / external IDs
          const existingMatches = await getExistingMatches(seriesId);

          // Process matches
          for (const match of matches) {
            try {
              const existing = existingMatches.get(match.id);

              // Resolve Team A
              const teamAId = await resolveOrCreateTeam(match.team1Id, teamIdMap, teamNameMap, provider);

              // Resolve Team B
              const teamBId = await resolveOrCreateTeam(match.team2Id, teamIdMap, teamNameMap, provider);

              if (!teamAId || !teamBId) {
                // Cannot insert match without both valid team references
                continue;
              }

              const status = match.status === 'concluded' ? 'completed' : 'scheduled';
              const scheduledTime = match.scheduledAt ? new Date(match.scheduledAt).toISOString() : new Date().toISOString();

              if (existing) {
                // Update existing match — also correct team IDs in case they were
                // originally stored as placeholder / bad values (e.g. both sides = 124).
                await supabase
                  .from('matches')
                  .update({
                    status,
                    team_a_id: teamAId,
                    team_b_id: teamBId,
                    last_synced_at: new Date().toISOString(),
                  })
                  .eq('id', existing.id);
                result.updated++;
              } else {
                // Insert new match into database
                const { error } = await supabase
                  .from('matches')
                  .insert({
                    series_id: seriesId,
                    gameweek_id: gameweekId,
                    team_a_id: teamAId,
                    team_b_id: teamBId,
                    status,
                    scheduled_time: scheduledTime,
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

          // Concluded matches queue for detailed fantasy breakdown
          const concludedMatches = matches.filter(m => m.status === 'concluded');
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

async function getExistingMatches(seriesId: number): Promise<Map<string, Match>> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('series_id', seriesId);

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
      await (supabase.from('professional_teams') as any)
        .update({ name: teamName, logo_url: logoUrl })
        .eq('id', existingDbId);
      teamNameMap.set(existingDbId, teamName);
      console.log(`[fetchMatches] Updated placeholder team ${existingDbId} name to "${teamName}"`);
    }
    return existingDbId;
  }

  // Check if team with this name already exists in database
  const { data: existingByName } = await (supabase.from('professional_teams') as any)
    .select('id, data_provider_id')
    .ilike('name', teamName)
    .maybeSingle();

  if (existingByName) {
    teamIdMap.set(pIdStr, existingByName.id);
    return existingByName.id;
  }

  // Insert newly discovered team
  const { data: newTeam, error } = await (supabase.from('professional_teams') as any)
    .insert({
      name: teamName,
      slug: `team-${pIdStr}`,
      data_provider_id: pIdStr,
      logo_url: logoUrl,
    })
    .select('id')
    .maybeSingle();

  if (newTeam) {
    teamIdMap.set(pIdStr, newTeam.id);
    return newTeam.id;
  }

  if (error?.code === '23505') {
    const { data: retryTeam } = await (supabase.from('professional_teams') as any)
      .select('id')
      .or(`data_provider_id.eq.${pIdStr},name.ilike.${teamName}`)
      .maybeSingle();
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
