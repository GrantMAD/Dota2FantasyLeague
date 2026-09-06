import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tournaments/[id]
 * Returns a single tournament with its series, matches, and competing teams.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const tournamentId = parseInt(params.id, 10);
    if (isNaN(tournamentId)) {
      return NextResponse.json({ error: 'Invalid tournament ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // 1. Fetch tournament
    const { data: tournament, error: tError } = await (supabase
      .from('tournaments') as any)
      .select('*')
      .eq('id', tournamentId)
      .maybeSingle();

    if (tError) {
      return NextResponse.json(
        { error: 'Failed to fetch tournament.', details: tError.message },
        { status: 500 }
      );
    }

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });
    }

    // 2. Fetch series belonging to this tournament
    const { data: seriesList, error: sError } = await (supabase
      .from('tournament_series') as any)
      .select('id, series_number, best_of, gameweek_id, team_a_id, team_b_id')
      .eq('tournament_id', tournamentId)
      .order('series_number', { ascending: true });

    if (sError) {
      return NextResponse.json(
        { error: 'Failed to fetch series.', details: sError.message },
        { status: 500 }
      );
    }

    const seriesIds = (seriesList ?? []).map((s: any) => s.id);
    const seriesMap = new Map<number, any>((seriesList ?? []).map((s: any) => [s.id, s]));

    // 3. Fetch matches belonging to those series
    let matches: any[] = [];
    if (seriesIds.length > 0) {
      const { data: matchData, error: mError } = await (supabase
        .from('matches') as any)
        .select(`
          id,
          series_id,
          gameweek_id,
          team_a_id,
          team_b_id,
          match_number,
          status,
          scheduled_time,
          duration_minutes,
          winner_team_id
        `)
        .in('series_id', seriesIds)
        .order('scheduled_time', { ascending: true });

      if (mError) {
        return NextResponse.json(
          { error: 'Failed to fetch tournament matches.', details: mError.message },
          { status: 500 }
        );
      }
      matches = matchData ?? [];
    }

    // 4. Resolve teams and logos
    const teamIds = [
      ...new Set([
        ...(seriesList ?? []).flatMap((s: any) => [s.team_a_id, s.team_b_id]),
        ...matches.flatMap((m: any) => [m.team_a_id, m.team_b_id]),
      ]),
    ].filter(Boolean);

    let teams: any[] = [];
    if (teamIds.length > 0) {
      const { data: teamData } = await (supabase
        .from('professional_teams') as any)
        .select('id, name, slug, region, logo_url')
        .in('id', teamIds);
      teams = teamData ?? [];
    }

    const teamById = new Map<number, any>(teams.map((t) => [t.id, t]));

    // 5. Enrich matches with team objects, best_of, and duration_seconds
    const enrichedMatches = matches.map((m: any) => {
      const sInfo = seriesMap.get(m.series_id);
      const teamA = teamById.get(m.team_a_id);
      const teamB = teamById.get(m.team_b_id);

      return {
        ...m,
        match_number: m.match_number || 1,
        best_of: sInfo?.best_of || 3,
        series_number: sInfo?.series_number || 1,
        scheduled_at: m.scheduled_time,
        duration_seconds: m.duration_minutes ? m.duration_minutes * 60 : null,
        radiant_team_id: m.team_a_id,
        dire_team_id: m.team_b_id,
        radiant_team: teamA ? { ...teamA, tag: teamA.name.slice(0, 4).toUpperCase() } : null,
        dire_team: teamB ? { ...teamB, tag: teamB.name.slice(0, 4).toUpperCase() } : null,
        tournaments: { id: tournament.id, name: tournament.name, tier: tournament.tier },
      };
    });

    return NextResponse.json({
      tournament,
      teams,
      series: seriesList ?? [],
      matches: enrichedMatches,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
