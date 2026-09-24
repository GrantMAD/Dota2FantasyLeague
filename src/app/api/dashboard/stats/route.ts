import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, applyRefreshedTokens, AuthError } from '@/lib/auth-utils';
import { getOrCreateFantasySeason } from '@/lib/fantasy-season';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const supabase = supabaseServer();

    // Phase 1: Parallel initial queries (fantasy_season, active/upcoming gameweek, user leagues)
    const [fantasySeason, gameweeksRes, leaguesRes] = await Promise.all([
      getOrCreateFantasySeason(supabase, user.userId),
      supabase
        .from('gameweeks')
        .select('id, gameweek_number, deadline, status')
        .in('status', ['upcoming', 'active'])
        .order('start_date', { ascending: true })
        .limit(1),
      supabase
        .from('league_participants')
        .select(`
          rank,
          points,
          leagues(id, name)
        `)
        .eq('user_id', user.userId)
        .limit(3),
    ]);

    let gameweek = gameweeksRes.data && gameweeksRes.data.length > 0 ? gameweeksRes.data[0] : null;

    // No active/upcoming GW — fall back to the latest closed one so lineup still renders
    if (!gameweek) {
      const { data: closedGws } = await supabase
        .from('gameweeks')
        .select('id, gameweek_number, deadline, status')
        .eq('status', 'closed')
        .order('id', { ascending: false })
        .limit(1);
      gameweek = closedGws && closedGws.length > 0 ? closedGws[0] : null;
    }

    const leagues = leaguesRes.data || [];

    if (!fantasySeason || !fantasySeason.id) {
      const emptyResponse = NextResponse.json({
        fantasySeasonId: null,
        gameweek,
        totalPoints: 0,
        globalRank: null,
        bankBalance: 100,
        squadValue: 0,
        freeTransfers: 2,
        activeSquadCount: 0,
        captain: null,
        viceCaptain: null,
        leagueStandings: leagues,
      });
      applyRefreshedTokens(emptyResponse, user);
      return emptyResponse;
    }

    const freeTransfers = fantasySeason.free_transfers ?? 2;

    // Phase 2: Parallel squad info and lineup query
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
          .map((s) => (typeof lineupRow[`${s}_id`] === 'number' ? (lineupRow[`${s}_id`] as number) : lineupRow[`${s}_id`] ? Number(lineupRow[`${s}_id`]) : null))
          .filter((id): id is number => id !== null)
      : [];

    // Collect all player IDs needed for prices and player profiles
    const allPricePlayerIds = Array.from(new Set([...squadPlayerIds, ...starterIds]));
    const allDetailPlayerIds = Array.from(
      new Set([
        ...starterIds,
        ...(lineupRow?.captain_player_id ? [Number(lineupRow.captain_player_id)] : []),
        ...(lineupRow?.vice_captain_player_id ? [Number(lineupRow.vice_captain_player_id)] : []),
      ])
    );

    type StarterQueryPlayer = {
      id: number;
      name: string;
      in_game_name: string | null;
      primary_role: string;
      professional_teams: { name: string } | null;
    };

    // Phase 3: Parallel prices and player details
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
            .select('id, name, in_game_name, primary_role, professional_teams(name)')
            .in('id', allDetailPlayerIds) as unknown as Promise<{ data: StarterQueryPlayer[] | null }>)
        : Promise.resolve({ data: [] }),
    ]);

    // Build latest prices lookup map
    const latestPrices = new Map<number, number>();
    for (const price of pricesRes.data ?? []) {
      if (!latestPrices.has(price.player_id)) {
        latestPrices.set(price.player_id, Number(price.price ?? 0));
      }
    }

    const squadValue = squadPlayerIds.reduce((total, playerId) => total + (latestPrices.get(playerId) ?? 0), 0);

    // Build players lookup map
    const playerMap = new Map((playersRes.data ?? []).map((p) => [p.id, p]));

    // Resolve captain and vice-captain from playerMap
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

    // Resolve starters
    const starters = lineupRow
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
              current_price: latestPrices.get(p.id) ?? 0,
              is_captain: lineupRow.captain_player_id === p.id,
              is_vice_captain: lineupRow.vice_captain_player_id === p.id,
              team_name: p.professional_teams?.name || null,
            };
          })
          .filter(Boolean)
      : [];

    const response = NextResponse.json({
      fantasySeasonId: fantasySeason.id,
      gameweek,
      totalPoints: fantasySeason.total_points || 0,
      globalRank: fantasySeason.global_rank,
      bankBalance: Number(fantasySeason.budget || 0),
      squadValue,
      freeTransfers,
      activeSquadCount: activeSquadCount || 0,
      squadName: (squad && 'name' in squad && typeof squad.name === 'string') ? squad.name : 'My Fantasy Squad',
      captain,
      viceCaptain,
      starters,
      leagueStandings: leagues || [],
    });
    applyRefreshedTokens(response, user);
    return response;

  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
