import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';
import { withApiTelemetry } from '@/lib/api-telemetry';

interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country_code: string | null;
  timezone: string | null;
  theme_preference: 'light' | 'dark';
  banner_theme: string | null;
  role: string;
  is_premium: boolean;
  subscription_tier: string | null;
  created_at: string;
  updated_at: string;
}

interface FantasySeasonRow {
  id: number;
  user_id: string;
  total_points: number | null;
  global_rank: number | null;
  fantasy_squads?: Array<{ id: number; name: string }>;
}

async function getHandler(request: NextRequest) {
  try {
    await verifyAdminAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25'), 1), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
    const search = searchParams.get('search')?.trim() || '';
    const role = searchParams.get('role');
    const tier = searchParams.get('tier');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const supabase = getSupabaseServerClient();

    let query = supabase.from('users').select('*', { count: 'exact' });

    if (search) {
      query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%,id.eq.${search}`);
    }

    if (role && role !== 'all') {
      query = query.eq('role', role);
    }

    if (tier && tier !== 'all') {
      query = query.eq('subscription_tier', tier);
    }

    const validSortColumns = new Set(['created_at', 'username', 'role', 'updated_at']);
    const effectiveSortBy = validSortColumns.has(sortBy) ? sortBy : 'created_at';

    query = query
      .order(effectiveSortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: rawUsers, count, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch users', details: error.message },
        { status: 500 }
      );
    }

    const users = (rawUsers ?? []) as UserRow[];
    if (users.length === 0) {
      return NextResponse.json({
        users: [],
        total: count ?? 0,
        limit,
        offset,
      });
    }

    const userIds = users.map((u) => u.id);

    // Fetch associated data in parallel
    const [seasonsResult, leaguesResult, reportsResult] = await Promise.all([
      supabase
        .from('fantasy_seasons')
        .select('id, user_id, total_points, global_rank, fantasy_squads(id, name)')
        .in('user_id', userIds),
      supabase
        .from('league_members')
        .select('user_id')
        .in('user_id', userIds),
      supabase
        .from('issue_reports')
        .select('user_id')
        .in('user_id', userIds),
    ]);

    const seasonsByUser = new Map<string, FantasySeasonRow>();
    for (const season of (seasonsResult.data ?? []) as FantasySeasonRow[]) {
      if (!seasonsByUser.has(season.user_id)) {
        seasonsByUser.set(season.user_id, season);
      }
    }

    const leagueCountByUser = new Map<string, number>();
    for (const lm of (leaguesResult.data ?? []) as Array<{ user_id: string }>) {
      leagueCountByUser.set(lm.user_id, (leagueCountByUser.get(lm.user_id) ?? 0) + 1);
    }

    const reportCountByUser = new Map<string, number>();
    for (const r of (reportsResult.data ?? []) as Array<{ user_id: string }>) {
      reportCountByUser.set(r.user_id, (reportCountByUser.get(r.user_id) ?? 0) + 1);
    }

    // Try fetching emails from auth.users via admin API if available
    const emailByUserId = new Map<string, string>();
    try {
      if (supabase.auth?.admin?.listUsers) {
        const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (authData?.users) {
          for (const u of authData.users) {
            if (u.email) {
              emailByUserId.set(u.id, u.email);
            }
          }
        }
      }
    } catch {
      // Fallback silently if auth admin listUsers is restricted
    }

    const enrichedUsers = users.map((user) => {
      const season = seasonsByUser.get(user.id);
      const squad = season?.fantasy_squads?.[0] ?? null;

      return {
        ...user,
        email: emailByUserId.get(user.id) ?? null,
        fantasy_team: season
          ? {
              squad_name: squad?.name ?? 'My Squad',
              total_points: season.total_points ?? 0,
              global_rank: season.global_rank ?? null,
            }
          : null,
        leagues_count: leagueCountByUser.get(user.id) ?? 0,
        reports_count: reportCountByUser.get(user.id) ?? 0,
      };
    });

    return NextResponse.json({
      users: enrichedUsers,
      total: count ?? enrichedUsers.length,
      limit,
      offset,
    });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}

export const GET = withApiTelemetry('GET', '/api/admin/users', getHandler);
