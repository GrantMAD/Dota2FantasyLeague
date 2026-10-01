import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, type AuthError } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { getOrCreateFantasySeason } from '@/lib/fantasy-season';

const slots = ['carry', 'mid', 'offlane', 'support', 'hard_support', 'bench_1', 'bench_2', 'bench_3'] as const;
type Slot = (typeof slots)[number];

interface LineupEntry {
  slot: Slot;
  player_id: number;
  is_starter: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
}

interface RemovedPlayerNotificationRow {
  id: number;
  title: string;
  message: string;
  metadata: { player_name?: string; refund_amount?: number } | null;
  created_at: string;
}

interface FantasyPlayerRow {
  id: number;
  name: string;
  in_game_name: string | null;
  primary_role: string | null;
  profile_image_url: string | null;
  availability_status: string | null;
  availability_reason: string | null;
  current_price: number | null;
  professional_teams: { id: number; name: string; slug: string } | { id: number; name: string; slug: string }[] | null;
}

interface PlayerPriceRow {
  player_id: number;
  price: number | null;
  gameweek_id: number;
}

interface GameweekScoreRow {
  player_id: number;
  total_points: number | null;
  gameweek_id: number;
}

type EnrichedFantasyPlayer = FantasyPlayerRow & {
  current_price: number;
  last_gw_points: number;
  recent_points: number;
  form_trend: 'up' | 'down' | 'flat';
};

function getSlotId(row: Record<string, unknown>, slot: Slot): number | null {
  const value = row[`${slot}_id`];
  return typeof value === 'number' ? value : value ? Number(value) : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const supabase = supabaseServer();

    // 1. Fetch user fantasy season (auto-provision if new user)
    const fantasySeason = await getOrCreateFantasySeason(supabase, user.userId);

    if (!fantasySeason || !fantasySeason.id) {
      return NextResponse.json({
        fantasySeasonId: null,
        seasonId: null,
        budget: 100,
        freeTransfers: 2,
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
    let lineupEntries: LineupEntry[] = [];
    let lineupPlayerIds: number[] = [];
    const ownedPlayerSet = new Set(ownedPlayerIds);

    if (targetGw) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lineupRow } = await (supabase.from('fantasy_lineups') as any)
        .select('*')
        .eq('fantasy_season_id', fantasySeason.id)
        .eq('gameweek_id', targetGw.id)
        .maybeSingle();

      if (lineupRow) {
        lineupEntries = slots
          .map((slot) => {
            const playerId = getSlotId(lineupRow, slot);
            if (!playerId) return null;
            // If the player is no longer owned (e.g. purged from pool), slot is vacant
            if (!ownedPlayerSet.has(playerId)) return null;
            return {
              slot,
              player_id: playerId,
              is_starter: !slot.startsWith('bench'),
              is_captain: lineupRow.captain_player_id === playerId,
              is_vice_captain: lineupRow.vice_captain_player_id === playerId,
            };
          })
          .filter((entry): entry is LineupEntry => entry !== null);

        lineupPlayerIds = lineupEntries.map((e) => e.player_id);
      }
    }

    // 4b. Fetch recent player_removed notifications to inform user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: removedNotifications } = await (supabase.from('user_notifications') as any)
      .select('id, title, message, metadata, created_at')
      .eq('user_id', user.userId)
      .eq('type', 'player_removed')
      .order('created_at', { ascending: false })
      .limit(5);

    const removedPlayersNotice = ((removedNotifications ?? []) as RemovedPlayerNotificationRow[]).map((notification) => ({
      id: notification.id,
      playerName: notification.metadata?.player_name || notification.title.replace('Player Removed: ', ''),
      refundAmount: Number(notification.metadata?.refund_amount ?? 5.0),
      message: notification.message,
      createdAt: notification.created_at,
    }));

    // 5. Gather all unique player IDs (owned + valid lineup) to fetch in single roundtrip
    const allRelevantPlayerIds = Array.from(new Set([...ownedPlayerIds, ...lineupPlayerIds]));

    const playerMap = new Map<number, EnrichedFantasyPlayer>();
    if (allRelevantPlayerIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: players } = await (supabase.from('professional_players') as any)
        .select('id, name, in_game_name, primary_role, profile_image_url, availability_status, availability_reason, professional_teams(id, name, slug)')
        .in('id', allRelevantPlayerIds);

       
      const [{ data: priceData }, { data: scoreData }] = await Promise.all([
        // The generated local schema does not include this table.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('player_prices') as any)
          .select('player_id, price, gameweek_id')
          .eq('season_id', fantasySeason.season_id)
          .in('player_id', allRelevantPlayerIds)
          .order('gameweek_id', { ascending: false }),
        // The generated local schema does not include this table.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from('gameweek_scores') as any)
          .select('player_id, total_points, gameweek_id')
          .in('player_id', allRelevantPlayerIds)
          .order('gameweek_id', { ascending: false }),
      ]);
          const prices = (priceData ?? []) as PlayerPriceRow[];
          const scores = (scoreData ?? []) as GameweekScoreRow[];

      const latestPrices = new Map<number, number>();
      for (const price of prices) {
        if (!latestPrices.has(price.player_id)) {
          latestPrices.set(price.player_id, Number(price.price ?? 0));
        }
      }

      const playerScoresMap = new Map<number, number[]>();
      for (const score of scores) {
        const list = playerScoresMap.get(score.player_id) ?? [];
        if (list.length < 5) list.push(Number(score.total_points ?? 0));
        playerScoresMap.set(score.player_id, list);
      }

      for (const p of (players ?? []) as FantasyPlayerRow[]) {
        const pScores = playerScoresMap.get(p.id) ?? [];
        const lastGwPts = pScores[0] ?? 0;
        const avgPts = pScores.length
          ? Number((pScores.reduce((sum, val) => sum + val, 0) / pScores.length).toFixed(1))
          : 0;

        // Form trend comparing latest score to average
        let trend: 'up' | 'down' | 'flat' = 'flat';
        if (pScores.length >= 2) {
          if (pScores[0] > pScores[1] + 1.0) trend = 'up';
          else if (pScores[0] < pScores[1] - 1.0) trend = 'down';
        }

        playerMap.set(p.id, {
          ...p,
          current_price: latestPrices.get(p.id) ?? Number(p.current_price ?? 0),
          last_gw_points: lastGwPts,
          recent_points: avgPts,
          form_trend: trend,
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
      removedPlayersNotice: removedPlayersNotice || [],
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
