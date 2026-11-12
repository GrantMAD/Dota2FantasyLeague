import { NextRequest, NextResponse } from 'next/server';
import { AuthError, verifyAuth } from '@/lib/auth-utils';
import { getOrCreateFantasySeason } from '@/lib/fantasy-season';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';
import { fetchGameweekTournaments } from '@/lib/dashboard/gameweek-tournaments';


interface AnnouncementEvent {
  kind: 'tournament';
  id: number;
  title: string;
  startedAt: string;
  href: string;
  tier?: string | null;
  seriesCount?: number;
  matchCount?: number;
  bestOfFormats?: number[];
  deadline?: string | null;
  matchStatuses?: Record<string, number>;
}

interface AnnouncementUpdate {
  id: number;
  kind: 'price_change' | 'availability' | 'league';
  title: string;
  message: string;
  createdAt: string;
  href: string;
}

interface NotificationRow {
  id: number;
  type: string;
  title: string;
  message: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

function countStatuses(statuses: Array<{ status: string | null }>) {
  return statuses.reduce<Record<string, number>>((counts, match) => {
    const status = match.status ?? 'unknown';
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

async function getHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const supabase = supabaseServer();
    const fantasySeason = await getOrCreateFantasySeason(supabase, userId);

    if (!fantasySeason?.season_id) {
      return NextResponse.json({ events: [], gameweek: null, updates: [] });
    }

    const now = new Date();
    const [
      currentGameweekResult,
      squadResult,
    ] = await Promise.all([
      supabase
        .from('gameweeks')
        .select('id, gameweek_number, start_date, end_date, deadline, status')
        .eq('season_id', fantasySeason.season_id)
        .in('status', ['active', 'upcoming'])
        .order('start_date', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('fantasy_squads')
        .select('id')
        .eq('fantasy_season_id', fantasySeason.id)
        .maybeSingle(),
    ]);

    if (currentGameweekResult.error) {
      throw new Error(`Failed to fetch current gameweek context: ${currentGameweekResult.error.message}`);
    }
    if (squadResult.error) {
      throw new Error(`Failed to fetch fantasy squad: ${squadResult.error.message}`);
    }

    const currentGameweek = currentGameweekResult.data;
    const gameweekTournamentData = currentGameweek
      ? await fetchGameweekTournaments(supabase, fantasySeason.season_id, currentGameweek.id)
      : { matches: [], tournaments: [] };
    const events: AnnouncementEvent[] = gameweekTournamentData.tournaments.map((tournament) => ({
      kind: 'tournament',
      id: tournament.id,
      title: tournament.name,
      startedAt: `${tournament.start_date}T00:00:00.000Z`,
      href: `/tournaments/${tournament.id}`,
      tier: tournament.tier,
      seriesCount: tournament.seriesCount,
      matchCount: tournament.matchCount,
      bestOfFormats: tournament.bestOfFormats,
    }));

    let gameweek = null;
    if (currentGameweek) {
      const gameweekEndTime = new Date(currentGameweek.end_date).getTime();
      gameweek = {
        id: currentGameweek.id,
        number: currentGameweek.gameweek_number,
        status: currentGameweek.status,
        startsAt: currentGameweek.start_date,
          isCurrent: currentGameweek.status === 'active'
          || new Date(currentGameweek.start_date).getTime() <= now.getTime(),
        endsSoon: currentGameweek.status === 'active'
          && gameweekEndTime > now.getTime()
          && gameweekEndTime - now.getTime() <= 24 * 60 * 60 * 1000,
        deadline: currentGameweek.deadline,
        matchCount: gameweekTournamentData.matches.length,
        matchStatuses: countStatuses(gameweekTournamentData.matches),
        href: `/gameweeks/${currentGameweek.id}`,
      };
    }

    const updates: AnnouncementUpdate[] = [];
    const ownedPlayerIds = new Set<number>();
    if (squadResult.data) {
      const { data: members, error: membersError } = await supabase
        .from('fantasy_squad_members')
        .select('player_id')
        .eq('squad_id', squadResult.data.id)
        .is('removed_date', null);
      if (membersError) {
        throw new Error(`Failed to fetch active squad members: ${membersError.message}`);
      }
      for (const m of members ?? []) {
        ownedPlayerIds.add(Number(m.player_id));
      }
    }

    const { data: notifications, error: notificationsError } = await supabase
      .from('user_notifications')
      .select('id, type, title, message, created_at, metadata')
      .eq('user_id', userId)
      .eq('is_read', false)
      .in('type', ['price_change', 'system', 'h2h_result', 'league_result', 'player_removed', 'player_unavailable'])
      .order('created_at', { ascending: false })
      .limit(20);
    if (notificationsError) {
      throw new Error(`Failed to fetch player updates: ${notificationsError.message}`);
    }

        for (const notification of (notifications ?? []) as NotificationRow[]) {
          const leagueId = Number(notification.metadata?.league_id);
          if (Number.isSafeInteger(leagueId) && leagueId > 0) {
            updates.push({
              id: notification.id,
              kind: 'league',
              title: notification.title,
              message: notification.message,
              createdAt: notification.created_at,
              href: `/leagues?leagueId=${leagueId}`,
            });
            if (updates.length === 20) break;
            continue;
          }

          const playerId = Number(notification.metadata?.player_id);
          if (notification.type === 'player_removed') {
            updates.push({
              id: notification.id,
              kind: 'availability',
              title: notification.title,
              message: notification.message,
              createdAt: notification.created_at,
              href: '/transfers',
            });
            if (updates.length === 20) break;
            continue;
          }

          if (!Number.isInteger(playerId) || !ownedPlayerIds.has(playerId)) continue;

          if (notification.type === 'price_change') {
            updates.push({
              id: notification.id,
              kind: 'price_change',
              title: notification.title,
              message: notification.message,
              createdAt: notification.created_at,
              href: `/players/${playerId}`,
            });
          } else if (
            notification.type === 'system'
            && notification.metadata?.action === 'swap_required'
          ) {
            updates.push({
              id: notification.id,
              kind: 'availability',
              title: notification.title,
              message: notification.message,
              createdAt: notification.created_at,
              href: `/players/${playerId}`,
            });
          }

          if (updates.length === 20) break;
        }

    return NextResponse.json({ events, gameweek, updates });
  } catch (error: unknown) {
    console.error('Dashboard What’s New API Error:', error);
    const authError = error as AuthError;
    return NextResponse.json(
      { error: authError.status ? authError.message : 'Unable to load dashboard announcements.' },
      { status: authError.status || 500 },
    );
  }
}

export const GET = withApiTelemetry('GET', '/api/dashboard/whats-new', getHandler);
