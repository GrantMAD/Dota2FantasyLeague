import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase';
import { getOrCreateFantasySeason } from '@/lib/fantasy-season';
import { aggregatePlayerGameweekBreakdowns } from '@/lib/player-gameweek-breakdown';
import type { DashboardData } from '@/types/fantasy';
import type { WhatsNewData } from './components/DashboardWhatsNew';
import { DashboardClient } from './components/DashboardClient';

// Force fully dynamic rendering — this page reads auth cookies per-request.
export const dynamic = 'force-dynamic';

/** Read auth cookies and return the user ID, or null on failure.
 *  Mirrors the refresh-token fallback in auth-utils.ts so that
 *  an expired access token with a valid refresh token still works. */
async function getServerUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sb-auth-token')?.value;
    const refreshToken = cookieStore.get('sb-refresh-token')?.value;

    // Nothing at all → unauthenticated
    if (!token && !refreshToken) return null;

    const supabase = supabaseServer();

    // Try the access token first
    if (token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data.user?.id) return data.user.id;
    }

    // Access token missing or expired — try refreshing via the refresh token
    if (refreshToken) {
      const rt: string = refreshToken;
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession({
        refresh_token: rt,
      });
      if (!refreshError && refreshed.user?.id) return refreshed.user.id;
    }

    return null;
  } catch {
    return null;
  }
}

