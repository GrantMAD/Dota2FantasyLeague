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
import {
  resolveGameweekForMatch,
  summarizeOutOfGameweekMatches,
  type OutOfGameweekDiagnostics,
} from './match-gameweek-routing';
import {
  fetchAllTournamentMatches,
  findExistingMatchByTeamsAndTime,
  getTournamentSeriesIdentity,
  preserveMatchStatus,
  toDatabaseMatchStatus,
} from './match-sync';
import {
  findLastProcessedTournamentId,
  selectNextTournamentBatch,
} from './match-tournament-batch';

interface FetchResult {
  fetched: number;
  updated: number;
  scheduled: number;
  skippedOutsideGameweeks: number;
  skippedOutsideGameweeksPast: number;
  skippedOutsideGameweeksFuture: number;
  skippedOutsideGameweeksFutureExamples: OutOfGameweekDiagnostics['futureExamples'];
  errors: string[];
  duration: number;
  startedAt: Date;
  completedAt: Date;
  hasMore?: boolean;
  lastProcessedTournamentId?: number;
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
  tournament_id: number;
  gameweek_id: number;
  source_series_id: string | null;
  series_number: number;
  best_of: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
}

interface TeamReference {
  id: number;
  data_provider_id: string | null;
}

export async function fetchMatches(options: { tournamentLimit?: number } = {}): Promise<FetchResult> {
  const startedAt = new Date();
  const result: FetchResult = {
    fetched: 0,
    updated: 0,
    scheduled: 0,
    skippedOutsideGameweeks: 0,
    skippedOutsideGameweeksPast: 0,
    skippedOutsideGameweeksFuture: 0,
    skippedOutsideGameweeksFutureExamples: [],
    errors: [],
    duration: 0,
    startedAt,
    completedAt: new Date(),
    hasMore: false,
  };

  try {
    const { getMatchDataProvider, getOpenDotaProvider } = await import('../data-providers/provider-config');
    const providers = {
      stratz: await getMatchDataProvider(),
      opendota: getOpenDotaProvider(),
    };
    const supabase = getSupabaseServerClient();

    console.log('[fetchMatches] Starting match fetch');

    const jobExecutionId = await logJobExecution('fetch-matches', 'started');

    try {
      // 1. Get active/eligible tournaments from DB
      const eligibleTournaments = await getActiveTournaments();
      const professionalTournamentsBySource = await Promise.all(
        Object.entries(providers).map(async ([source, provider]) => [
          source,
          new Set((await provider.fetchTournaments({ limit: 100 }))
            .map((tournament) => String(tournament.id))),
        ] as const),
      );
      const professionalTournamentIds = new Map(professionalTournamentsBySource);
      const activeTournaments = eligibleTournaments.filter((tournament) => {
        const source = tournament.data_provider ?? 'stratz';
        return professionalTournamentIds.get(source)?.has(String(tournament.data_provider_id));
      });
      console.log(
        `[fetchMatches] Found ${activeTournaments.length} eligible professional tournaments; ` +
        `ignoring ${eligibleTournaments.length - activeTournaments.length} tournaments not present in their provider's professional feed`
      );

      const tournamentLimit = options.tournamentLimit ?? 1;
      if (!Number.isSafeInteger(tournamentLimit) || tournamentLimit < 1 || tournamentLimit > 4) {
        throw new Error('tournamentLimit must be an integer between 1 and 4.');
      }
      const lastProcessedTournamentId = await getLastProcessedTournamentId(supabase);
      const tournamentBatch = selectNextTournamentBatch(
        activeTournaments,
        tournamentLimit,
        lastProcessedTournamentId,
      );
      const tournamentsToProcess = tournamentBatch.tournaments;
      result.hasMore = tournamentBatch.hasMore;
      if (tournamentsToProcess.length > 0) {
        console.log(
          `[fetchMatches] tournamentLimit=${tournamentLimit}: processing ${tournamentsToProcess.length} of ` +
          `${activeTournaments.length} tournaments starting after ${lastProcessedTournamentId ?? 'the beginning'}`
        );
      }

      if (tournamentsToProcess.length === 0) {
        console.log('[fetchMatches] No active or eligible tournaments found to sync');
      }

      // Assign each provider match by its scheduled date, not by whichever
      // gameweek happens to be Active when this job runs.
      const seasonIds = [...new Set(tournamentsToProcess.map((tournament) => tournament.season_id))];
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
        if (t.data_provider_id) {
          const providerTeamId = String(t.data_provider_id);
          if (providerTeamId.startsWith('opendota:')) {
            teamIdMap.set(providerTeamId, t.id);
          } else {
            teamIdMap.set(`stratz:${providerTeamId}`, t.id);
          }
        }
        teamNameMap.set(t.id, t.name ?? '');
      }

      for (const tournament of tournamentsToProcess) {
        try {
          const providerSource = tournament.data_provider ?? 'stratz';
          const provider = providers[providerSource];
          if (!provider) {
            result.errors.push(`Unsupported data provider "${providerSource}" for tournament ${tournament.id}`);
            continue;
          }
          const tournamentGameweeks = gameweeksBySeason.get(tournament.season_id) ?? [];
          if (tournamentGameweeks.length === 0) {
            result.errors.push(
              `No configured gameweeks found for tournament ${tournament.id} in season ${tournament.season_id}`
            );
            continue;
          }

          const leagueExternalId = tournament.data_provider_id
            || (tournament.slug ? tournament.slug.split('-')[0] : tournament.id.toString());

          // Fetch matches for this tournament
          const matches = await fetchAllTournamentMatches(provider, leagueExternalId);

          console.log(
            `[fetchMatches] Tournament ${tournament.name} (${leagueExternalId}): ${matches.length} matches returned`
          );

          const outOfGameweekDiagnostics = summarizeOutOfGameweekMatches(
            matches.flatMap((match) => match.scheduledAt
              ? [{ id: match.id, status: match.status, scheduledAt: match.scheduledAt }]
              : []),
            tournamentGameweeks,
            tournament.name,
            startedAt,
            Math.max(0, 5 - result.skippedOutsideGameweeksFutureExamples.length),
          );
          result.skippedOutsideGameweeksPast += outOfGameweekDiagnostics.pastCount;
          result.skippedOutsideGameweeksFuture += outOfGameweekDiagnostics.futureCount;
          result.skippedOutsideGameweeksFutureExamples.push(...outOfGameweekDiagnostics.futureExamples);

          if (!matches || matches.length === 0) {
            continue;
          }

          const { existingMatches, allMatches, seriesByIdentity } = await getTournamentMatchState(supabase, tournament.id);
          const routedMatchIds = new Set<string>();
          const reconciledMatchIds = new Set<number>();
          let skippedOutsideGameweeks = 0;

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

              const gameweekResolution = resolveGameweekForMatch(scheduledTime, tournamentGameweeks);
              if (gameweekResolution.status === 'outside') {
                skippedOutsideGameweeks++;
                result.skippedOutsideGameweeks++;
                continue;
              }
              if (gameweekResolution.status === 'invalid-time') {
                result.errors.push(
                  `Skipped match ${match.id} for tournament ${tournament.id}: provider supplied an invalid scheduled time`
                );
                continue;
              }
              if (gameweekResolution.status === 'ambiguous') {
                result.errors.push(
                  `Skipped match ${match.id} for tournament ${tournament.id}: scheduled time ${scheduledTime} falls in overlapping configured gameweeks`
                );
                continue;
              }
              const targetGameweek = gameweekResolution.gameweek;

              const existingMatchesForId = existingMatches.get(match.id) ?? [];
              const scheduledFixtureId = match.sourceSeriesId
                ? `scheduled:${leagueExternalId}:${match.sourceSeriesId}`
                : undefined;
              const scheduledFixtureMatches = scheduledFixtureId
                ? existingMatches.get(scheduledFixtureId) ?? []
                : [];
              if (existingMatchesForId.length > 1 || (existingMatchesForId.length === 0 && scheduledFixtureMatches.length > 1)) {
                result.errors.push(
                  `Skipped match ${match.id} for tournament ${tournament.id}: multiple database rows already use this external match ID`
                );
                continue;
              }
              let existing: Match | undefined = existingMatchesForId[0] ?? scheduledFixtureMatches[0];

              // Resolve Team A
              const teamAId = await resolveOrCreateTeam(
                match.team1Id, match.team1Name, providerSource, teamIdMap, teamNameMap, provider
              );

              // Resolve Team B
              const teamBId = await resolveOrCreateTeam(
                match.team2Id, match.team2Name, providerSource, teamIdMap, teamNameMap, provider
              );

              if (!teamAId || !teamBId) {
                // Cannot insert match without both valid team references
                continue;
              }

              if (!existing) {
                const reconciliation = findExistingMatchByTeamsAndTime(
                  allMatches,
                  teamAId,
                  teamBId,
                  new Date(scheduledTime),
                  reconciledMatchIds
                );
                if (reconciliation.ambiguous) {
                  result.errors.push(
                    `Skipped match ${match.id} for tournament ${tournament.id}: multiple existing matches have the same teams and a nearby scheduled time`
                  );
                  continue;
                }
                existing = reconciliation.match ?? undefined;
              }

              const teamPair = [teamAId, teamBId].sort((a, b) => a - b);
              const seriesIdentity = getTournamentSeriesIdentity(
                providerSource,
                match.sourceSeriesId,
                targetGameweek.id,
                teamAId,
                teamBId,
                new Date(scheduledTime),
              );
              const fallbackSeriesId = getTournamentSeriesIdentity(
                providerSource,
                undefined,
                targetGameweek.id,
                teamAId,
                teamBId,
                new Date(scheduledTime),
              );
              const providerSeriesId = match.sourceSeriesId ? seriesIdentity : null;
              let seriesRecord = seriesByIdentity.get(seriesIdentity);

              if (!seriesRecord && providerSeriesId) {
                const fallbackSeries = seriesByIdentity.get(fallbackSeriesId);
                if (
                  fallbackSeries
                  && [fallbackSeries.team_a_id, fallbackSeries.team_b_id].sort((a, b) => Number(a) - Number(b)).join(':')
                    === teamPair.join(':')
                ) {
                  const { error: promoteSeriesError } = await supabase
                    .from('tournament_series')
                    .update({ source_series_id: providerSeriesId })
                    .eq('id', fallbackSeries.id);
                  if (promoteSeriesError) {
                    throw new Error(`Failed to add provider identity to series ${fallbackSeries.id}: ${promoteSeriesError.message}`);
                  }
                  seriesRecord = { ...fallbackSeries, source_series_id: providerSeriesId };
                  seriesByIdentity.delete(fallbackSeriesId);
                  seriesByIdentity.set(providerSeriesId, seriesRecord);
                }
              }

              if (seriesRecord && seriesRecord.team_a_id !== null && seriesRecord.team_b_id !== null) {
                const recordedTeams = [seriesRecord.team_a_id, seriesRecord.team_b_id].sort((a, b) => a - b);
                if (recordedTeams[0] !== teamPair[0] || recordedTeams[1] !== teamPair[1]) {
                  throw new Error(`Provider series identity ${seriesIdentity} was already assigned to different teams`);
                }
              }
              if (seriesRecord && match.bestOfSeries && seriesRecord.best_of !== match.bestOfSeries) {
                const { error: updateFormatError } = await supabase
                  .from('tournament_series')
                  .update({ best_of: match.bestOfSeries })
                  .eq('id', seriesRecord.id);
                if (updateFormatError) {
                  throw new Error(`Failed to update format for series ${seriesRecord.id}: ${updateFormatError.message}`);
                }
                seriesRecord = { ...seriesRecord, best_of: match.bestOfSeries };
                seriesByIdentity.set(seriesIdentity, seriesRecord);
              }

              if (!seriesRecord) {
                const seriesNumber = [...seriesByIdentity.values()]
                  .filter((series) => series.gameweek_id === targetGameweek.id)
                  .reduce((maximum, series) => Math.max(maximum, series.series_number), 0) + 1;
                const { data: newSeries, error: seriesError } = await supabase
                  .from('tournament_series')
                  .insert({
                    tournament_id: tournament.id,
                    gameweek_id: targetGameweek.id,
                    series_number: seriesNumber,
                    best_of: match.bestOfSeries ?? 3,
                    team_a_id: teamAId,
                    team_b_id: teamBId,
                    source_series_id: seriesIdentity,
                  })
                  .select('id, tournament_id, gameweek_id, source_series_id, series_number, best_of, team_a_id, team_b_id')
                  .single();

                if (seriesError) {
                  throw new Error(`Failed to create tournament series: ${seriesError.message}`);
                }
                seriesRecord = newSeries as SeriesReference;
                seriesByIdentity.set(seriesIdentity, seriesRecord);
              }

              const incomingStatus = toDatabaseMatchStatus(match.status);
              const status = existing
                ? preserveMatchStatus(existing.status, incomingStatus)
                : incomingStatus;
              const matchTimes = {
                ...(match.startedAt ? { start_time: match.startedAt.toISOString() } : {}),
                ...(match.endedAt ? { end_time: match.endedAt.toISOString() } : {}),
              };

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
                    external_match_id: match.id.toString(),
                    series_id: seriesRecord.id,
                    gameweek_id: targetGameweek.id,
                    status,
                    team_a_id: teamAId,
                    team_b_id: teamBId,
                    scheduled_time: scheduledTime,
                    ...matchTimes,
                    last_synced_at: new Date().toISOString(),
                  })
                  .eq('id', existing.id);
                if (updateError) {
                  throw new Error(`Failed to update match ${existing.id}: ${updateError.message}`);
                }

                existing.series_id = seriesRecord.id;
                existing.gameweek_id = targetGameweek.id;
                existing.scheduled_time = scheduledTime;
                reconciledMatchIds.add(existing.id);
                if (existing.external_match_id !== match.id.toString()) {
                  const previousExternalId = existing.external_match_id;
                  if (previousExternalId) {
                    const previousRows = existingMatches.get(previousExternalId) ?? [];
                    const remainingRows = previousRows.filter((row) => row.id !== existing.id);
                    if (remainingRows.length > 0) existingMatches.set(previousExternalId, remainingRows);
                    else existingMatches.delete(previousExternalId);
                  }
                  existing.external_match_id = match.id.toString();
                  const currentRows = existingMatches.get(match.id) ?? [];
                  if (!currentRows.some((row) => row.id === existing.id)) currentRows.push(existing);
                  existingMatches.set(match.id, currentRows);
                }
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
                    ...matchTimes,
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
                allMatches.push(insertedMatch as Match);
                reconciledMatchIds.add((insertedMatch as Match).id);
                result.fetched++;
              }
              routedMatchIds.add(match.id);
            } catch (error) {
              result.errors.push(
                `Failed to process match ${match.id}: ${(error as Error).message}`
              );
            }
          }

          if (skippedOutsideGameweeks > 0) {
            console.log(
              `[fetchMatches] Skipped ${skippedOutsideGameweeks} matches outside configured gameweeks ` +
              `for tournament ${tournament.name} (${outOfGameweekDiagnostics.pastCount} past, ` +
              `${outOfGameweekDiagnostics.futureCount} future)`
            );
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
        lastProcessedTournamentId: tournamentBatch.lastProcessedTournamentId ?? lastProcessedTournamentId,
        skippedOutsideGameweeks: result.skippedOutsideGameweeks,
        skippedOutsideGameweeksPast: result.skippedOutsideGameweeksPast,
        skippedOutsideGameweeksFuture: result.skippedOutsideGameweeksFuture,
        skippedOutsideGameweeksFutureExamples: result.skippedOutsideGameweeksFutureExamples,
        errors: result.errors.length,
      }, jobExecutionId);

      const nextCursor = tournamentBatch.lastProcessedTournamentId ?? lastProcessedTournamentId;
      if (nextCursor !== null) result.lastProcessedTournamentId = nextCursor;
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

