import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, type AuthError } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { logAuditAction } from '@/lib/audit-logger';
import { withApiTelemetry } from '@/lib/api-telemetry';


const slots = ['carry', 'mid', 'offlane', 'support', 'hard_support', 'bench_1', 'bench_2', 'bench_3'] as const;
type Slot = (typeof slots)[number];
const starterSlots = ['carry', 'mid', 'offlane', 'support', 'hard_support'] as const;

interface LineupInput {
  playerId: number;
  slot: Slot;
  isCaptain: boolean;
  isViceCaptain: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getSlotId(row: Record<string, unknown>, slot: Slot): number | null {
  const value = row[`${slot}_id`];
  return typeof value === 'number' ? value : value ? Number(value) : null;
}

async function getHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const gameweekId = request.nextUrl.searchParams.get('gameweekId');
    if (!gameweekId) return NextResponse.json({ error: 'gameweekId is required.' }, { status: 400 });
    const supabase = supabaseServer();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fantasySeason } = await (supabase.from('fantasy_seasons') as any).select('id, season_id').eq('id', request.nextUrl.searchParams.get('fantasySeasonId') || '').eq('user_id', user.userId).maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ownedSeason } = fantasySeason ? { data: fantasySeason } : await (supabase.from('fantasy_seasons') as any).select('id, season_id').eq('user_id', user.userId).limit(1).maybeSingle();
    if (!ownedSeason) return NextResponse.json({ fantasySeasonId: null, gameweekId, lineup: [] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase.from('fantasy_lineups') as any).select('*').eq('fantasy_season_id', ownedSeason.id).eq('gameweek_id', Number(gameweekId)).maybeSingle();
    if (error) return NextResponse.json({ error: 'Failed to fetch lineup.' }, { status: 500 });
    if (!row) return NextResponse.json({ fantasySeasonId: ownedSeason.id, gameweekId, lineup: [] });

    const playerIds = slots.map((slot) => getSlotId(row, slot)).filter((id): id is number => id !== null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: players } = await (supabase.from('professional_players') as any)
      .select('id, name, in_game_name, primary_role, profile_image_url, availability_status, professional_teams(id, name, slug)')
      .in('id', playerIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: prices } = await (supabase.from('player_prices') as any)
      .select('player_id, price, gameweek_id')
      .eq('season_id', ownedSeason.season_id)
      .in('player_id', playerIds)
      .order('gameweek_id', { ascending: false });
    const latestPrices = new Map<number, number>();
    for (const price of prices ?? []) {
      if (!latestPrices.has(price.player_id)) latestPrices.set(price.player_id, Number(price.price ?? 0));
    }
    const playerMap = new Map((players ?? []).map((player: { id: number }) => [player.id, {
      ...player,
      current_price: latestPrices.get(player.id) ?? 0,
    }]));
    const lineup = slots.map((slot) => {
      const playerId = getSlotId(row, slot);
      return playerId ? { slot, player_id: playerId, is_starter: !slot.startsWith('bench'), is_captain: row.captain_player_id === playerId, is_vice_captain: row.vice_captain_player_id === playerId, professional_players: playerMap.get(playerId) } : null;
    }).filter(Boolean);
    return NextResponse.json({ fantasySeasonId: ownedSeason.id, gameweekId, lineup });
  } catch (error: unknown) {
    const authError = error as AuthError;
    return NextResponse.json({ error: authError.status ? authError.message : 'Unable to fetch lineup.' }, { status: authError.status || 500 });
  }
}

