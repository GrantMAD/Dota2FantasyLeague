import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';
import { getTeamDisplayTag } from '@/lib/team-tag';
import { getPlayerIdentityKeys } from '@/lib/jobs/player-identity';


interface RouteContext {
  params: Promise<{ id: string }>;
}

interface MatchRecord {
  [column: string]: unknown;
  id: number;
  status: string;
  scheduled_time: string;
  duration_minutes: number | null;
  match_number: number | null;
  gameweek_id: number | null;
  series_id: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  winner_team_id: number | null;
}

interface TeamRecord {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  region: string | null;
}

interface SeriesRecord {
  id: number;
  tournament_id: number | null;
  best_of: number | null;
  series_number: number | null;
}

interface SeriesMatchRecord {
  id: number;
  status: string;
  scheduled_time: string;
  duration_minutes: number | null;
  match_number: number | null;
  gameweek_id: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  winner_team_id: number | null;
}

interface TournamentRecord {
  id: number;
  name: string;
  slug: string;
  tier: string | null;
}

interface GameweekRecord {
  id: number;
  gameweek_number: number;
  status: string;
  season_id: number;
}

interface FantasyPointsRecord {
  combat_points: number | null;
  economy_points: number | null;
  objective_points: number | null;
  teamfight_points: number | null;
  win_points: number | null;
  series_points: number | null;
  performance_index_points: number | null;
  consistency_points: number | null;
  penalty_points: number | null;
  total_points: number | null;
}

interface PerformanceRecord {
  match_id?: number;
  player_id: number;
  fantasy_points_breakdown: FantasyPointsRecord | FantasyPointsRecord[] | null;
}

/**
 * GET /api/matches/[id]
 * Returns a single match with full per-player stats and substitutions.
 */
