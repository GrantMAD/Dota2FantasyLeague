import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    await verifyAdminAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const statusFilter = searchParams.get('status');

    const supabase = supabaseServer();

    let query = (supabase.from('matches') as any)
      .select('*', { count: 'exact' })
      .order('scheduled_time', { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data: rawMatches, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch matches', details: error.message },
        { status: 500 }
      );
    }

    if (!rawMatches || rawMatches.length === 0) {
      return NextResponse.json({ data: [], total: 0, limit, offset });
    }

    const teamIds = [...new Set(rawMatches.flatMap((m: any) => [m.team_a_id, m.team_b_id]).filter(Boolean))];
    const seriesIds = [...new Set(rawMatches.map((m: any) => m.series_id).filter(Boolean))];

    const [{ data: teams }, { data: seriesList }] = await Promise.all([
      (supabase.from('professional_teams') as any).select('id, name, logo_url').in('id', teamIds),
      (supabase.from('tournament_series') as any).select('id, tournament_id').in('id', seriesIds),
    ]);

    const tournamentIds = [...new Set((seriesList || []).map((s: any) => s.tournament_id).filter(Boolean))];
    const { data: tournaments } = await (supabase.from('tournaments') as any)
      .select('id, name, tier')
      .in('id', tournamentIds);

    const teamMap = new Map((teams || []).map((t: any) => [t.id, t]));
    const seriesMap = new Map((seriesList || []).map((s: any) => [s.id, s.tournament_id]));
    const tournamentMap = new Map((tournaments || []).map((t: any) => [t.id, t]));

    const enrichedMatches = rawMatches.map((m: any) => {
      const tournamentId = seriesMap.get(m.series_id);
      return {
        ...m,
        team_a: teamMap.get(m.team_a_id) || null,
        team_b: teamMap.get(m.team_b_id) || null,
        tournament: tournamentId ? tournamentMap.get(tournamentId) || null : null,
      };
    });

    return NextResponse.json({ data: enrichedMatches, total: count ?? enrichedMatches.length, limit, offset });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}