async function putHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    if (!isRecord(body) || !Number.isInteger(body.gameweekId) || Number(body.gameweekId) <= 0) {
      return NextResponse.json({ error: 'A valid gameweekId is required.' }, { status: 400 });
    }
    const gameweekId = Number(body.gameweekId);
    if (!Array.isArray(body.lineup) || body.lineup.length < starterSlots.length || body.lineup.length > slots.length) {
      return NextResponse.json({ error: 'Lineup must include all five starters and no more than eight players.' }, { status: 400 });
    }

    const lineup: LineupInput[] = [];
    for (const entry of body.lineup) {
      if (
        !isRecord(entry) ||
        !Number.isInteger(entry.playerId) ||
        Number(entry.playerId) <= 0 ||
        typeof entry.slot !== 'string' ||
        !slots.includes(entry.slot as Slot) ||
        typeof entry.isCaptain !== 'boolean' ||
        typeof entry.isViceCaptain !== 'boolean'
      ) {
        return NextResponse.json({ error: 'Each lineup entry must include a valid playerId, slot, captain, and vice-captain value.' }, { status: 400 });
      }
      lineup.push({
        playerId: Number(entry.playerId),
        slot: entry.slot as Slot,
        isCaptain: entry.isCaptain,
        isViceCaptain: entry.isViceCaptain,
      });
    }

    if (new Set(lineup.map((entry) => entry.slot)).size !== lineup.length) {
      return NextResponse.json({ error: 'Each lineup slot can only be assigned once.' }, { status: 400 });
    }
    if (new Set(lineup.map((entry) => entry.playerId)).size !== lineup.length) {
      return NextResponse.json({ error: 'A player cannot occupy more than one lineup slot.' }, { status: 400 });
    }
    if (starterSlots.some((slot) => !lineup.some((entry) => entry.slot === slot))) {
      return NextResponse.json({ error: 'Fill all five starting roles before saving the lineup.' }, { status: 400 });
    }

    const captains = lineup.filter((entry) => entry.isCaptain);
    const viceCaptains = lineup.filter((entry) => entry.isViceCaptain);
    const starterPlayerIds = new Set(lineup.filter((entry) => starterSlots.includes(entry.slot as (typeof starterSlots)[number])).map((entry) => entry.playerId));
    if (
      captains.length !== 1 ||
      viceCaptains.length !== 1 ||
      captains[0].playerId === viceCaptains[0].playerId ||
      !starterPlayerIds.has(captains[0].playerId) ||
      !starterPlayerIds.has(viceCaptains[0].playerId)
    ) {
      return NextResponse.json({ error: 'Select one different captain and vice-captain from the starting lineup.' }, { status: 400 });
    }
    const bySlot = new Map(lineup.map((entry) => [entry.slot, entry]));

    const supabase = supabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: season } = await (supabase.from('fantasy_seasons') as any).select('id').eq('user_id', user.userId).limit(1).maybeSingle();
    if (!season) return NextResponse.json({ error: 'Fantasy season not found.' }, { status: 404 });

    const playerIds = lineup.map((entry) => entry.playerId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: squad } = await (supabase.from('fantasy_squads') as any).select('id').eq('fantasy_season_id', season.id).limit(1).maybeSingle();
    if (!squad) return NextResponse.json({ error: 'Fantasy squad not found.' }, { status: 404 });

    if (playerIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: members } = await (supabase.from('fantasy_squad_members') as any).select('player_id, removed_date').eq('squad_id', squad.id).in('player_id', playerIds);
      const ownedIds = new Set((members ?? []).filter((member: { removed_date: string | null }) => !member.removed_date).map((member: { player_id: number }) => Number(member.player_id)));
      if (playerIds.some((playerId) => !ownedIds.has(playerId))) return NextResponse.json({ error: 'Every lineup player must belong to your active squad.' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: players, error: playersError } = await (supabase.from('professional_players') as any)
      .select('id, primary_role')
      .in('id', playerIds);
    if (playersError) return NextResponse.json({ error: 'Failed to validate lineup player roles.' }, { status: 500 });
    const playerRoleById = new Map<number, string>((players ?? []).map((player: { id: number; primary_role: string | null }) => [Number(player.id), player.primary_role ?? '']));
    const requiredRoleBySlot: Partial<Record<Slot, string>> = {
      carry: 'carry',
      mid: 'mid',
      offlane: 'offlane',
    };
    for (const entry of lineup.filter((item) => starterSlots.includes(item.slot as (typeof starterSlots)[number]))) {
      const role = (playerRoleById.get(entry.playerId) ?? '').trim().toLowerCase().replaceAll(' ', '_');
      const roleIsValid =
        requiredRoleBySlot[entry.slot] === role ||
        ((entry.slot === 'support' || entry.slot === 'hard_support') && (role === 'support' || role === 'hard_support'));
      if (!roleIsValid) {
        return NextResponse.json({ error: `Player ${entry.playerId} does not match the ${entry.slot.replaceAll('_', ' ')} role.` }, { status: 400 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: gameweek } = await (supabase.from('gameweeks') as any).select('status, deadline').eq('id', gameweekId).maybeSingle();
    if (!gameweek) return NextResponse.json({ error: 'Gameweek not found.' }, { status: 404 });
    if (gameweek.status === 'closed' || (gameweek.deadline && new Date(gameweek.deadline) < new Date())) return NextResponse.json({ error: 'The gameweek deadline has passed. Lineup changes are locked.' }, { status: 400 });

    const row = {
      fantasy_season_id: season.id,
      gameweek_id: gameweekId,
      captain_player_id: captains[0].playerId,
      vice_captain_player_id: viceCaptains[0].playerId,
      carry_id: bySlot.get('carry')?.playerId ?? null,
      mid_id: bySlot.get('mid')?.playerId ?? null,
      offlane_id: bySlot.get('offlane')?.playerId ?? null,
      support_id: bySlot.get('support')?.playerId ?? null,
      hard_support_id: bySlot.get('hard_support')?.playerId ?? null,
      bench_1_id: bySlot.get('bench_1')?.playerId ?? null,
      bench_2_id: bySlot.get('bench_2')?.playerId ?? null,
      bench_3_id: bySlot.get('bench_3')?.playerId ?? null,
      updated_at: new Date().toISOString(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('fantasy_lineups') as any).upsert(row, { onConflict: 'fantasy_season_id,gameweek_id' }).select().single();
    if (error) return NextResponse.json({ error: 'Failed to save lineup.' }, { status: 500 });
    await logAuditAction({ tableName: 'fantasy_lineups', recordId: data.id, action: 'LINEUP_CHANGE', changedBy: user.userId, newValues: { gameweek_id: gameweekId }, reason: 'User saved lineup' });
    return NextResponse.json({ message: 'Lineup saved successfully.', lineup: data });
  } catch (error: unknown) {
    const authError = error as AuthError;
    return NextResponse.json({ error: authError.status ? authError.message : 'Unable to save lineup.' }, { status: authError.status || 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/fantasy/lineup', getHandler);
export const PUT = withApiTelemetry('PUT', '/api/fantasy/lineup', putHandler);
