import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';

async function getHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const rawQuery = request.nextUrl.searchParams.get('query') ?? '';
    const searchTerm = rawQuery
      .trim()
      .replace(/[,%()]/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 80)
      .trim();

    if (searchTerm.length < 2) {
      return NextResponse.json(
        { players: [], leagues: [] },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const supabase = supabaseServer();
    const [{ data: players, error: playersError }, { data: memberships, error: membershipsError }] = await Promise.all([
      supabase
        .from('professional_players')
        .select('id, name, in_game_name, primary_role, current_price, professional_teams(name)')
        .or(`name.ilike.%${searchTerm}%,in_game_name.ilike.%${searchTerm}%`)
        .order('name', { ascending: true })
        .limit(5),
      supabase
        .from('league_participants')
        .select('league_id')
        .eq('user_id', user.userId),
    ]);

    if (playersError || membershipsError) {
      console.error('Command palette search failed:', playersError?.message ?? membershipsError?.message);
      return NextResponse.json({ error: 'Unable to search players and leagues.' }, { status: 500 });
    }

    const leagueIds = (memberships ?? [])
      .map((membership: { league_id: number }) => membership.league_id)
      .filter((id: number) => Number.isSafeInteger(id) && id > 0);

    let leaguesQuery = supabase
      .from('leagues')
      .select('id, name, league_type, privacy_level, current_participants')
      .eq('status', 'active')
      .ilike('name', `%${searchTerm}%`)
      .order('name', { ascending: true })
      .limit(5);

    leaguesQuery = leagueIds.length > 0
      ? leaguesQuery.or(`privacy_level.neq.private,id.in.(${leagueIds.join(',')})`)
      : leaguesQuery.neq('privacy_level', 'private');

    const { data: leagues, error: leaguesError } = await leaguesQuery;
    if (leaguesError) {
      console.error('Command palette league search failed:', leaguesError.message);
      return NextResponse.json({ error: 'Unable to search players and leagues.' }, { status: 500 });
    }

    return NextResponse.json(
      { players: players ?? [], leagues: leagues ?? [] },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: number }).status)
      : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to search players and leagues.' },
      { status },
    );
  }
}

export const GET = withApiTelemetry('GET', '/api/command-search', getHandler);
