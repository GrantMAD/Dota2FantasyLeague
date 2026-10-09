import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';


interface LineupRow {
  fantasy_season_id: number;
  total_points: number | null;
  captain_player_id: number;
  vice_captain_player_id: number | null;
  carry_id: number | null;
  mid_id: number | null;
  offlane_id: number | null;
  support_id: number | null;
  hard_support_id: number | null;
  bench_1_id: number | null;
  bench_2_id: number | null;
  bench_3_id: number | null;
}

interface PlayerRow {
  id: number;
  name: string | null;
  in_game_name: string | null;
  primary_role: string | null;
  profile_image_url: string | null;
}

interface PerformancePointsRow {
  player_id: number;
  fantasy_points_breakdown:
    | { total_points: number | null }
    | { total_points: number | null }[]
    | null;
}

interface SeasonRow {
  id: number;
  season_id: number;
}

interface AverageScoreRow {
  total_points: number | null;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

const STARTER_SLOTS = [
  ['Carry', 'carry_id'],
  ['Mid', 'mid_id'],
  ['Offlane', 'offlane_id'],
  ['Support', 'support_id'],
  ['Hard Support', 'hard_support_id'],
] as const;

async function getHandler(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await verifyAuth(request);
    const { id } = await context.params;
    const gameweekId = Number(id);
    if (!Number.isInteger(gameweekId) || gameweekId <= 0) {
      return NextResponse.json({ error: 'Invalid gameweek ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: gameweek, error: gameweekError } = await supabase
      .from('gameweeks')
      .select('id, season_id, gameweek_number, status')
      .eq('id', gameweekId)
      .maybeSingle();
    if (gameweekError) throw new Error(`Failed to fetch gameweek: ${gameweekError.message}`);
    if (!gameweek) return NextResponse.json({ error: 'Gameweek not found.' }, { status: 404 });
    if (gameweek.status !== 'closed' && gameweek.status !== 'locked') {
      return NextResponse.json({ error: 'History is available after the gameweek closes.' }, { status: 409 });
    }

    const { data: userSeasonsData, error: fantasySeasonError } = await supabase
      .from('fantasy_seasons')
      .select('id, season_id')
      .eq('user_id', userId);
    if (fantasySeasonError) throw new Error(`Failed to fetch your fantasy season: ${fantasySeasonError.message}`);
    const userSeasons = (userSeasonsData ?? []) as SeasonRow[];
    if (userSeasons.length === 0) {
      return NextResponse.json({ error: 'You do not have a fantasy team for this season.' }, { status: 404 });
    }

    const userSeasonIds = userSeasons.map((season) => season.id);
    const [
      userLineupsResult,
      seasonRowsResult,
    ] = await Promise.all([
      supabase
        .from('fantasy_lineups')
        .select('fantasy_season_id, total_points, captain_player_id, vice_captain_player_id, carry_id, mid_id, offlane_id, support_id, hard_support_id, bench_1_id, bench_2_id, bench_3_id')
        .in('fantasy_season_id', userSeasonIds)
        .eq('gameweek_id', gameweekId),
      supabase
        .from('fantasy_seasons')
        .select('id')
        .eq('season_id', gameweek.season_id),
    ]);
    if (userLineupsResult.error) throw new Error(`Failed to fetch your gameweek lineup: ${userLineupsResult.error.message}`);
    if (seasonRowsResult.error) throw new Error(`Failed to fetch fantasy seasons for the average: ${seasonRowsResult.error.message}`);

    const userLineups = (userLineupsResult.data ?? []) as LineupRow[];
    const lineup = userLineups.find((row) =>
      userSeasons.find((season) => season.id === row.fantasy_season_id)?.season_id === gameweek.season_id
    ) ?? userLineups[0] ?? null;
    const seasonIds = ((seasonRowsResult.data ?? []) as SeasonRow[]).map((season) => season.id);
    const seasonLineupsResult = seasonIds.length
      ? await supabase
        .from('fantasy_lineups')
        .select('total_points')
        .in('fantasy_season_id', seasonIds)
        .eq('gameweek_id', gameweekId)
        .not('total_points', 'is', null)
      : { data: [], error: null };
    if (seasonLineupsResult.error) {
      throw new Error(`Failed to fetch gameweek scores for the average: ${seasonLineupsResult.error.message}`);
    }

    const averageScores = ((seasonLineupsResult.data ?? []) as AverageScoreRow[])
      .map((row) => Number(row.total_points))
      .filter(Number.isFinite);
    const globalAverage = averageScores.length > 0
      ? Math.round((averageScores.reduce((sum, score) => sum + score, 0) / averageScores.length) * 100) / 100
      : null;

    if (!lineup) {
      return NextResponse.json({
        gameweek: { id: gameweek.id, number: gameweek.gameweek_number },
        managerScore: null,
        globalAverage,
        starters: [],
        bench: [],
        captainPlayerId: null,
        viceCaptainPlayerId: null,
      });
    }

    const starterIds = STARTER_SLOTS
      .map(([, column]) => lineup[column])
      .filter((playerId): playerId is number => playerId !== null);
    const benchIds = [lineup.bench_1_id, lineup.bench_2_id, lineup.bench_3_id]
      .filter((playerId): playerId is number => playerId !== null);
    const playerIds = [...new Set([...starterIds, ...benchIds])];

    const [playersResult, performancesResult] = playerIds.length > 0
      ? await Promise.all([
        supabase
          .from('professional_players')
          .select('id, name, in_game_name, primary_role, profile_image_url')
          .in('id', playerIds),
        supabase
          .from('player_performances')
          .select('player_id, fantasy_points_breakdown(total_points)')
          .eq('gameweek_id', gameweekId)
          .in('player_id', playerIds),
      ])
      : [
        { data: [], error: null },
        { data: [], error: null },
      ];
    if (playersResult.error) throw new Error(`Failed to fetch lineup player details: ${playersResult.error.message}`);
    if (performancesResult.error) throw new Error(`Failed to fetch lineup player points: ${performancesResult.error.message}`);

    const playersById = new Map<number, PlayerRow>(
      ((playersResult.data ?? []) as PlayerRow[]).map((player) => [player.id, player]),
    );
    const pointsByPlayer = new Map<number, number>();
    for (const row of (performancesResult.data ?? []) as PerformancePointsRow[]) {
      const breakdown = Array.isArray(row.fantasy_points_breakdown)
        ? row.fantasy_points_breakdown[0]
        : row.fantasy_points_breakdown;
      pointsByPlayer.set(
        row.player_id,
        (pointsByPlayer.get(row.player_id) ?? 0) + Number(breakdown?.total_points ?? 0),
      );
    }

    const toPlayerSummary = (playerId: number, role: string) => {
      const player = playersById.get(playerId);
      return {
        id: playerId,
        name: player?.in_game_name || player?.name || `Player #${playerId}`,
        role,
        points: Math.round((pointsByPlayer.get(playerId) ?? 0) * 100) / 100,
        profileImageUrl: player?.profile_image_url ?? null,
        isCaptain: playerId === lineup.captain_player_id,
        isViceCaptain: playerId === lineup.vice_captain_player_id,
      };
    };

    return NextResponse.json({
      gameweek: { id: gameweek.id, number: gameweek.gameweek_number },
      managerScore: lineup.total_points === null ? null : Number(lineup.total_points),
      globalAverage,
      starters: STARTER_SLOTS.flatMap(([role, column]) => {
        const playerId = lineup[column];
        return playerId === null ? [] : [toPlayerSummary(playerId, role)];
      }),
      bench: benchIds.map((playerId, index) => toPlayerSummary(playerId, `Bench ${index + 1}`)),
      captainPlayerId: lineup.captain_player_id,
      viceCaptainPlayerId: lineup.vice_captain_player_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load gameweek history.';
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: number }).status)
      : 500;
    return NextResponse.json({ error: message }, { status: Number.isInteger(status) ? status : 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/gameweeks/:id/history', getHandler);