async function getLastProcessedTournamentId(
  supabase: ReturnType<typeof getSupabaseServerClient>,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('job_execution_log')
    .select('metadata')
    .eq('job_name', 'fetch-matches')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(`Failed to load fetch-matches tournament cursor: ${error.message}`);
  }

  return findLastProcessedTournamentId(
    (data ?? []) as Array<{ metadata: unknown }>,
  );
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
  allMatches: Match[];
  seriesByIdentity: Map<string, SeriesReference>;
}> {
  const { data: rawSeriesRows, error: seriesError } = await supabase
    .from('tournament_series')
    .select('id, tournament_id, gameweek_id, source_series_id, series_number, best_of, team_a_id, team_b_id')
    .eq('tournament_id', tournamentId);

  if (seriesError) {
    throw new Error(`Failed to fetch series for tournament ${tournamentId}: ${seriesError.message}`);
  }

  const seriesRows = (rawSeriesRows ?? []) as SeriesReference[];
  const seriesByIdentity = new Map<string, SeriesReference>();
  for (const series of seriesRows) {
    if (series.source_series_id) seriesByIdentity.set(series.source_series_id, series);
  }

  const seriesIds = seriesRows.map((series) => series.id);
  const existingMatches = new Map<string, Match[]>();
  const allMatches: Match[] = [];
  if (seriesIds.length === 0) {
    return { existingMatches, allMatches, seriesByIdentity };
  }

  const { data: matchRows, error: matchesError } = await supabase
    .from('matches')
    .select('*')
    .in('series_id', seriesIds);

  if (matchesError) {
    throw new Error(`Failed to fetch matches for tournament ${tournamentId}: ${matchesError.message}`);
  }

  for (const match of (matchRows ?? []) as Match[]) {
    allMatches.push(match);
    if (match.external_match_id) {
      const rows = existingMatches.get(match.external_match_id) ?? [];
      rows.push(match);
      existingMatches.set(match.external_match_id, rows);
    }
  }

  return { existingMatches, allMatches, seriesByIdentity };
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
  teamNameFromMatch: string | undefined,
  providerSource: 'stratz' | 'opendota',
  teamIdMap: Map<string, number>,
  teamNameMap: Map<number, string>,
  provider: import('../data-providers/provider-interface').DataProvider
): Promise<number | null> {
  const INVALID_IDS = new Set(['0', 'null', 'undefined', 'nan', 'none', '']);
  if (!teamProviderId || INVALID_IDS.has(String(teamProviderId).toLowerCase())) return null;
  const pIdStr = String(teamProviderId);
  const providerKey = `${providerSource}:${pIdStr}`;
  const existingDbId = teamIdMap.get(providerKey);

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
  let teamName = teamNameFromMatch?.trim() || `Team ${pIdStr}`;
  let logoUrl: string | undefined = undefined;

  if (!teamNameFromMatch || !teamNameFromMatch.trim()) {
    try {
      const fetched = await provider.fetchTeam(pIdStr);
      if (fetched?.name && fetched.name.trim().length > 0 && !/^\d+$/.test(fetched.name)) {
        teamName = fetched.name.trim();
        logoUrl = fetched.logoUrl;
      }
    } catch {
      // Fall back to Team <id> if provider lookup fails
    }
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
    teamIdMap.set(providerKey, existingByName.id);
    return existingByName.id;
  }

  // Insert newly discovered team
  const { data: newTeamData, error } = await supabase.from('professional_teams')
    .insert({
      name: teamName,
      slug: providerSource === 'opendota' ? `opendota-team-${pIdStr}` : `team-${pIdStr}`,
      data_provider_id: providerSource === 'opendota' ? `opendota:${pIdStr}` : pIdStr,
      logo_url: logoUrl,
    })
    .select('id')
    .maybeSingle();
  const newTeam = newTeamData as { id: number } | null;

  if (newTeam) {
    teamIdMap.set(providerKey, newTeam.id);
    return newTeam.id;
  }

  if (error?.code === '23505') {
    const storedProviderId = providerSource === 'opendota' ? `opendota:${pIdStr}` : pIdStr;
    const { data: retryTeamData } = await supabase.from('professional_teams')
      .select('id')
      .or(`data_provider_id.eq.${storedProviderId},name.ilike.${teamName}`)
      .maybeSingle();
    const retryTeam = retryTeamData as { id: number } | null;
    if (retryTeam) {
      teamIdMap.set(providerKey, retryTeam.id);
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
