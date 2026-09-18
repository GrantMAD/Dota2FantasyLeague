import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, type AuthError } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';

const slots = ['carry', 'mid', 'offlane', 'support', 'hard_support', 'bench_1', 'bench_2', 'bench_3'] as const;
type Slot = (typeof slots)[number];

function getSlotId(row: Record<string, unknown>, slot: Slot): number | null {
  const value = row[`${slot}_id`];
  return typeof value === 'number' ? value : value ? Number(value) : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const supabase = supabaseServer();

    // 1. Fetch user fantasy season (base columns that are guaranteed to exist)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fantasySeason, error: seasonError } = await (supabase.from('fantasy_seasons') as any)
      .select('id, season_id, budget, free_transfers, total_points, global_rank')
      .eq('user_id', user.userId)
      .limit(1)
      .maybeSingle();

    if (seasonError) {
      console.error('[fantasy/context] fantasy_seasons query error:', seasonError);
      return NextResponse.json({ error: 'Failed to fetch fantasy season', details: seasonError.message }, { status: 500 });
    }

    if (!fantasySeason) {
      return NextResponse.json({
        fantasySeasonId: null,
        seasonId: null,
        budget: 0,
        freeTransfers: 0,
        totalPoints: 0,
        globalRank: null,
        gameweek: null,
        chips: {
          tripleCaptainUsed: false,
          tripleCaptainGameweekId: null,
          benchBoostUsed: false,
          benchBoostGameweekId: null,
          wildcardUsed: false,
          wildcardUsedGameweekId: null,
        },
        lineup: [],
        ownedPlayerIds: [],
        ownedPlayers: [],
      });
    }

    // 1b. Try to fetch chip columns separately — they may not exist in all DB versions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chipQueryResult = await (supabase.from('fantasy_seasons') as any)
      .select('triple_captain_used_gameweek_id, bench_boost_used_gameweek_id, wildcard_used_gameweek_id')
      .eq('id', fantasySeason.id)
      .maybeSingle();
    // If columns don't exist, chipQueryResult.error will be set — fall back to empty object
    const chipsRow = (!chipQueryResult.error && chipQueryResult.data) ? chipQueryResult.data : {};

    // 2. Fetch Gameweeks: Look for active first, then upcoming, then fallback to latest closed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: gameweekRows } = await (supabase.from('gameweeks') as any)
      .select('id, gameweek_number, status, start_date, end_date, deadline')
      .order('id', { ascending: true });

    const allGws = gameweekRows || [];
    const activeGw = allGws.find((gw: { status: string }) => gw.status === 'active');
    const upcomingGw = allGws.find(
      (gw: { status: string; deadline?: string }) => gw.status === 'upcoming' && (!gw.deadline || new Date(gw.deadline) > new Date())
    );
    const targetGw = activeGw || upcomingGw || allGws[allGws.length - 1] || null;

    let gameweekInfo = null;
    if (targetGw) {
      const isPastDeadline = Boolean(targetGw.deadline && new Date(targetGw.deadline) < new Date());
      const isLocked = targetGw.status === 'closed' || isPastDeadline;
      gameweekInfo = {
        id: targetGw.id,
        gameweekNumber: targetGw.gameweek_number,
        status: targetGw.status,
        deadline: targetGw.deadline,
        isLocked,
        hasUpcoming: Boolean(upcomingGw),
      };
    }

    // 3. Fetch Squad and Members
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: squad } = await (supabase.from('fantasy_squads') as any)
      .select('id, fantasy_squad_members(player_id, removed_date)')
      .eq('fantasy_season_id', fantasySeason.id)
      .limit(1)
      .maybeSingle();

    const ownedPlayerIds: number[] = (squad?.fantasy_squad_members ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((member: any) => !member.removed_date)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((member: any) => Number(member.player_id));

    // 4. Fetch Target Gameweek Lineup
    let lineupEntries: any[] = [];
    let lineupPlayerIds: number[] = [];

    if (targetGw) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lineupRow } = await (supabase.from('fantasy_lineups') as any)
        .select('*')
        .eq('fantasy_season_id', fantasySeason.id)
        .eq('gameweek_id', targetGw.id)
        .maybeSingle();

      if (lineupRow) {
        lineupPlayerIds = slots
          .map((slot) => getSlotId(lineupRow, slot))
          .filter((id): id is number => id !== null);

        lineupEntries = slots
          .map((slot) => {
            const playerId = getSlotId(lineupRow, slot);
            if (!playerId) return null;
            return {
              slot,
              player_id: playerId,
              is_starter: !slot.startsWith('bench'),
              is_captain: lineupRow.captain_player_id === playerId,
              is_vice_captain: lineupRow.vice_captain_player_id === playerId,
            };
          })
          .filter(Boolean);
      }
    }

    // 5. Gather all unique player IDs (owned + in lineup) to fetch in single roundtrip
    const allRelevantPlayerIds = Array.from(new Set([...ownedPlayerIds, ...lineupPlayerIds]));

    let playerMap = new Map<number, any>();
    if (allRelevantPlayerIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: players } = await (supabase.from('professional_players') as any)
        .select('id, name, in_game_name, primary_role, profile_image_url, availability_status, professional_teams(id, name, slug)')
        .in('id', allRelevantPlayerIds);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prices } = await (supabase.from('player_prices') as any)
        .select('player_id, price, gameweek_id')
        .eq('season_id', fantasySeason.season_id)
        .in('player_id', allRelevantPlayerIds)
        .order('gameweek_id', { ascending: false });

      const latestPrices = new Map<number, number>();
      for (const price of prices ?? []) {
        if (!latestPrices.has(price.player_id)) {
          latestPrices.set(price.player_id, Number(price.price ?? 0));
        }
      }

      for (const p of players ?? []) {
        playerMap.set(p.id, {
          ...p,
          current_price: latestPrices.get(p.id) ?? 0,
        });
      }
    }

    // Attach player details to lineup
    const populatedLineup = lineupEntries.map((entry) => ({
      ...entry,
      professional_players: playerMap.get(entry.player_id) || null,
    }));

    const ownedPlayers = ownedPlayerIds
      .map((id) => playerMap.get(id))
      .filter(Boolean);

    return NextResponse.json({
      fantasySeasonId: fantasySeason.id,
      seasonId: fantasySeason.season_id,
      budget: Number(fantasySeason.budget ?? 0),
      freeTransfers: Number(fantasySeason.free_transfers ?? 1),
      totalPoints: Number(fantasySeason.total_points ?? 0),
      globalRank: fantasySeason.global_rank ?? null,
      gameweek: gameweekInfo,
      chips: {
        tripleCaptainUsed: chipsRow.triple_captain_used_gameweek_id != null,
        tripleCaptainGameweekId: chipsRow.triple_captain_used_gameweek_id ?? null,
        benchBoostUsed: chipsRow.bench_boost_used_gameweek_id != null,
        benchBoostGameweekId: chipsRow.bench_boost_used_gameweek_id ?? null,
        wildcardUsed: chipsRow.wildcard_used_gameweek_id != null,
        wildcardUsedGameweekId: chipsRow.wildcard_used_gameweek_id ?? null,
      },
      lineup: populatedLineup,
      ownedPlayerIds,
      ownedPlayers,
    });
  } catch (error: unknown) {
    console.error('[fantasy/context] Unhandled error:', error);
    const authError = error as AuthError;
    return NextResponse.json(
      { error: authError.status ? authError.message : 'Unable to load fantasy context.' },
      { status: authError.status || 500 }
    );
  }
}
