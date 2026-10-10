import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { getOrCreateFantasySeason } from '@/lib/fantasy-season';
import { deliverPushNotifications } from '@/lib/push-notifications';
import { withApiTelemetry } from '@/lib/api-telemetry';


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
  created_at: string | null;
  league_participants: Array<{
    id: number;
    user_id: string;
    points: number;
    rank: number | null;
    wins: number;
    losses: number;
    draws: number;
    users: { username: string; display_name: string | null; avatar_url: string | null; bio: string | null } | null;
    fantasy_seasons?: { gameweek_points_latest: number | null } | null;
  }>;
  head_to_head_matchups: Array<{
    id: number;
    gameweek_id: number;
    points_a: number;
    points_b: number;
    winner_id: number | null;
    is_bye: boolean;
    participant_a: { users: { username: string; display_name: string | null; avatar_url: string | null } | null } | null;
    participant_b: { users: { username: string; display_name: string | null; avatar_url: string | null } | null } | null;
  }>;
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
    createdAt: league.created_at ?? new Date().toISOString(),
    standings: league.league_participants.map((participant) => ({
      userId: participant.user_id,
      manager: participant.users?.display_name || participant.users?.username || 'Manager',
      username: participant.users?.username || 'Manager',
      displayName: participant.users?.display_name || null,
      avatarUrl: participant.users?.avatar_url || null,
      bio: participant.users?.bio || null,
      points: Number(participant.points ?? 0),
      gwPoints: Number(participant.fantasy_seasons?.gameweek_points_latest ?? 0),
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
      homeAvatarUrl: matchup.participant_a?.users?.avatar_url || null,
      away: matchup.participant_b?.users?.display_name || matchup.participant_b?.users?.username || 'Bye',
      awayUsername: matchup.participant_b?.users?.username || null,
      awayAvatarUrl: matchup.participant_b?.users?.avatar_url || null,
      homePoints: Number(matchup.points_a ?? 0),
      awayPoints: Number(matchup.points_b ?? 0),
      winnerId: matchup.winner_id,
      isBye: matchup.is_bye,
    })),
  };
}

async function getHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const type = request.nextUrl.searchParams.get('type');
    const privacy = request.nextUrl.searchParams.get('privacy');
    const supabase = supabaseServer();

    // Query leagues where user is a participant so we can enforce privacy directly in SQL
    let userLeagueIds: number[] = [];
    if (privacy !== 'public') {
      const { data: userMemberships, error: membershipError } = await supabase
        .from('league_participants')
        .select('league_id')
        .eq('user_id', user.userId);
      if (membershipError) {
        return NextResponse.json({ error: 'Failed to load user league memberships.' }, { status: 500 });
      }
      userLeagueIds = (userMemberships ?? []).map((m: { league_id: number }) => m.league_id);
    }

    if (privacy === 'private' && userLeagueIds.length === 0) {
      return NextResponse.json({
        leagues: [],
        count: 0,
        lastRecalculatedAt: null,
      });
    }

    let query = supabase.from('leagues')
      .select('id, name, league_type, privacy_level, description, max_participants, current_participants, invite_code, status, created_at, league_participants(id, user_id, points, rank, wins, losses, draws, users(id, username, display_name, avatar_url, bio), fantasy_seasons(gameweek_points_latest)), head_to_head_matchups(id, gameweek_id, points_a, points_b, winner_id, is_bye, participant_a:league_participants!participant_a_id(users(id, username, display_name, avatar_url, bio)), participant_b:league_participants!participant_b_id(users(id, username, display_name, avatar_url, bio)))')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (type && type !== 'all') {
      query = query.in('league_type', type === 'h2h' ? ['h2h', 'head_to_head'] : ['classic']);
    }

    if (privacy === 'public') {
      query = query.eq('privacy_level', 'public');
    } else if (privacy === 'private') {
      query = query.eq('privacy_level', 'private').in('id', userLeagueIds);
    } else {
      // Default / 'all': Show all public leagues OR private leagues where user is a participant
      if (userLeagueIds.length > 0) {
        query = query.or(`privacy_level.neq.private,id.in.(${userLeagueIds.join(',')})`);
      } else {
        query = query.neq('privacy_level', 'private');
      }
    }

    const [{ data, error }, { data: recalculation, error: recalculationError }] = await Promise.all([
      query,
      supabase
        .from('job_execution_log')
        .select('completed_at')
        .eq('job_name', 'recalculate-leagues')
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (error) return NextResponse.json({ error: 'Failed to load leagues.' }, { status: 500 });
    if (recalculationError) {
      return NextResponse.json({ error: 'Failed to load the latest league standings update time.' }, { status: 500 });
    }

    const leagues = (data ?? []) as unknown as LeagueRow[];
    return NextResponse.json({
      leagues: leagues.map(serializeLeague),
      count: leagues.length,
      lastRecalculatedAt: recalculation?.completed_at ?? null,
    });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load leagues.' }, { status });
  }
}