async function getHandler(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const matchId = parseInt(params.id, 10);
    if (isNaN(matchId)) {
      return NextResponse.json({ error: 'Invalid match ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Fetch match details using the current schema.
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('id, status, scheduled_time, duration_minutes, match_number, gameweek_id, series_id, team_a_id, team_b_id, winner_team_id')
      .eq('id', matchId)
      .maybeSingle();
    const matchRecord = matchData as MatchRecord | null;

    if (matchError) {
      return NextResponse.json(
        { error: 'Failed to fetch match.', details: matchError.message },
        { status: 500 }
      );
    }

    if (!matchRecord) {
      return NextResponse.json({ error: 'Match not found.' }, { status: 404 });
    }

    const [{ data: teams }, { data: series }] = await Promise.all([
      supabase.from('professional_teams')
        .select('id, name, slug, logo_url, region')
        .in('id', [matchRecord.team_a_id, matchRecord.team_b_id].filter((id): id is number => id !== null)),
      supabase.from('tournament_series')
        .select('id, tournament_id, best_of, series_number')
        .eq('id', matchRecord.series_id)
        .maybeSingle(),
    ]);
      const teamRows = (teams ?? []) as TeamRecord[];
      const seriesRecord = series as SeriesRecord | null;
      let seriesMatches: SeriesMatchRecord[] = [{
        id: matchRecord.id,
        status: matchRecord.status,
        scheduled_time: matchRecord.scheduled_time,
        duration_minutes: matchRecord.duration_minutes,
        match_number: matchRecord.match_number ?? null,
        gameweek_id: matchRecord.gameweek_id,
        team_a_id: matchRecord.team_a_id,
        team_b_id: matchRecord.team_b_id,
        winner_team_id: matchRecord.winner_team_id,
      }];
      let seriesScore: {
        radiantWins: number;
        direWins: number;
        clinchedTeamId: number | null;
      } | null = null;

      if (seriesRecord) {
        const { data: seriesMatchesData, error: seriesMatchesError } = await supabase
          .from('matches')
          .select('id, status, scheduled_time, duration_minutes, match_number, gameweek_id, team_a_id, team_b_id, winner_team_id')
          .eq('series_id', seriesRecord.id)
          .order('scheduled_time', { ascending: true });

        if (seriesMatchesError) {
          console.error('Failed to fetch match series results:', seriesMatchesError);
          return NextResponse.json({ error: 'Failed to fetch match series results.' }, { status: 500 });
        }

        const queriedSeriesMatches = (seriesMatchesData ?? []) as SeriesMatchRecord[];
        const matchHasTeams = matchRecord.team_a_id !== null && matchRecord.team_b_id !== null;
        const matchTeamIds = matchHasTeams
          ? [matchRecord.team_a_id, matchRecord.team_b_id].sort((a, b) => Number(a) - Number(b))
          : null;
        const scopedSeriesMatches = queriedSeriesMatches.filter((seriesMatch) => {
          if (seriesMatch.gameweek_id !== matchRecord.gameweek_id) return false;
          if (!matchTeamIds || seriesMatch.team_a_id === null || seriesMatch.team_b_id === null) return true;
          const seriesTeamIds = [seriesMatch.team_a_id, seriesMatch.team_b_id].sort((a, b) => a - b);
          return seriesTeamIds[0] === matchTeamIds[0] && seriesTeamIds[1] === matchTeamIds[1];
        });
        seriesMatches = scopedSeriesMatches.some((seriesMatch) => seriesMatch.id === matchRecord.id)
          ? scopedSeriesMatches
          : seriesMatches;
        const completedMatches = seriesMatches.filter((seriesMatch) => seriesMatch.status === 'completed');
        const radiantWins = matchRecord.team_a_id === null
          ? 0
          : completedMatches.filter((seriesMatch) => seriesMatch.winner_team_id === matchRecord.team_a_id).length;
        const direWins = matchRecord.team_b_id === null
          ? 0
          : completedMatches.filter((seriesMatch) => seriesMatch.winner_team_id === matchRecord.team_b_id).length;
        const clinchThreshold = Math.floor((seriesRecord.best_of || 3) / 2) + 1;

        seriesScore = {
          radiantWins,
          direWins,
          clinchedTeamId: radiantWins >= clinchThreshold
            ? matchRecord.team_a_id
            : direWins >= clinchThreshold
              ? matchRecord.team_b_id
              : null,
        };
        const selectedGame = seriesMatches.find((seriesMatch) => seriesMatch.id === matchRecord.id);
        matchRecord.match_number = selectedGame?.match_number
          ?? Math.max(1, seriesMatches.findIndex((seriesMatch) => seriesMatch.id === matchRecord.id) + 1);
      }

        const { data: tournamentData } = seriesRecord?.tournament_id
        ? await supabase.from('tournaments').select('id, name, slug, tier').eq('id', seriesRecord.tournament_id).maybeSingle()
      : { data: null };
      const tournament = tournamentData as TournamentRecord | null;
      const { data: gameweekData } = await supabase.from('gameweeks')
      .select('id, gameweek_number, status, season_id')
      .eq('id', matchRecord.gameweek_id)
      .maybeSingle();
      const gameweek = gameweekData as GameweekRecord | null;

      const teamById = new Map(teamRows.map((team) => [team.id, team] as const));
      const buildTeam = (teamId: number | null) => {
        if (teamId === null) return null;
      const team = teamById.get(teamId);
      return team ? { ...team, tag: getTeamDisplayTag(team.name) } : null;
    };
    const match = {
      ...matchRecord,
      status: matchRecord.status === 'in_progress' ? 'live' : matchRecord.status,
      best_of: seriesRecord?.best_of || 3,
      series_number: seriesRecord?.series_number || 1,
      scheduled_at: matchRecord.scheduled_time,
      duration_seconds: matchRecord.duration_minutes ? matchRecord.duration_minutes * 60 : null,
      radiant_team_id: matchRecord.team_a_id,
      dire_team_id: matchRecord.team_b_id,
      radiant_team: buildTeam(matchRecord.team_a_id),
      dire_team: buildTeam(matchRecord.team_b_id),
      tournaments: tournament,
      gameweeks: gameweek,
    };

    const seriesMatchIds = seriesMatches.map((seriesMatch) => seriesMatch.id);
    // The generated local schema does not include this table.
    const { data: playerStatsData, error: playerStatsError } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('match_player_stats') as any)
      .select(`
        *,
        hero_name,
        professional_players(id, name, in_game_name, primary_role, profile_image_url, data_provider_id)
      `)
      .in('match_id', seriesMatchIds)
      .order('team_id', { ascending: true });
    if (playerStatsError) {
      console.error('Failed to fetch series player stats:', playerStatsError);
      return NextResponse.json({ error: 'Failed to fetch series player stats.' }, { status: 500 });
    }

    const seriesPlayerStats = (playerStatsData ?? []).map((stat: Record<string, unknown> & {
      match_id?: number;
      player_id: number;
      professional_players?: { data_provider_id?: string | null } | null;
    }) => ({
      ...stat,
      match_id: stat.match_id ?? matchId,
      series_player_key: getPlayerIdentityKeys(stat.professional_players?.data_provider_id)[0]
        ?? `player:${stat.player_id}`,
    }));
    const playerStatsByMatch = new Map<number, typeof seriesPlayerStats>();
    for (const stat of seriesPlayerStats) {
      const gameStats = playerStatsByMatch.get(stat.match_id) ?? [];
      gameStats.push(stat);
      playerStatsByMatch.set(stat.match_id, gameStats);
    }
    const playerStats = playerStatsByMatch.get(matchId) ?? [];

    // fantasy_points_breakdown has no match_id column — it joins via performance_id -> player_performances.
    // Fetch all series performances, then flatten them into per-game breakdowns.
    const { data: performanceData, error: performanceError } = await supabase
      .from('player_performances')
      .select('id, match_id, player_id, fantasy_points_breakdown(combat_points, economy_points, objective_points, teamfight_points, win_points, series_points, performance_index_points, consistency_points, penalty_points, total_points)')
      .in('match_id', seriesMatchIds);
    if (performanceError) {
      console.error('Failed to fetch series fantasy breakdowns:', performanceError);
      return NextResponse.json({ error: 'Failed to fetch series fantasy breakdowns.' }, { status: 500 });
    }

    const performances = (performanceData ?? []) as PerformanceRecord[];
    const fantasyBreakdownByMatch = new Map<number, Array<{ player_id: number } & FantasyPointsRecord>>();
    for (const performance of performances) {
      const breakdown = Array.isArray(performance.fantasy_points_breakdown)
        ? performance.fantasy_points_breakdown[0]
        : performance.fantasy_points_breakdown;
      if (!breakdown) continue;
      const performanceMatchId = performance.match_id ?? matchId;
      const matchBreakdown = fantasyBreakdownByMatch.get(performanceMatchId) ?? [];
      matchBreakdown.push({ player_id: performance.player_id, ...breakdown });
      fantasyBreakdownByMatch.set(performanceMatchId, matchBreakdown);
    }
    const fantasyBreakdown = fantasyBreakdownByMatch.get(matchId) ?? [];
    const seriesGames = seriesMatches.map((seriesMatch, index) => ({
      id: seriesMatch.id,
      status: seriesMatch.status === 'in_progress' ? 'live' : seriesMatch.status,
      scheduled_at: seriesMatch.scheduled_time,
      duration_seconds: seriesMatch.duration_minutes ? seriesMatch.duration_minutes * 60 : null,
      winner_team_id: seriesMatch.winner_team_id,
      radiant_team_id: seriesMatch.team_a_id,
      dire_team_id: seriesMatch.team_b_id,
      match_number: seriesMatch.match_number ?? index + 1,
      playerStats: playerStatsByMatch.get(seriesMatch.id) ?? [],
      fantasyBreakdown: fantasyBreakdownByMatch.get(seriesMatch.id) ?? [],
    }));

    // Fetch substitutions
    const { data: substitutions } = await supabase
      .from('match_player_substitutions')
      .select(`
        id,
        rostered_player_id,
        stand_in_player_id,
        rostered_player:professional_players!match_player_substitutions_rostered_player_id_fkey(id, name),
        stand_in_player:professional_players!match_player_substitutions_stand_in_player_id_fkey(id, name)
      `)
      .eq('match_id', matchId);

    // Optional user fantasy context enrichment if user is authenticated
    let userFantasyImpact: {
      userOwnedPlayerIds: number[];
      tripleCaptainActive: boolean;
      lineupDetails: Array<{
        playerId: number;
        slot: string;
        isCaptain: boolean;
        isViceCaptain: boolean;
        isStarter: boolean;
      }>;
    } | null = null;

    try {
      const authHeader = request.headers.get('authorization');
      const cookieHeader = request.headers.get('cookie') ?? '';
      if (authHeader || cookieHeader.includes('sb-auth-token')) {
        const { verifyAuth } = await import('@/lib/auth-utils');
        const user = await verifyAuth(request);
        if (user?.userId && matchRecord.gameweek_id) {
          // Find the user's fantasy season for this gameweek's tournament season
          const { data: fantasySeasonData } = await supabase
            .from('fantasy_seasons')
            .select('id, triple_captain_gameweek_id')
            .eq('user_id', user.userId)
            .eq('season_id', gameweek?.season_id)
            .limit(1);

          const fantasySeason = fantasySeasonData?.[0];
          if (fantasySeason?.id) {
            // Find lineup for this gameweek
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: lineupRow } = await (supabase.from('fantasy_lineups') as any)
              .select('carry_id, mid_id, offlane_id, support_id, hard_support_id, bench_1_id, bench_2_id, bench_3_id, captain_player_id, vice_captain_player_id')
              .eq('fantasy_season_id', fantasySeason.id)
              .eq('gameweek_id', matchRecord.gameweek_id)
              .maybeSingle();

            // Squad members link to the squad, not directly to the fantasy season.
            const { data: squad, error: squadError } = await supabase
              .from('fantasy_squads')
              .select('id')
              .eq('fantasy_season_id', fantasySeason.id)
              .maybeSingle();
            if (squadError) throw squadError;

            // Find active squad members
            const { data: squadMembers, error: membersError } = squad?.id
              ? await supabase
                .from('fantasy_squad_members')
                .select('player_id, removed_date')
                .eq('squad_id', squad.id)
              : { data: [], error: null };
            if (membersError) throw membersError;

            const ownedIds = (squadMembers ?? [])
              .filter((member: { removed_date: string | null }) => !member.removed_date)
              .map((member: { player_id: number }) => member.player_id);
            const { data: ownedPlayers, error: ownedPlayersError } = ownedIds.length > 0
              ? await supabase
                .from('professional_players')
                .select('id, data_provider_id')
                .in('id', ownedIds)
              : { data: [], error: null };
            if (ownedPlayersError) throw ownedPlayersError;

            const identityByOwnedId = new Map<number, string[]>(
              (ownedPlayers ?? []).map((player: { id: number; data_provider_id: string | null }) => [
                player.id,
                getPlayerIdentityKeys(player.data_provider_id),
              ]),
            );
            const matchPlayerIdsByIdentity = new Map<string, Set<number>>();
            for (const stat of seriesPlayerStats) {
              const providerId = stat.professional_players?.data_provider_id;
              for (const identity of getPlayerIdentityKeys(providerId)) {
                const playerIds = matchPlayerIdsByIdentity.get(identity) ?? new Set<number>();
                playerIds.add(Number(stat.player_id));
                matchPlayerIdsByIdentity.set(identity, playerIds);
              }
            }
            const matchedOwnedPlayerIds = ownedIds.flatMap((playerId: number) => (
              (identityByOwnedId.get(playerId) ?? []).flatMap((identity: string) => (
                [...(matchPlayerIdsByIdentity.get(identity) ?? [])]
              ))
            ));

            const lineupDetails: Array<{
              playerId: number;
              slot: string;
              isCaptain: boolean;
              isViceCaptain: boolean;
              isStarter: boolean;
            }> = [];

            if (lineupRow) {
              const starterSlots: Array<[string, number | null]> = [
                ['Carry', lineupRow.carry_id],
                ['Mid', lineupRow.mid_id],
                ['Offlane', lineupRow.offlane_id],
                ['Support', lineupRow.support_id],
                ['Hard Support', lineupRow.hard_support_id],
              ];
              const benchSlots: Array<[string, number | null]> = [
                ['Bench 1', lineupRow.bench_1_id],
                ['Bench 2', lineupRow.bench_2_id],
                ['Bench 3', lineupRow.bench_3_id],
              ];

              for (const [slot, pId] of starterSlots) {
                if (pId) {
                  lineupDetails.push({
                    playerId: pId,
                    slot,
                    isCaptain: lineupRow.captain_player_id === pId,
                    isViceCaptain: lineupRow.vice_captain_player_id === pId,
                    isStarter: true,
                  });
                }
              }
              for (const [slot, pId] of benchSlots) {
                if (pId) {
                  lineupDetails.push({
                    playerId: pId,
                    slot,
                    isCaptain: false,
                    isViceCaptain: false,
                    isStarter: false,
                  });
                }
              }
            }

            userFantasyImpact = {
              userOwnedPlayerIds: [...new Set([...ownedIds, ...matchedOwnedPlayerIds])],
              tripleCaptainActive: fantasySeason.triple_captain_gameweek_id === matchRecord.gameweek_id,
              lineupDetails: lineupDetails.flatMap((detail) => {
                const matchingPlayerIds = new Set(
                  (identityByOwnedId.get(detail.playerId) ?? [])
                    .flatMap((identity) => [...(matchPlayerIdsByIdentity.get(identity) ?? [])]),
                );
                return matchingPlayerIds.size === 0
                  ? [detail]
                  : [...matchingPlayerIds].map((playerId) => ({ ...detail, playerId }));
              }),
            };
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load match fantasy impact:', error);
    }

    return NextResponse.json({
      match,
      playerStats: playerStats ?? [],
      fantasyBreakdown: fantasyBreakdown ?? [],
      seriesGames,
      substitutions: substitutions ?? [],
      seriesScore,
      userFantasyImpact,
    });
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/matches/:id', getHandler);
