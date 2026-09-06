import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';

/**
 * GET /api/tournaments
 * Returns tournaments, optionally filtered by seasonId and/or status.
 * Query params: seasonId, status (eligible|excluded|provisional|archived)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const status = searchParams.get('status');
    const cacheKey = `tournaments:${searchParams.toString()}`;
    const cached = getCached<{ tournaments: unknown[] }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const supabase = supabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from('tournaments') as any)
      .select(`
        id,
        season_id,
        name,
        slug,
        status,
        tier,
        start_date,
        end_date,
        eligible,
        last_synced_at
      `)
      .order('start_date', { ascending: false });

    if (seasonId) query = query.eq('season_id', seasonId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch tournaments.', details: error.message },
        { status: 500 }
      );
    }

    const tournamentIds = (data ?? []).map((t: any) => t.id);
    let seriesByTournament = new Map<number, any[]>();
    let teamsMap = new Map<number, any>();

    if (tournamentIds.length > 0) {
      const { data: allSeries } = await (supabase.from('tournament_series') as any)
        .select('id, tournament_id, team_a_id, team_b_id')
        .in('tournament_id', tournamentIds);

      const seriesList = allSeries ?? [];
      seriesList.forEach((s: any) => {
        const list = seriesByTournament.get(s.tournament_id) || [];
        list.push(s);
        seriesByTournament.set(s.tournament_id, list);
      });

      const allTeamIds = [...new Set(seriesList.flatMap((s: any) => [s.team_a_id, s.team_b_id]))].filter(Boolean);
      if (allTeamIds.length > 0) {
        const { data: teamsData } = await (supabase.from('professional_teams') as any)
          .select('id, name, logo_url')
          .in('id', allTeamIds);
        (teamsData ?? []).forEach((t: any) => teamsMap.set(t.id, t));
      }
    }

    const enrichedTournaments = (data ?? []).map((t: any) => {
      const seriesList = seriesByTournament.get(t.id) || [];
      const teamIds = [...new Set(seriesList.flatMap((s: any) => [s.team_a_id, s.team_b_id]))].filter(Boolean);
      const participatingTeams = teamIds.map((id) => teamsMap.get(id)).filter(Boolean);

      return {
        ...t,
        series_count: seriesList.length,
        participating_teams: participatingTeams,
      };
    });

    const response = { tournaments: enrichedTournaments };
    setCached(cacheKey, response, 60_000);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