async function postHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json() as Record<string, unknown>;
    const supabase = supabaseServer();

    if (body.action === 'join') {
      const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim().toUpperCase() : '';
      if (!inviteCode) return NextResponse.json({ error: 'Invite code is required to join a league.' }, { status: 400 });

      // Call the atomic join RPC to lock the league row, enforce capacity limits, and increment current_participants atomically
      const { data: rpcResult, error: rpcError } = await supabase.rpc('join_league_atomic', {
        p_user_id: user.userId,
        p_invite_code: inviteCode,
      });

      if (rpcError) {
        return NextResponse.json({ error: 'Failed to join league.', details: rpcError.message }, { status: 500 });
      }

      const result = rpcResult as {
        success: boolean;
        status?: number;
        message?: string;
        league?: {
          id: number;
          season_id: number;
          name: string;
          creator_id: string;
          max_participants: number | null;
          current_participants: number;
          invite_code: string;
          league_type: string;
          privacy_level: string;
          description: string | null;
          status: string;
        };
      };

      if (!result.success || !result.league) {
        return NextResponse.json({ error: result.message || 'Failed to join league.' }, { status: result.status || 400 });
      }

      const league = result.league;

      // Deliver push notification to the league creator if someone else joined
      if (league.creator_id && league.creator_id !== user.userId) {
        try {
          const delivery = await deliverPushNotifications(supabase, [{
            userId: league.creator_id,
            type: 'league_invite',
            metadata: { league_id: league.id },
          }]);
          if (delivery.errors.length > 0) {
            console.error('League activity push delivery reported an issue:', delivery.errors.join('; '));
          }
        } catch (error: unknown) {
          console.error(
            'Unable to deliver a league activity push notification:',
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      return NextResponse.json({
        data: {
          ...league,
          type: league.league_type === 'head_to_head' ? 'h2h' : 'classic',
          privacyLevel: league.privacy_level,
          maxParticipants: league.max_participants,
          currentParticipants: league.current_participants,
          inviteCode: league.invite_code,
          standings: [],
          fixtures: [],
        },
        message: result.message || `Joined ${league.name} successfully.`,
      });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'League name is required.' }, { status: 400 });
    const fantasySeason = await getOrCreateFantasySeason(supabase, user.userId);
    if (!fantasySeason || fantasySeason.id === 0) return NextResponse.json({ error: 'Create a fantasy team before creating a league.' }, { status: 400 });
    const leagueType = body.type === 'h2h' ? 'head_to_head' : 'classic';
    const maxParticipants = Math.min(32, Math.max(4, Number(body.maxParticipants) || 10));
    const inviteCode = `${name.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { data: league, error: leagueError } = await supabase.from('leagues').insert({ creator_id: user.userId, season_id: fantasySeason.season_id, name, description: typeof body.description === 'string' ? body.description.trim() : null, league_type: leagueType, scoring_type: leagueType === 'head_to_head' ? 'weekly_wins' : 'total_points', privacy_level: body.privacyLevel === 'public' ? 'public' : 'private', max_participants: maxParticipants, current_participants: 1, invite_code: inviteCode, status: 'active' }).select('id, name, league_type, privacy_level, description, max_participants, current_participants, invite_code, status').single();
    if (leagueError || !league) return NextResponse.json({ error: 'Failed to create league.', details: leagueError?.message }, { status: 500 });
    const { error: participantError } = await supabase.from('league_participants').insert({ league_id: league.id, user_id: user.userId, fantasy_season_id: fantasySeason.id });
    if (participantError) return NextResponse.json({ error: 'League created but membership could not be added.' }, { status: 500 });
    return NextResponse.json({ data: { ...league, type: leagueType === 'head_to_head' ? 'h2h' : 'classic', privacyLevel: league.privacy_level, maxParticipants: league.max_participants, currentParticipants: league.current_participants, inviteCode: league.invite_code, standings: [], fixtures: [] }, message: 'League created successfully.' }, { status: 201 });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to process league request.' }, { status });
  }
}

export const GET = withApiTelemetry('GET', '/api/leagues', getHandler);
export const POST = withApiTelemetry('POST', '/api/leagues', postHandler);
