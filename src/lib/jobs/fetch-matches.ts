/**
 * Match Fetching Job
 * 
 * Fetches matches for active tournaments from data provider
 * and syncs them to the database
 * 
 * Run schedule: Every 15min during active season
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import { notifyLiveSquadMembers } from './live-squad-match-notifications';
import type { Match, Tournament } from '@/types/database';
import type { MatchData } from '../data-providers/provider-interface';
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
import { overlapsConfiguredGameweek } from './match-tournament-eligibility';

interface FetchResult {
  fetched: number;
  updated: number;
  scheduled: number;
  skippedOutsideGameweeks: number;
  skippedOutsideGameweekTournaments: number;
  skippedOutsideGameweeksPast: number;
  skippedOutsideGameweeksFuture: number;
  skippedOutsideGameweeksFutureExamples: OutOfGameweekDiagnostics['futureExamples'];
  errors: string[];
  duration: number;
  startedAt: Date;
  completedAt: Date;
  hasMore?: boolean;
  lastProcessedTournamentId?: number;
  liveSquadNotificationsCreated: number;
  pushNotificationsSent: number;
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
    skippedOutsideGameweekTournaments: 0,
    skippedOutsideGameweeksPast: 0,
    skippedOutsideGameweeksFuture: 0,
    skippedOutsideGameweeksFutureExamples: [],
    errors: [],
    duration: 0,
    startedAt,
    completedAt: new Date(),
    hasMore: false,
    liveSquadNotificationsCreated: 0,
    pushNotificationsSent: 0,
  };

  try {
    const { getMatchDataProvider, getOpenDotaProvider, getSteamProvider } = await import('../data-providers/provider-config');
    let steamProvider: ReturnType<typeof getSteamProvider> | undefined;
    try {
      steamProvider = getSteamProvider();
    } catch (err) {
      console.warn('[fetchMatches] Steam provider not initialized:', (err as Error).message);
    }

    const providers: Record<string, import('../data-providers/provider-interface').DataProvider | undefined> = {
      stratz: await getMatchDataProvider(),
      opendota: getOpenDotaProvider(),
      steam: steamProvider,
    };
    const supabase = getSupabaseServerClient();

    console.log('[fetchMatches] Starting match fetch');

    const jobExecutionId = await logJobExecution('fetch-matches', 'started');

    try {
      // 1. Get active/eligible tournaments from DB
      const eligibleTournaments = await getActiveTournaments();
      const seasonIds = [...new Set(eligibleTournaments.map((tournament) => tournament.season_id))];
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

      const inGameweekTournaments = eligibleTournaments.filter((tournament) =>
        overlapsConfiguredGameweek(tournament, gameweeksBySeason.get(tournament.season_id) ?? [])
      );
      result.skippedOutsideGameweekTournaments = eligibleTournaments.length - inGameweekTournaments.length;
      console.log(
        `[fetchMatches] Skipping ${result.skippedOutsideGameweekTournaments} eligible tournaments whose date ranges ` +
        'do not overlap any configured gameweek'
      );

      const providerSources = new Set<string>(
        inGameweekTournaments.map((tournament) => tournament.data_provider ?? 'stratz')
      );
      const professionalTournamentsBySource = await Promise.all(
        [...providerSources]
          .filter((source) => source !== 'steam')
          .map(async (source) => {
            const provider = providers[source];
            if (!provider) return [source, null] as const;
            try {
              const tournaments = await provider.fetchTournaments({ limit: 100 });
              return [source, new Set(tournaments.map((tournament) => String(tournament.id)))] as const;
            } catch (error) {
              console.warn(
                `[fetchMatches] Failed to refresh active tournament feed from ${source}: ${(error as Error).message}. ` +
                `Falling back to trusting configured database tournaments for ${source}.`
              );
              return [source, null] as const;
            }
          }),
      );
      const professionalTournamentIds = new Map(professionalTournamentsBySource);
      const activeTournaments = inGameweekTournaments.filter((tournament) => {
        const source = tournament.data_provider ?? 'stratz';
        if (source === 'steam') {
          return true;
        }
        const verifiedIds = professionalTournamentIds.get(source);
        // If provider feed verification threw or returned null, preserve database tournament rather than crashing or dropping
        if (!verifiedIds) {
          return true;
        }
        return verifiedIds.has(String(tournament.data_provider_id));
      });
      console.log(
        `[fetchMatches] Found ${activeTournaments.length} eligible professional tournaments; ` +
        `ignoring ${inGameweekTournaments.length - activeTournaments.length} tournaments not present in their provider's professional feed`
      );

      const tournamentLimit = options.tournamentLimit ?? 2;
      if (!Number.isSafeInteger(tournamentLimit) || tournamentLimit < 1 || tournamentLimit > 10) {
        throw new Error('tournamentLimit must be an integer between 1 and 10.');
      }
      const lastProcessedTournamentId = await getLastProcessedTournamentId(supabase);
      const tournamentBatch = selectNextTournamentBatch(
        activeTournaments,
        tournamentLimit,
        lastProcessedTournamentId,
      );
      const tournamentsToProcess = tournamentBatch.tournaments;
      const effectiveTournamentsToProcess = tournamentsToProcess;
      result.hasMore = tournamentBatch.hasMore;
      if (tournamentsToProcess.length > 0) {
        console.log(
          `[fetchMatches] tournamentLimit=${tournamentLimit}: processing ${tournamentsToProcess.length} of ` +
          `${activeTournaments.length} tournaments starting after ${lastProcessedTournamentId ?? 'the beginning'}`
        );
      }

      if (effectiveTournamentsToProcess.length === 0) {
        console.log('[fetchMatches] No active or eligible tournaments found to sync');
      }

      // 2. Pre-load professional teams map (by data_provider_id and id)
      //    Also build a name-map so we can detect stale placeholder names.
      const { data: dbTeams } = await supabase
        .from('professional_teams')
        .select('id, name, data_provider_id');
      const teamIdMap = new Map<string, number>();
      const teamNameMap = new Map<number, string>(); // id -> current name
      for (const t of dbTeams || []) {
        if (t.data_provider_id) {
          const providerTeamId = String(t.data_provider_id);
          if (providerTeamId.startsWith('opendota:')) {
            teamIdMap.set(providerTeamId, t.id);
            const rawId = providerTeamId.replace('opendota:', '');
            teamIdMap.set(`steam:${rawId}`, t.id);
            teamIdMap.set(`stratz:${rawId}`, t.id);
          } else {
            teamIdMap.set(`stratz:${providerTeamId}`, t.id);
            teamIdMap.set(`steam:${providerTeamId}`, t.id);
            teamIdMap.set(`opendota:${providerTeamId}`, t.id);
          }
        }
        teamNameMap.set(t.id, t.name ?? '');
      }

      for (const tournament of effectiveTournamentsToProcess) {
        try {
          const providerSource = tournament.data_provider ?? 'stratz';
          let provider = providers[providerSource];
          if (!provider) {
            // Gracefully fall back to OpenDota or STRATZ if primary provider (e.g. steam) is not configured
            provider = providers.opendota || providers.stratz;
            if (provider) {
              console.warn(
                `[fetchMatches] Provider "${providerSource}" unavailable for tournament ${tournament.id} (${tournament.name}); falling back to ${provider.name}`
              );
            }
          }
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
          let matches: MatchData[] = [];
          try {
            matches = await fetchAllTournamentMatches(provider, leagueExternalId);
          } catch (fetchErr) {
            if (providerSource === 'stratz' && providers.opendota) {
              console.warn(
                `[fetchMatches] STRATZ match fetch failed for tournament ${tournament.id} (${(fetchErr as Error).message}); falling back to OpenDota`
              );
              matches = await fetchAllTournamentMatches(providers.opendota, leagueExternalId);
            } else {
              throw fetchErr;
            }
          }

          // 2. Real-Time Steam Overlay (for any tournament with a numeric Valve League ID)
          // Steam API provides zero-lag live games (with draft picks & live series score)
          // and instant concluded matches directly from Valve's servers.
          if (providers.steam && /^\d+$/.test(leagueExternalId) && providerSource !== 'steam') {
            try {
              const steamMatches = await providers.steam.fetchMatches(leagueExternalId);
              if (steamMatches.length > 0) {
                const matchesMap = new Map<string, MatchData>();
                for (const m of matches) {
                  matchesMap.set(m.id, m);
                }
                let overlayCount = 0;
                for (const sm of steamMatches) {
                  const existing = matchesMap.get(sm.id);
                  if (existing) {
                    // Update existing match with real-time status and series score from Steam
                    matchesMap.set(sm.id, {
                      ...existing,
                      status: sm.status,
                      playerAccountIds: sm.playerAccountIds?.length
                        ? sm.playerAccountIds
                        : existing.playerAccountIds,
                      startedAt: sm.startedAt ?? existing.startedAt,
                      endedAt: sm.endedAt ?? existing.endedAt,
                      seriesStatus: sm.seriesStatus ?? existing.seriesStatus,
                      sourceSeriesId: sm.sourceSeriesId ?? existing.sourceSeriesId,
                      bestOfSeries: sm.bestOfSeries ?? existing.bestOfSeries,
                    });
                    overlayCount++;
                  } else {
                    // Newly discovered live or just-concluded match from Steam
                    matchesMap.set(sm.id, sm);
                    overlayCount++;
                  }
                }
                matches = Array.from(matchesMap.values());
                console.log(
                  `[fetchMatches] Steam real-time overlay: ${steamMatches.length} matches fetched ` +
                  `(${overlayCount} overlayed/added) for ${tournament.name}`
                );
              }
            } catch (steamErr) {
              console.warn(
                `[fetchMatches] Steam overlay unavailable for tournament ${tournament.id} (${(steamErr as Error).message}); proceeding with ${providerSource} feed`
              );
            }
          }

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

          const { existingMatches, allMatches, seriesByIdentity, detailedMatchIds } = await getTournamentMatchState(supabase, tournament.id);
          const routedMatchIds = new Set<string>();
          const reconciledMatchIds = new Set<number>();
          let skippedOutsideGameweeks = 0;
          const matchesToInsert: Array<{
            series_id: number;
            gameweek_id: number;
            team_a_id: number;
            team_b_id: number;
            status: Match['status'];
            scheduled_time: string;
            start_time?: string;
            end_time?: string;
            external_match_id: string;
            last_synced_at: string;
          }> = [];

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

              if (!existing && /^\d+$/.test(match.id)) {
                const { data: globalMatch } = await supabase
                  .from('matches')
                  .select('id, series_id, external_match_id')
                  .eq('external_match_id', match.id)
                  .maybeSingle();
                if (globalMatch) {
                  console.log(
                    `[fetchMatches] Skipping match ${match.id} for tournament ${tournament.id}: ` +
                    `already recorded under series ${globalMatch.series_id} (match ${globalMatch.id})`
                  );
                  continue;
                }
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

              if (!seriesRecord) {
                const candidateSeries = [...seriesByIdentity.values()].find((series) => {
                  if (series.gameweek_id !== targetGameweek.id) return false;
                  if (series.team_a_id === null || series.team_b_id === null) return false;
                  const recorded = [series.team_a_id, series.team_b_id]
                    .sort((a, b) => Number(a) - Number(b))
                    .join(':');
                  return recorded === teamPair.join(':');
                });

                if (candidateSeries) {
                  if (!providerSeriesId) {
                    seriesRecord = candidateSeries;
                  } else if (
                    candidateSeries.source_series_id?.startsWith('fallback:')
                    || !candidateSeries.source_series_id
                  ) {
                    const { error: promoteSeriesError } = await supabase
                      .from('tournament_series')
                      .update({ source_series_id: providerSeriesId })
                      .eq('id', candidateSeries.id);
                    if (promoteSeriesError) {
                      throw new Error(`Failed to add provider identity to series ${candidateSeries.id}: ${promoteSeriesError.message}`);
                    }
                    if (candidateSeries.source_series_id) {
                      seriesByIdentity.delete(candidateSeries.source_series_id);
                    }
                    seriesRecord = { ...candidateSeries, source_series_id: providerSeriesId };
                    seriesByIdentity.set(providerSeriesId, seriesRecord);
                  } else if (candidateSeries.source_series_id === providerSeriesId) {
                    seriesRecord = candidateSeries;
                  }
                }
              }

              // Safeguard 1: Split-series auto-merge.
              // When a new match arrives under a different provider series ID but belongs to the
              // same team pair in the same gameweek AND within ~3 hours of the previous series
              // ending, merge it into the existing series instead of creating a duplicate row.
              // All 5 conditions must be true to prevent false merges (e.g., UB Final + Grand Final).
              if (!seriesRecord && providerSeriesId) {
                const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
                const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
                const incomingMatchTime = new Date(scheduledTime).getTime();

                const splitCandidate = [...seriesByIdentity.values()].find((series) => {
                  // 1. Same gameweek
                  if (series.gameweek_id !== targetGameweek.id) return false;
                  // 2. Must have both teams set
                  if (series.team_a_id === null || series.team_b_id === null) return false;
                  // 3. Must have a real (non-fallback) provider series ID
                  if (!series.source_series_id || series.source_series_id.startsWith('fallback:')) return false;
                  // 4. Same team pair (sorted)
                  const recorded = [series.team_a_id, series.team_b_id]
                    .sort((a, b) => Number(a) - Number(b))
                    .join(':');
                  if (recorded !== teamPair.join(':')) return false;
                  // 5. Time proximity: new match must start within 3h of the last game in existing series
                  const seriesMatches = allMatches.filter((m) => m.series_id === series.id);
                  if (seriesMatches.length === 0) return false;
                  const latestEndTime = Math.max(
                    ...seriesMatches.map((m) =>
                      m.end_time ? new Date(m.end_time).getTime() :
                      m.start_time ? new Date(m.start_time).getTime() :
                      m.scheduled_time ? new Date(m.scheduled_time).getTime() : 0
                    )
                  );
                  if (latestEndTime === 0) return false;
                  const timeDiff = incomingMatchTime - latestEndTime;
                  return timeDiff >= -TWO_HOURS_MS && timeDiff < THREE_HOURS_MS;
                });

                if (splitCandidate) {
                  console.warn(
                    `[FetchMatches] ⚠️ Split-series detected: match ${match.id} arrives under ` +
                    `provider series ${providerSeriesId} but team pair [${teamPair.join(',')}] already has ` +
                    `series ${splitCandidate.id} (${splitCandidate.source_series_id}) in gameweek ` +
                    `${targetGameweek.id} with games ending within 3h. ` +
                    `Merging into existing series ${splitCandidate.id}. Verify manually.`
                  );
                  result.errors.push(
                    `Split-series merge: series ${splitCandidate.id} + provider ${providerSeriesId}, match ${match.id}`
                  );
                  seriesRecord = splitCandidate;
                  seriesByIdentity.set(providerSeriesId, splitCandidate);
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
                    best_of: match.bestOfSeries ?? (match.sourceSeriesId ? 3 : 1),
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

                const oldSeriesId = existing.series_id;
                const needsUpdate =
                  existing.external_match_id !== match.id.toString() ||
                  existing.series_id !== seriesRecord.id ||
                  existing.gameweek_id !== targetGameweek.id ||
                  existing.status !== status ||
                  existing.team_a_id !== teamAId ||
                  existing.team_b_id !== teamBId ||
                  existing.scheduled_time !== scheduledTime ||
                  (matchTimes.start_time !== undefined && existing.start_time !== matchTimes.start_time) ||
                  (matchTimes.end_time !== undefined && existing.end_time !== matchTimes.end_time);

                if (needsUpdate) {
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
                  result.updated++;
                }

                existing.series_id = seriesRecord.id;
                existing.gameweek_id = targetGameweek.id;
                existing.scheduled_time = scheduledTime;
                reconciledMatchIds.add(existing.id);

                if (oldSeriesId && oldSeriesId !== seriesRecord.id) {
                  const { count: remainingCount } = await supabase
                    .from('matches')
                    .select('id', { count: 'exact', head: true })
                    .eq('series_id', oldSeriesId);
                  if (remainingCount === 0) {
                    await supabase.from('tournament_series').delete().eq('id', oldSeriesId);
                    for (const [key, s] of seriesByIdentity.entries()) {
                      if (s.id === oldSeriesId) seriesByIdentity.delete(key);
                    }
                  }
                }
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
              } else {
                // Queue new match for batch insert
                matchesToInsert.push({
                  series_id: seriesRecord.id,
                  gameweek_id: targetGameweek.id,
                  team_a_id: teamAId,
                  team_b_id: teamBId,
                  status,
                  scheduled_time: scheduledTime,
                  ...matchTimes,
                  external_match_id: match.id.toString(),
                  last_synced_at: new Date().toISOString(),
                });
              }
              routedMatchIds.add(match.id);
            } catch (error) {
              result.errors.push(
                `Failed to process match ${match.id}: ${(error as Error).message}`
              );
            }
          }

          // Batch flush newly inserted matches for this tournament
          if (matchesToInsert.length > 0) {
            const BATCH_SIZE = 50;
            for (let i = 0; i < matchesToInsert.length; i += BATCH_SIZE) {
              const chunk = matchesToInsert.slice(i, i + BATCH_SIZE);
              const { data: insertedMatches, error: insertError } = await supabase
                .from('matches')
                .insert(chunk)
                .select('*');

              if (insertError) {
                result.errors.push(
                  `Failed to batch insert matches for tournament ${tournament.id}: ${insertError.message}`
                );
              } else {
                for (const insertedMatch of (insertedMatches ?? []) as Match[]) {
                  if (insertedMatch.external_match_id) {
                    const matchesForId = existingMatches.get(insertedMatch.external_match_id) ?? [];
                    matchesForId.push(insertedMatch);
                    existingMatches.set(insertedMatch.external_match_id, matchesForId);
                  }
                  allMatches.push(insertedMatch);
                  reconciledMatchIds.add(insertedMatch.id);
                  result.fetched++;
                }
              }
            }
          }

          const liveMatchNotifications = matches.flatMap((match) => {
            if (match.status !== 'live' || !match.playerAccountIds?.length) return [];
            const persistedMatch = (existingMatches.get(match.id) ?? [])
              .find((candidate) =>
                reconciledMatchIds.has(candidate.id) && candidate.status === 'in_progress'
              );
            if (!persistedMatch) return [];
            return [{
              id: persistedMatch.id,
              externalMatchId: match.id,
              playerAccountIds: match.playerAccountIds,
            }];
          });
          if (liveMatchNotifications.length > 0) {
            try {
              const notificationResult = await notifyLiveSquadMembers(supabase, liveMatchNotifications);
              result.liveSquadNotificationsCreated += notificationResult.notificationsCreated;
              result.pushNotificationsSent += notificationResult.pushNotificationsSent;
              result.errors.push(...notificationResult.errors);
            } catch (notificationError: unknown) {
              result.errors.push(
                `Failed to create live squad match notifications: ${
                  notificationError instanceof Error ? notificationError.message : 'Unknown notification error'
                }`
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

          // Concluded matches: always flip status to completed (Fix 1: decoupled from stats guard).
          // The .is('detailed_stats_fetched_at', null) guard previously blocked the status flip
          // for matches that had stats but were still in_progress due to a race condition or crash.
          const allConcludedMatchIds = matches
            .filter((match) => match.status === 'concluded' && routedMatchIds.has(match.id))
            .map((match) => match.id.toString());

          if (allConcludedMatchIds.length > 0) {
            // Always mark concluded matches as completed, regardless of stats state
            const { error: statusError } = await supabase
              .from('matches')
              .update({
                status: 'completed',
                last_synced_at: new Date().toISOString(),
              })
              .in('external_match_id', allConcludedMatchIds)
              .neq('status', 'completed');

            if (statusError) {
              result.errors.push(`Failed to mark concluded matches as completed: ${statusError.message}`);
            }

            // Separately queue only those missing detailed stats for fetch-match-details
            const needsDetailIds = allConcludedMatchIds.filter((id) => !detailedMatchIds.has(id));
            if (needsDetailIds.length > 0) {
              result.scheduled += needsDetailIds.length;
            }
          }
        } catch (error) {
          result.errors.push(
            `Failed to fetch matches for tournament ${tournament.id}: ${(error as Error).message}`
          );
        }
      }

      const nextCursor = effectiveTournamentsToProcess.length > 0
        ? effectiveTournamentsToProcess[effectiveTournamentsToProcess.length - 1].id
        : (tournamentBatch.lastProcessedTournamentId ?? lastProcessedTournamentId);

      result.hasMore = activeTournaments.length > 0 &&
        (tournamentBatch.hasMore || effectiveTournamentsToProcess.length < tournamentsToProcess.length);

      // Fix 3: Stale-live sweep — safety net for matches stuck as in_progress for >8 hours.
      // Catches any match that slipped through the tournament-batch cursor rotation.
      try {
        const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
        const { data: staleMatches, error: staleError } = await supabase
          .from('matches')
          .update({
            status: 'completed',
            last_synced_at: new Date().toISOString(),
          })
          .eq('status', 'in_progress')
          .lt('last_synced_at', eightHoursAgo)
          .select('id, external_match_id');

        if (staleError) {
          result.errors.push(`Stale-live sweep failed: ${staleError.message}`);
        } else if (staleMatches && staleMatches.length > 0) {
          console.warn(
            `[fetchMatches] Stale-live sweep completed ${staleMatches.length} orphaned in_progress match(es): ` +
            staleMatches.map((m: { id: number }) => m.id).join(', ')
          );
          result.scheduled += staleMatches.length;
        }
      } catch (sweepError) {
        result.errors.push(`Stale-live sweep threw: ${(sweepError as Error).message}`);
      }

      await logJobExecution('fetch-matches', 'completed', {
        fetched: result.fetched,
        updated: result.updated,
        scheduled: result.scheduled,
        liveSquadNotificationsCreated: result.liveSquadNotificationsCreated,
        pushNotificationsSent: result.pushNotificationsSent,
        lastProcessedTournamentId: nextCursor,
        skippedOutsideGameweeks: result.skippedOutsideGameweeks,
        skippedOutsideGameweekTournaments: result.skippedOutsideGameweekTournaments,
        skippedOutsideGameweeksPast: result.skippedOutsideGameweeksPast,
        skippedOutsideGameweeksFuture: result.skippedOutsideGameweeksFuture,
        skippedOutsideGameweeksFutureExamples: result.skippedOutsideGameweeksFutureExamples,
        errors: result.errors.length,
      }, jobExecutionId);

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
    .or('status.eq.eligible,status.eq.provisional,eligible.eq.true')
    .neq('status', 'excluded')
    .neq('status', 'archived');

  if (error) {
    throw new Error(`Failed to fetch active tournaments: ${error.message}`);
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
  detailedMatchIds: Set<string>;
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
    const detailedMatchIds = await preloadDetailedMatchIds(supabase, tournamentId);
    return { existingMatches, allMatches, seriesByIdentity, detailedMatchIds };
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

  const detailedMatchIds = await preloadDetailedMatchIds(supabase, tournamentId);
  return { existingMatches, allMatches, seriesByIdentity, detailedMatchIds };
}

/**
 * Pre-loads the set of external match IDs that already have detailed stats
 * for a given tournament (by joining through series). One query per tournament
 * instead of one query per concluded match.
 */
