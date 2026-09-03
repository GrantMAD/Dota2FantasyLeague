import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, type AuthError } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { logAuditAction } from '@/lib/audit-logger';

const slots = ['carry', 'mid', 'offlane', 'support', 'hard_support', 'bench_1', 'bench_2', 'bench_3'] as const;
type Slot = (typeof slots)[number];

function getSlotId(row: Record<string, unknown>, slot: Slot): number | null {
  const value = row[`${slot}_id`];
  return typeof value === 'number' ? value : value ? Number(value) : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const gameweekId = request.nextUrl.searchParams.get('gameweekId');
    if (!gameweekId) return NextResponse.json({ error: 'gameweekId is required.' }, { status: 400 });
    const supabase = supabaseServer();

    const { data: fantasySeason } = await (supabase.from('fantasy_seasons') as any).select('id').eq('id', request.nextUrl.searchParams.get('fantasySeasonId') || '').eq('user_id', user.userId).maybeSingle();
    const { data: ownedSeason } = fantasySeason ? { data: fantasySeason } : await (supabase.from('fantasy_seasons') as any).select('id').eq('user_id', user.userId).limit(1).maybeSingle();
    if (!ownedSeason) return NextResponse.json({ fantasySeasonId: null, gameweekId, lineup: [] });

    const { data: row, error } = await (supabase.from('fantasy_lineups') as any).select('*').eq('fantasy_season_id', ownedSeason.id).eq('gameweek_id', Number(gameweekId)).maybeSingle();
    if (error) return NextResponse.json({ error: 'Failed to fetch lineup.' }, { status: 500 });
    if (!row) return NextResponse.json({ fantasySeasonId: ownedSeason.id, gameweekId, lineup: [] });

    const playerIds = slots.map((slot) => getSlotId(row, slot)).filter((id): id is number => id !== null);
    const { data: players } = await (supabase.from('professional_players') as any).select('id, name, in_game_name, primary_role, profile_image_url, availability_status, current_price, professional_teams(id, name, tag)').in('id', playerIds);
    const playerMap = new Map((players ?? []).map((player: { id: number }) => [player.id, player]));
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

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const gameweekId = Number(body.gameweekId);
    const lineup = Array.isArray(body.lineup) ? body.lineup : [];
    if (!gameweekId || lineup.length !== 8) return NextResponse.json({ error: 'A complete eight-player lineup is required.' }, { status: 400 });
    const captains = lineup.filter((entry: { isCaptain?: boolean }) => entry.isCaptain);
    const viceCaptains = lineup.filter((entry: { isViceCaptain?: boolean }) => entry.isViceCaptain);
    if (captains.length !== 1 || viceCaptains.length !== 1) return NextResponse.json({ error: 'Select exactly one captain and one vice-captain.' }, { status: 400 });
    const bySlot = new Map<string, { playerId: number; isCaptain?: boolean; isViceCaptain?: boolean }>(lineup.map((entry: { slot: string; playerId: number; isCaptain?: boolean; isViceCaptain?: boolean }) => [entry.slot, entry]));
    if (slots.some((slot) => !bySlot.has(slot))) return NextResponse.json({ error: 'Every lineup slot must be filled.' }, { status: 400 });

    const supabase = supabaseServer();
    const { data: season } = await (supabase.from('fantasy_seasons') as any).select('id').eq('user_id', user.userId).limit(1).maybeSingle();
    if (!season) return NextResponse.json({ error: 'Fantasy season not found.' }, { status: 404 });
    const playerIds: number[] = lineup.map((entry: { playerId: number }) => Number(entry.playerId));
    if (new Set(playerIds).size !== playerIds.length) return NextResponse.json({ error: 'A player cannot occupy more than one lineup slot.' }, { status: 400 });
    const { data: squad } = await (supabase.from('fantasy_squads') as any).select('id').eq('fantasy_season_id', season.id).limit(1).maybeSingle();
    if (!squad) return NextResponse.json({ error: 'Fantasy squad not found.' }, { status: 404 });
    const { data: members } = await (supabase.from('fantasy_squad_members') as any).select('player_id, removed_date').eq('squad_id', squad.id).in('player_id', playerIds);
    const ownedIds = new Set((members ?? []).filter((member: { removed_date: string | null }) => !member.removed_date).map((member: { player_id: number }) => Number(member.player_id)));
    if (playerIds.some((playerId) => !ownedIds.has(playerId))) return NextResponse.json({ error: 'Every lineup player must belong to your active squad.' }, { status: 400 });
    const { data: gameweek } = await (supabase.from('gameweeks') as any).select('status, deadline').eq('id', gameweekId).maybeSingle();
    if (!gameweek) return NextResponse.json({ error: 'Gameweek not found.' }, { status: 404 });
    if (gameweek.status === 'closed' || (gameweek.deadline && new Date(gameweek.deadline) < new Date())) return NextResponse.json({ error: 'The gameweek deadline has passed. Lineup changes are locked.' }, { status: 400 });

    const row = {
      fantasy_season_id: season.id,
      gameweek_id: gameweekId,
      captain_player_id: captains[0].playerId,
      vice_captain_player_id: viceCaptains[0].playerId,
      carry_id: bySlot.get('carry')!.playerId,
      mid_id: bySlot.get('mid')!.playerId,
      offlane_id: bySlot.get('offlane')!.playerId,
      support_id: bySlot.get('support')!.playerId,
      hard_support_id: bySlot.get('hard_support')!.playerId,
      bench_1_id: bySlot.get('bench_1')!.playerId,
      bench_2_id: bySlot.get('bench_2')!.playerId,
      bench_3_id: bySlot.get('bench_3')!.playerId,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await (supabase.from('fantasy_lineups') as any).upsert(row, { onConflict: 'fantasy_season_id,gameweek_id' }).select().single();
    if (error) return NextResponse.json({ error: 'Failed to save lineup.' }, { status: 500 });
    await logAuditAction({ tableName: 'fantasy_lineups', recordId: data.id, action: 'LINEUP_CHANGE', changedBy: user.userId, newValues: { gameweek_id: gameweekId }, reason: 'User saved lineup' });
    return NextResponse.json({ message: 'Lineup saved successfully.', lineup: data });
  } catch (error: unknown) {
    const authError = error as AuthError;
    return NextResponse.json({ error: authError.status ? authError.message : 'Unable to save lineup.' }, { status: authError.status || 500 });
  }
}
