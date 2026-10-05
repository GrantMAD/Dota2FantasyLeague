import { NextRequest, NextResponse } from 'next/server';
import { AuthError, verifyAuth } from '@/lib/auth-utils';
import { getOrCreateFantasySeason } from '@/lib/fantasy-season';
import { supabaseServer } from '@/lib/supabase';

interface AnnouncementEvent {
  kind: 'tournament' | 'gameweek';
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
  kind: 'price_change' | 'availability';
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

export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const supabase = supabaseServer();
    const fantasySeason = await getOrCreateFantasySeason(supabase, userId);

    if (!fantasySeason?.season_id) {
      return NextResponse.json({ event: null, gameweek: null, updates: [] });
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const nowIso = now.toISOString();
    const [
      tournamentResult,
      latestStartedGameweekResult,
      currentGameweekResult,
      squadResult,
    ] = await Promise.all([
      supabase
        .from('tournaments')
        .select('id, name, start_date, tier')
        .eq('season_id', fantasySeason.season_id)
        .eq('eligible', true)
        .neq('status', 'archived')
        .lte('start_date', today)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('gameweeks')
        .select('id, gameweek_number, start_date')
        .eq('season_id', fantasySeason.season_id)
        .lte('start_date', nowIso)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('gameweeks')
        .select('id, gameweek_number, start_date, deadline, status')
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

    if (tournamentResult.error) {
      throw new Error(`Failed to fetch latest started tournament: ${tournamentResult.error.message}`);
    }
    if (latestStartedGameweekResult.error) {
      throw new Error(`Failed to fetch latest started gameweek: ${latestStartedGameweekResult.error.message}`);
    }
    if (currentGameweekResult.error) {
      throw new Error(`Failed to fetch current gameweek context: ${currentGameweekResult.error.message}`);
    }
    if (squadResult.error) {
      throw new Error(`Failed to fetch fantasy squad: ${squadResult.error.message}`);
    }

    const latestStartedGameweek = latestStartedGameweekResult.data;
    const tournament = tournamentResult.data;
    const tournamentStartedAt = tournament ? `${tournament.start_date}T00:00:00.000Z` : null;
    const tournamentIsNewestEvent = tournament && (
      !latestStartedGameweek
      || Date.parse(tournamentStartedAt!) > Date.parse(latestStartedGameweek.start_date)
    );
    const event: AnnouncementEvent | null = tournamentIsNewestEvent && tournament && tournamentStartedAt ? {
        kind: 'tournament',
        id: tournament.id,
        title: tournament.name,
        startedAt: tournamentStartedAt,
        href: `/tournaments/${tournament.id}`,
        tier: tournament.tier,
      } : null;

    if (event) {
      const { data: series, error: seriesError } = await supabase
        .from('tournament_series')
        .select('id, best_of')
        .eq('tournament_id', event.id);
      if (seriesError) {
        throw new Error(`Failed to fetch tournament series: ${seriesError.message}`);
      }

      const seriesRows = series ?? [];
      const seriesIds = seriesRows.map((row) => row.id);
      const bestOfFormats = [...new Set(
        seriesRows.map((row) => Number(row.best_of)).filter((bestOf) => Number.isFinite(bestOf) && bestOf > 0),
      )].sort((left, right) => left - right);
      let matchCount = 0;
      if (seriesIds.length > 0) {
        const { count, error: matchesError } = await supabase
          .from('matches')
          .select('id', { count: 'exact', head: true })
          .in('series_id', seriesIds);
        if (matchesError) {
          throw new Error(`Failed to count tournament matches: ${matchesError.message}`);
        }
        matchCount = count ?? 0;
      }

      event.seriesCount = seriesRows.length;
      event.matchCount = matchCount;
      event.bestOfFormats = bestOfFormats;
    }

    const currentGameweek = currentGameweekResult.data;
    let gameweek = null;
    if (currentGameweek) {
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('status')
        .eq('gameweek_id', currentGameweek.id);
      if (matchesError) {
        throw new Error(`Failed to fetch current gameweek match counts: ${matchesError.message}`);
      }
      gameweek = {
        id: currentGameweek.id,
        number: currentGameweek.gameweek_number,
        status: currentGameweek.status,
        startsAt: currentGameweek.start_date,
        deadline: currentGameweek.deadline,
        matchCount: matches?.length ?? 0,
        matchStatuses: countStatuses(matches ?? []),
        href: `/gameweeks/${currentGameweek.id}`,
      };
    }

    const updates: AnnouncementUpdate[] = [];
    if (squadResult.data) {
      const { data: members, error: membersError } = await supabase
        .from('fantasy_squad_members')
        .select('player_id')
        .eq('squad_id', squadResult.data.id)
        .is('removed_date', null);
      if (membersError) {
        throw new Error(`Failed to fetch active squad members: ${membersError.message}`);
      }
      const ownedPlayerIds = new Set((members ?? []).map((member) => Number(member.player_id)));
      if (ownedPlayerIds.size > 0) {
        const updateWindowStart = event?.startedAt
          ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: notifications, error: notificationsError } = await supabase
          .from('user_notifications')
          .select('id, type, title, message, created_at, metadata')
          .eq('user_id', userId)
          .eq('is_read', false)
          .in('type', ['price_change', 'system'])
          .gte('created_at', updateWindowStart)
          .order('created_at', { ascending: false })
          .limit(20);
        if (notificationsError) {
          throw new Error(`Failed to fetch player updates: ${notificationsError.message}`);
        }

        for (const notification of (notifications ?? []) as NotificationRow[]) {
          const playerId = Number(notification.metadata?.player_id);
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

          if (updates.length === 5) break;
        }
      }
    }

    return NextResponse.json({ event, gameweek, updates });
  } catch (error: unknown) {
    console.error('Dashboard What’s New API Error:', error);
    const authError = error as AuthError;
    return NextResponse.json(
      { error: authError.status ? authError.message : 'Unable to load dashboard announcements.' },
      { status: authError.status || 500 },
    );
  }
}