async function preloadDetailedMatchIds(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  tournamentId: number,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('matches')
    .select('external_match_id, tournament_series!inner(tournament_id)')
    .eq('tournament_series.tournament_id', tournamentId)
    .not('detailed_stats_fetched_at', 'is', null);

  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.external_match_id) ids.add(row.external_match_id);
  }
  return ids;
}

/**
 * Resolves a team from the in-memory map or fetches its true name/logo from the provider
 */
async function resolveOrCreateTeam(
  teamProviderId: string | number | undefined,
  teamNameFromMatch: string | undefined,
  providerSource: string,
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
      // Name is fine - return immediately
      return existingDbId;
    }
    // Name is a placeholder - fall through to provider lookup and update
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
    teamIdMap.set(`stratz:${pIdStr}`, existingByName.id);
    teamIdMap.set(`steam:${pIdStr}`, existingByName.id);
    teamIdMap.set(`opendota:${pIdStr}`, existingByName.id);
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
    teamIdMap.set(`stratz:${pIdStr}`, newTeam.id);
    teamIdMap.set(`steam:${pIdStr}`, newTeam.id);
    teamIdMap.set(`opendota:${pIdStr}`, newTeam.id);
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
      teamIdMap.set(`stratz:${pIdStr}`, retryTeam.id);
      teamIdMap.set(`steam:${pIdStr}`, retryTeam.id);
      teamIdMap.set(`opendota:${pIdStr}`, retryTeam.id);
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