/** Fetch all dashboard stats server-side (mirrors the /api/dashboard/stats route logic). */
async function fetchDashboardData(userId: string): Promise<DashboardData | null> {
  try {
    const supabase = supabaseServer();

    type StarterQueryPlayer = {
      id: number;
      name: string;
      in_game_name: string | null;
      primary_role: string;
      profile_image_url: string | null;
      team_id: number | null;
      professional_teams: { name: string } | null;
    };

    // Phase 1: Parallel initial queries
    const [fantasySeason, gameweeksRes, previousClosedGameweekRes, leaguesRes, profileRes] = await Promise.all([
      getOrCreateFantasySeason(supabase, userId),
      supabase
        .from('gameweeks')
        .select('id, gameweek_number, deadline, status')
        .in('status', ['upcoming', 'active'])
        .order('start_date', { ascending: true })
        .limit(1),
      supabase
        .from('gameweeks')
        .select('id, gameweek_number, deadline, status')
        .eq('status', 'closed')
        .order('id', { ascending: false })
        .limit(1),
      supabase
        .from('league_participants')
        .select('rank, points, leagues(id, name)')
        .eq('user_id', userId)
        .limit(3),
      supabase
        .from('users')
        .select('display_name, username')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    const previousClosedGameweek = previousClosedGameweekRes.data?.[0] ?? null;
    let gameweek = gameweeksRes.data && gameweeksRes.data.length > 0 ? gameweeksRes.data[0] : null;
    const displayName = profileRes.data?.display_name?.trim() || profileRes.data?.username || null;
    if (!gameweek) gameweek = previousClosedGameweek;

    // Normalise the Supabase join shape to match LeagueStanding[]
    const leagues: import('@/types/fantasy').LeagueStanding[] = (leaguesRes.data ?? []).map((l) => ({
      rank: l.rank ?? null,
      points: l.points ?? undefined,
      leagues: Array.isArray(l.leagues) ? l.leagues[0] ?? null : (l.leagues as { id?: number; name?: string } | null),
    }));

    if (!fantasySeason || !fantasySeason.id) {
      return {
        fantasySeasonId: null,
        displayName,
        gameweek,
        totalPoints: 0,
        globalRank: null,
        targetPoints: null,
        targetRank: null,
        bankBalance: 45,
        squadValue: 0,
        freeTransfers: 2,
        activeSquadCount: 0,
        ownedPlayerCount: 0,
        captain: null,
        viceCaptain: null,
        leagueStandings: leagues,
      };
    }

    const freeTransfers = fantasySeason.free_transfers ?? 2;

    // Phase 2: Squad + lineup
    const [squadRes, squadCountRes, lineupRes] = await Promise.all([
      supabase
        .from('fantasy_squads')
        .select('id, name, fantasy_squad_members(player_id, removed_date)')
        .eq('fantasy_season_id', fantasySeason.id)
        .maybeSingle(),
      supabase
        .from('fantasy_squads')
        .select('*', { count: 'exact', head: true })
        .eq('fantasy_season_id', fantasySeason.id),
      gameweek
        ? supabase
            .from('fantasy_lineups')
            .select('*')
            .eq('fantasy_season_id', fantasySeason.id)
            .eq('gameweek_id', gameweek.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const squad = squadRes.data;
    const activeSquadCount = squadCountRes.count ?? (squad ? 1 : 0);
    const squadPlayerIds = (squad?.fantasy_squad_members ?? [])
      .filter((member) => !member.removed_date)
      .map((member) => member.player_id);

    const lineupRow = lineupRes.data as Record<string, unknown> | null;
    const slots = ['carry', 'mid', 'offlane', 'support', 'hard_support'] as const;
    const starterIds = lineupRow
      ? slots
          .map((s) =>
            typeof lineupRow[`${s}_id`] === 'number'
              ? (lineupRow[`${s}_id`] as number)
              : lineupRow[`${s}_id`]
              ? Number(lineupRow[`${s}_id`])
              : null
          )
          .filter((id): id is number => id !== null)
      : [];

    const allPricePlayerIds = Array.from(new Set([...squadPlayerIds, ...starterIds]));
    const allDetailPlayerIds = Array.from(
      new Set([
        ...starterIds,
        ...(lineupRow?.captain_player_id ? [Number(lineupRow.captain_player_id)] : []),
        ...(lineupRow?.vice_captain_player_id ? [Number(lineupRow.vice_captain_player_id)] : []),
      ])
    );

    // Phase 3: Prices + player details
    const [pricesRes, playersRes] = await Promise.all([
      allPricePlayerIds.length > 0
        ? supabase
            .from('player_prices')
            .select('player_id, price, gameweek_id')
            .eq('season_id', fantasySeason.season_id)
            .in('player_id', allPricePlayerIds)
            .order('gameweek_id', { ascending: false })
        : Promise.resolve({ data: [] }),
      allDetailPlayerIds.length > 0
        ? (supabase
            .from('professional_players')
            .select('id, name, in_game_name, primary_role, profile_image_url, team_id, professional_teams(name)')
            .in('id', allDetailPlayerIds) as unknown as Promise<{ data: StarterQueryPlayer[] | null }>)
        : Promise.resolve({ data: [] }),
    ]);

    const latestPrices = new Map<number, number>();
    for (const price of (pricesRes.data ?? []) as { player_id: number; price: number; gameweek_id: number }[]) {
      if (!latestPrices.has(price.player_id)) {
        latestPrices.set(price.player_id, Number(price.price ?? 0));
      }
    }

    const squadValue = squadPlayerIds.reduce((total, playerId) => total + (latestPrices.get(playerId) ?? 0), 0);
    const playerMap = new Map((playersRes.data ?? []).map((p) => [p.id, p]));

    let captain: { name: string; primary_role: string } | null = null;
    let viceCaptain: { name: string; primary_role: string } | null = null;

    if (lineupRow?.captain_player_id) {
      const cap = playerMap.get(Number(lineupRow.captain_player_id));
      if (cap) captain = { name: cap.name, primary_role: cap.primary_role };
    }
    if (lineupRow?.vice_captain_player_id) {
      const vcap = playerMap.get(Number(lineupRow.vice_captain_player_id));
      if (vcap) viceCaptain = { name: vcap.name, primary_role: vcap.primary_role };
    }

    const starterObjects: import('@/types/fantasy').DashboardStarter[] = (lineupRow
      ? slots
          .map((slot) => {
            const pid = lineupRow[`${slot}_id`];
            const p = pid ? playerMap.get(Number(pid)) : null;
            if (!p) return null;
            return {
              id: p.id,
              slot,
              name: p.name,
              in_game_name: p.in_game_name,
              primary_role: p.primary_role,
              profile_image_url: p.profile_image_url || null,
              current_price: latestPrices.get(p.id) ?? 0,
              is_captain: lineupRow.captain_player_id === p.id,
              is_vice_captain: lineupRow.vice_captain_player_id === p.id,
              team_id: p.team_id ?? null,
              team_name: p.professional_teams?.name || null,
              gw_points: null as number | null,
              score_breakdown: null as {
                combat: number; economy: number; objective: number;
                teamfight: number; win: number; series: number; performance: number;
                consistency: number; penalty: number; total: number;
              } | null,
              prev_gw_points: null as number | null,
            };
          })
          .filter((s): s is NonNullable<typeof s> => s !== null)
      : []);

    // Fetch GW scores for starters
    if (starterObjects.length > 0) {
      type BreakdownRow = {
        player_id: number;
        fantasy_points_breakdown: {
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
        } | null;
      };
      type PrevPerfRow = {
        player_id: number;
        fantasy_points_breakdown: { total_points: number | null } | null;
      };
      type PerformanceQueryResult<Row> = {
        data: Row[] | null;
        error: { message: string } | null;
      };

      const starterPlayerIds = starterObjects.map((s) => s!.id);
      const previousGameweek =
        previousClosedGameweek && gameweek && previousClosedGameweek.id !== gameweek.id
          ? previousClosedGameweek
          : null;

      const currentPerfPromise: Promise<PerformanceQueryResult<BreakdownRow>> = gameweek
        ? (supabase
            .from('player_performances')
            .select(
              'player_id, fantasy_points_breakdown(combat_points, economy_points, objective_points, teamfight_points, win_points, series_points, performance_index_points, consistency_points, penalty_points, total_points)'
            )
            .eq('gameweek_id', gameweek.id)
            .in('player_id', starterPlayerIds) as unknown as Promise<PerformanceQueryResult<BreakdownRow>>)
        : Promise.resolve({ data: null, error: null });

      const prevPerfPromise: Promise<PerformanceQueryResult<PrevPerfRow>> = previousGameweek
        ? (supabase
            .from('player_performances')
            .select('player_id, fantasy_points_breakdown(total_points)')
            .eq('gameweek_id', previousGameweek.id)
            .in('player_id', starterPlayerIds) as unknown as Promise<PerformanceQueryResult<PrevPerfRow>>)
        : Promise.resolve({ data: null, error: null });

      const [currentPerfRes, prevPerfRes] = await Promise.all([currentPerfPromise, prevPerfPromise]);

      if (currentPerfRes.data && Array.isArray(currentPerfRes.data)) {
        const breakdownMap = aggregatePlayerGameweekBreakdowns(currentPerfRes.data as BreakdownRow[]);
        starterObjects.forEach((starter) => {
          if (!starter) return;
          const bd = breakdownMap.get(starter.id);
          if (bd) {
            starter.gw_points = bd.total;
            starter.score_breakdown = {
              combat: bd.combat,
              economy: bd.economy,
              objective: bd.objective,
              teamfight: bd.teamfight,
              win: bd.win,
              series: bd.series,
              performance: bd.performance,
              consistency: bd.consistency,
              penalty: bd.penalty,
              total: bd.total,
            };
          }
        });
      }

      if (prevPerfRes.data && Array.isArray(prevPerfRes.data)) {
        const prevTotals = new Map<number, number>();
        for (const row of prevPerfRes.data as PrevPerfRow[]) {
          const pts = row.fantasy_points_breakdown?.total_points;
          if (pts != null) {
            prevTotals.set(row.player_id, (prevTotals.get(row.player_id) ?? 0) + pts);
          }
        }
        starterObjects.forEach((starter) => {
          if (!starter) return;
          const prev = prevTotals.get(starter.id);
          starter.prev_gw_points = prev ?? null;
        });
      }
    }

    return {
      fantasySeasonId: fantasySeason.id,
      displayName,
      gameweek,
      totalPoints: fantasySeason.total_points || 0,
      globalRank: fantasySeason.global_rank,
      targetPoints: fantasySeason.target_points ?? null,
      targetRank: fantasySeason.target_rank ?? null,
      bankBalance: Number(fantasySeason.budget || 0),
      squadValue,
      freeTransfers,
      activeSquadCount: activeSquadCount || 0,
      ownedPlayerCount: squadPlayerIds.length,
      squadName: squad && 'name' in squad && typeof squad.name === 'string' ? squad.name : 'My Fantasy Squad',
      captain,
      viceCaptain,
      starters: starterObjects,
      leagueStandings: leagues,
    };
  } catch (err) {
    console.error('[DashboardPage RSC] fetchDashboardData error:', err);
    return null;
  }
}

/** Fetch the What's New data server-side. */
async function fetchWhatsNew(userId: string): Promise<WhatsNewData | null> {
  try {
    const supabase = supabaseServer();

    const [gameweeksRes, tournamentsRes, updatesRes] = await Promise.all([
      supabase
        .from('gameweeks')
        .select('id, gameweek_number, status, start_date, deadline')
        .in('status', ['active', 'upcoming'])
        .order('start_date', { ascending: true })
        .limit(1),
      supabase
        .from('tournaments')
        .select('id, name, tier, start_date, series_count, match_count, best_of_formats, deadline, match_statuses')
        .gte('start_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('start_date', { ascending: false })
        .limit(5),
      supabase
        .from('player_notifications')
        .select('id, kind, title, message, created_at, player_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const gw = gameweeksRes.data?.[0] ?? null;
    const now = Date.now();
    const gameweek: WhatsNewData['gameweek'] = gw
      ? {
          id: gw.id,
          number: gw.gameweek_number,
          status: gw.status,
          startsAt: gw.start_date,
          isCurrent: gw.status === 'active',
          endsSoon: gw.deadline ? new Date(gw.deadline).getTime() - now < 24 * 60 * 60 * 1000 : false,
          deadline: gw.deadline ?? '',
          matchCount: 0,
          matchStatuses: {},
          href: `/gameweeks/${gw.id}`,
        }
      : null;

    const events: WhatsNewData['events'] = (tournamentsRes.data ?? []).map((t) => ({
      kind: 'tournament' as const,
      id: t.id,
      title: t.name,
      startedAt: t.start_date,
      href: `/tournaments/${t.id}`,
      tier: t.tier ?? null,
      seriesCount: t.series_count ?? undefined,
      matchCount: t.match_count ?? undefined,
      bestOfFormats: t.best_of_formats ?? undefined,
      deadline: t.deadline ?? null,
      matchStatuses: t.match_statuses ?? undefined,
    }));

    const updates: WhatsNewData['updates'] = (updatesRes.data ?? []).map((n) => ({
      id: n.id,
      kind: n.kind as 'price_change' | 'availability',
      title: n.title,
      message: n.message,
      createdAt: n.created_at,
      href: `/players/${n.player_id}`,
    }));

    return { gameweek, events, updates };
  } catch (err) {
    console.error('[DashboardPage RSC] fetchWhatsNew error:', err);
    return null;
  }
}

export default async function DashboardPage() {
  const userId = await getServerUserId();

  // If authenticated on the server, fetch data ahead of time.
  // If not authenticated server-side (e.g. mock test tokens like 'e2e-mock-token' or client-only mock routes),
  // do not redirect here; let proxy.ts and DashboardClient's client-side fetchWithAuth handle the session.
  const [initialData, initialWhatsNew] = userId
    ? await Promise.all([fetchDashboardData(userId), fetchWhatsNew(userId)])
    : [null, null];

  return (
    <DashboardClient
      initialData={initialData}
      initialWhatsNew={initialWhatsNew}
    />
  );
}
