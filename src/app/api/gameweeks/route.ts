import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';
import { verifyAuth, AuthError } from '@/lib/auth-utils';

/**
 * GET /api/gameweeks
 * Returns all gameweeks, optionally filtered by season and/or status.
 * Query params: seasonId, status (upcoming|active|closed)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const status = searchParams.get('status');
    const cacheKey = `gameweeks:${searchParams.toString()}`;
    const cached = getCached<{ gameweeks: unknown[] }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const supabase = supabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('gameweeks') as any)
      .select(`
        id,
        season_id,
        gameweek_number,
        start_date,
        end_date,
        deadline,
        status,
        created_at
      `)
      .order('gameweek_number', { ascending: true });

    if (seasonId) query = query.eq('season_id', seasonId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch gameweeks.', details: error.message },
        { status: 500 }
      );
    }

    const gameweeks = data ?? [];
    if (!gameweeks.length) {
      const response = { gameweeks: [] };
      setCached(cacheKey, response, 60_000);
      return NextResponse.json(response);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gameweekIds = gameweeks.map((gw: any) => gw.id);

    const [{ data: matchRows }, { data: flagRows }, { data: scoreRows }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('matches') as any)
        .select('gameweek_id, series_id, status')
        .in('gameweek_id', gameweekIds),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('gameweek_team_flags') as any)
        .select(`
          gameweek_id,
          flag,
          team_id,
          professional_teams (id, name, slug, logo_url)
        `)
        .in('gameweek_id', gameweekIds),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from('gameweek_scores') as any)
        .select('gameweek_id, player_id, total_points, players:player_id (id, name, in_game_name, primary_role)')
        .in('gameweek_id', gameweekIds)
    ]);

    const matchCountMap = new Map<number, number>();
    const tournamentMap = new Map<number, Array<{ id: number; name: string; slug: string | null }>>();
    const flagMap = new Map<number, Array<{ flag: string; team_id: number; professional_teams?: { id: number; name: string; slug: string | null; logo_url?: string | null } | null }>>();
    const topScorerMap = new Map<number, { player_id: number; total_points: number; name: string; in_game_name?: string | null; primary_role?: string | null } | null>();

    for (const match of matchRows ?? []) {
      const gwId = Number(match.gameweek_id);
      matchCountMap.set(gwId, (matchCountMap.get(gwId) ?? 0) + 1);

      if (match.series_id) {
        const current = tournamentMap.get(gwId) ?? [];
        const existing = current.find((item) => item.id === Number(match.series_id));
        if (!existing) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const seriesRecord = await (supabase.from('tournament_series') as any)
            .select('id, tournament_id, tournaments(id, name, slug)')
            .eq('id', match.series_id)
            .maybeSingle();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tournament = (seriesRecord as any)?.data?.tournaments;
          if (tournament) {
            current.push({ id: Number(tournament.id), name: tournament.name, slug: tournament.slug ?? null });
            tournamentMap.set(gwId, current);
          }
        }
      }
    }

    for (const score of scoreRows ?? []) {
      const gwId = Number(score.gameweek_id);
      const player = score.players;
      const totalPoints = Number(score.total_points ?? 0);
      const current = topScorerMap.get(gwId);
      if (!current || totalPoints > Number(current.total_points ?? 0)) {
        topScorerMap.set(gwId, {
          player_id: Number(score.player_id),
          total_points: totalPoints,
          name: player?.name || 'Unknown',
          in_game_name: player?.in_game_name ?? null,
          primary_role: player?.primary_role ?? null,
        });
      }
    }

    for (const flag of flagRows ?? []) {
      const gwId = Number(flag.gameweek_id);
      const current = flagMap.get(gwId) ?? [];
      current.push({
        flag: flag.flag,
        team_id: Number(flag.team_id),
        professional_teams: flag.professional_teams ?? null,
      });
      flagMap.set(gwId, current);
    }

    const userScoreMap = new Map<number, number>();
    try {
      const auth = await verifyAuth(request);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: seasonRows } = await (supabase.from('fantasy_seasons') as any)
        .select('id, season_id, user_id')
        .eq('user_id', auth.userId)
        .limit(20);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fantasySeasonIds = (seasonRows ?? []).map((season: any) => season.id);
      if (fantasySeasonIds.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: lineupRows } = await (supabase.from('fantasy_lineups') as any)
          .select('gameweek_id, total_points')
          .in('fantasy_season_id', fantasySeasonIds)
          .in('gameweek_id', gameweekIds);

        for (const lineup of lineupRows ?? []) {
          userScoreMap.set(Number(lineup.gameweek_id), Number(lineup.total_points ?? 0));
        }
      }
    } catch (error) {
      const authError = error as AuthError;
      if (authError?.status && authError.status !== 401) {
        console.warn('Failed to load user-specific gameweek scores', authError.message);
      }
    }

    const response = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gameweeks: gameweeks.map((gw: any) => ({
        ...gw,
        match_count: matchCountMap.get(Number(gw.id)) ?? 0,
        tournaments: tournamentMap.get(Number(gw.id)) ?? [],
        flags: flagMap.get(Number(gw.id)) ?? [],
        top_scorer: topScorerMap.get(Number(gw.id)) ?? null,
        user_score: userScoreMap.get(Number(gw.id)) ?? null,
      })),
    };

    setCached(cacheKey, response, 60_000);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
