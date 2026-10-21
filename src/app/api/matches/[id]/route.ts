import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';
import { getTeamDisplayTag } from '@/lib/team-tag';


interface RouteContext {
  params: Promise<{ id: string }>;
}

interface MatchRecord {
  [column: string]: unknown;
  id: number;
  status: string;
  scheduled_time: string;
  duration_minutes: number | null;
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
      .select('id, status, scheduled_time, duration_minutes, gameweek_id, series_id, team_a_id, team_b_id, winner_team_id')
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
      let seriesScore: {
        radiantWins: number;
        direWins: number;
        clinchedTeamId: number | null;
      } | null = null;

      if (seriesRecord) {
        const { data: seriesMatchesData, error: seriesMatchesError } = await supabase
          .from('matches')
          .select('id, status, scheduled_time, winner_team_id')
          .eq('series_id', seriesRecord.id)
          .order('scheduled_time', { ascending: true });

        if (seriesMatchesError) {
          console.error('Failed to fetch match series results:', seriesMatchesError);
          return NextResponse.json({ error: 'Failed to fetch match series results.' }, { status: 500 });
        }

        const seriesMatches = (seriesMatchesData ?? []) as SeriesMatchRecord[];
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
        matchRecord.match_number = Math.max(1, seriesMatches.findIndex((seriesMatch) => seriesMatch.id === matchRecord.id) + 1);
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

    // Fetch per-player stats for this match
    // The generated local schema does not include this table.
    const { data: playerStats } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('match_player_stats') as any)
      .select(`
        *,
        hero_name,
        professional_players(id, name, in_game_name, primary_role, profile_image_url)
      `)
      .eq('match_id', matchId)
      .order('team_id', { ascending: true });

    // fantasy_points_breakdown has no match_id column — it joins via performance_id -> player_performances.
    // Fetch performances for this match, with nested breakdown, then flatten to player_id-keyed shape.
    const { data: performanceData } = await supabase
      .from('player_performances')
      .select('id, player_id, fantasy_points_breakdown(combat_points, economy_points, objective_points, teamfight_points, win_points, series_points, performance_index_points, consistency_points, penalty_points, total_points)')
      .eq('match_id', matchId);

    const performances = (performanceData ?? []) as PerformanceRecord[];
    const fantasyBreakdown = performances.flatMap((performance) => {
      const breakdown = Array.isArray(performance.fantasy_points_breakdown)
        ? performance.fantasy_points_breakdown[0]
        : performance.fantasy_points_breakdown;
      return breakdown ? [{ player_id: performance.player_id, ...breakdown }] : [];
    });

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

            // Find squad members
            const { data: squadMembers } = await supabase
              .from('fantasy_squad_members')
              .select('player_id')
              .eq('fantasy_season_id', fantasySeason.id);

            const ownedIds = (squadMembers ?? []).map((m: { player_id: number }) => m.player_id);

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
              userOwnedPlayerIds: ownedIds,
              tripleCaptainActive: fantasySeason.triple_captain_gameweek_id === matchRecord.gameweek_id,
              lineupDetails,
            };
          }
        }
      }
    } catch {
      // Gracefully ignore auth or lookup errors for unauthenticated/unrelated callers
    }

    return NextResponse.json({
      match,
      playerStats: playerStats ?? [],
      fantasyBreakdown: fantasyBreakdown ?? [],
      substitutions: substitutions ?? [],
      seriesScore,
      userFantasyImpact,
    });
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/matches/:id', getHandler);
