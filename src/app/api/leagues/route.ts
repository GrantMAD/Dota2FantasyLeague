import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';

interface LeagueRow {
  id: number;
  name: string;
  league_type: string;
  privacy_level: string;
  description: string | null;
  max_participants: number | null;
  current_participants: number;
  invite_code: string | null;
  status: string;
  league_participants: Array<{ id: number; user_id: string; points: number; rank: number | null; wins: number; losses: number; draws: number; users: { username: string; display_name: string | null } | null; fantasy_seasons?: { gameweek_points_latest: number | null } | null }>;
  head_to_head_matchups: Array<{ id: number; gameweek_id: number; points_a: number; points_b: number; winner_id: number | null; is_bye: boolean; participant_a: { users: { username: string; display_name: string | null } | null } | null; participant_b: { users: { username: string; display_name: string | null } | null } | null }>;
}

function serializeLeague(league: LeagueRow) {
  return {
    id: league.id,
    name: league.name,
    type: league.league_type === 'head_to_head' || league.league_type === 'h2h' ? 'h2h' : 'classic',
    privacyLevel: league.privacy_level,
    description: league.description ?? '',
    maxParticipants: league.max_participants ?? 32,
    currentParticipants: league.current_participants,
    inviteCode: league.invite_code ?? '',
    status: league.status,
    standings: league.league_participants.map((participant) => ({
      userId: participant.user_id,
      manager: participant.users?.display_name || participant.users?.username || 'Manager',
      username: participant.users?.username || 'Manager',
      displayName: participant.users?.display_name || null,
      avatarUrl: (participant.users as any)?.avatar_url || null,
      bio: (participant.users as any)?.bio || null,
      points: Number(participant.points ?? 0),
      gwPoints: Number((participant as any)?.fantasy_seasons?.gameweek_points_latest ?? 0),
      rank: participant.rank,
      wins: participant.wins ?? 0,
      losses: participant.losses ?? 0,
      draws: participant.draws ?? 0,
      form: [],
    })),
    fixtures: league.head_to_head_matchups.map((matchup) => ({
      id: matchup.id,
      leagueId: league.id,
      leagueName: league.name,
      gameweekId: matchup.gameweek_id,
      home: matchup.participant_a?.users?.display_name || matchup.participant_a?.users?.username || 'Manager',
      homeUsername: matchup.participant_a?.users?.username || 'Manager',
      homeAvatarUrl: (matchup.participant_a?.users as any)?.avatar_url || null,
      away: matchup.participant_b?.users?.display_name || matchup.participant_b?.users?.username || 'Bye',
      awayUsername: matchup.participant_b?.users?.username || null,
      awayAvatarUrl: (matchup.participant_b?.users as any)?.avatar_url || null,
      homePoints: Number(matchup.points_a ?? 0),
      awayPoints: Number(matchup.points_b ?? 0),
      winnerId: matchup.winner_id,
      isBye: matchup.is_bye,
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const type = request.nextUrl.searchParams.get('type');
    const privacy = request.nextUrl.searchParams.get('privacy');
    const supabase = supabaseServer();
    let query = (supabase.from('leagues') as any)
      .select('id, name, league_type, privacy_level, description, max_participants, current_participants, invite_code, status, league_participants(id, user_id, points, rank, wins, losses, draws, users(id, username, display_name, avatar_url, bio), fantasy_seasons(gameweek_points_latest)), head_to_head_matchups(id, gameweek_id, points_a, points_b, winner_id, is_bye, participant_a:league_participants!participant_a_id(users(id, username, display_name, avatar_url, bio)), participant_b:league_participants!participant_b_id(users(id, username, display_name, avatar_url, bio)))')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (type && type !== 'all') query = query.in('league_type', type === 'h2h' ? ['h2h', 'head_to_head'] : ['classic']);
    if (privacy && privacy !== 'all') query = query.eq('privacy_level', privacy);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: 'Failed to load leagues.' }, { status: 500 });
    const leagues = ((data ?? []) as LeagueRow[]).filter((league) => league.privacy_level !== 'private' || league.league_participants.some((participant) => participant.user_id === user.userId));
    return NextResponse.json({ data: leagues.map(serializeLeague), count: leagues.length });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load leagues.' }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const supabase = supabaseServer();

    if (body.action === 'join') {
      const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim().toUpperCase() : '';
      if (!inviteCode) return NextResponse.json({ error: 'Invite code is required to join a league.' }, { status: 400 });
      const { data: league, error: leagueError } = await (supabase.from('leagues') as any).select('id, name, max_participants, current_participants, invite_code, league_type, privacy_level, description, status').eq('invite_code', inviteCode).eq('status', 'active').maybeSingle();
      if (leagueError || !league) return NextResponse.json({ error: 'That invite code does not match an active league.' }, { status: 404 });
      if (league.max_participants && league.current_participants >= league.max_participants) return NextResponse.json({ error: 'This league is full.' }, { status: 409 });
      const { data: fantasySeason } = await (supabase.from('fantasy_seasons') as any).select('id').eq('user_id', user.userId).limit(1).maybeSingle();
      if (!fantasySeason) return NextResponse.json({ error: 'Create a fantasy team before joining a league.' }, { status: 400 });
      const { error: participantError } = await (supabase.from('league_participants') as any).insert({ league_id: league.id, user_id: user.userId, fantasy_season_id: fantasySeason.id });
      if (participantError) return NextResponse.json({ error: participantError.code === '23505' ? 'You are already in this league.' : 'Failed to join league.' }, { status: participantError.code === '23505' ? 409 : 500 });
      await (supabase.from('leagues') as any).update({ current_participants: league.current_participants + 1 }).eq('id', league.id);
      return NextResponse.json({ data: { ...league, type: league.league_type === 'head_to_head' ? 'h2h' : 'classic', privacyLevel: league.privacy_level, maxParticipants: league.max_participants, currentParticipants: league.current_participants + 1, inviteCode: league.invite_code, standings: [], fixtures: [] }, message: `Joined ${league.name} successfully.` });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'League name is required.' }, { status: 400 });
    const { data: fantasySeason } = await (supabase.from('fantasy_seasons') as any).select('id, season_id').eq('user_id', user.userId).limit(1).maybeSingle();
    if (!fantasySeason) return NextResponse.json({ error: 'Create a fantasy team before creating a league.' }, { status: 400 });
    const leagueType = body.type === 'h2h' ? 'head_to_head' : 'classic';
    const maxParticipants = Math.min(32, Math.max(4, Number(body.maxParticipants) || 10));
    const inviteCode = `${name.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { data: league, error: leagueError } = await (supabase.from('leagues') as any).insert({ creator_id: user.userId, season_id: fantasySeason.season_id, name, description: typeof body.description === 'string' ? body.description.trim() : null, league_type: leagueType, scoring_type: leagueType === 'head_to_head' ? 'weekly_wins' : 'total_points', privacy_level: body.privacyLevel === 'public' ? 'public' : 'private', max_participants: maxParticipants, current_participants: 1, invite_code: inviteCode, status: 'active' }).select('id, name, league_type, privacy_level, description, max_participants, current_participants, invite_code, status').single();
    if (leagueError || !league) return NextResponse.json({ error: 'Failed to create league.', details: leagueError?.message }, { status: 500 });
    const { error: participantError } = await (supabase.from('league_participants') as any).insert({ league_id: league.id, user_id: user.userId, fantasy_season_id: fantasySeason.id });
    if (participantError) return NextResponse.json({ error: 'League created but membership could not be added.' }, { status: 500 });
    return NextResponse.json({ data: { ...league, type: leagueType === 'head_to_head' ? 'h2h' : 'classic', privacyLevel: league.privacy_level, maxParticipants: league.max_participants, currentParticipants: league.current_participants, inviteCode: league.invite_code, standings: [], fixtures: [] }, message: 'League created successfully.' }, { status: 201 });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to process league request.' }, { status });
  }
}
