import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { getOrCreateFantasySeason } from '@/lib/fantasy-season';
import { buildTransferHistoryAnalytics, type PlayerGameweekPrice, type PlayerGameweekScore, type TransferAnalyticsRecord, type TransferGameweek, type TransferMember } from '@/lib/transfer-history-analytics';
import { withApiTelemetry } from '@/lib/api-telemetry';


interface TransferAuditRow {
  id: number;
  record_id: number | null;
  created_at: string;
  new_values: {
    transfers_in?: unknown;
    transfers_out?: unknown;
    penalty_points?: unknown;
    gameweek_id?: unknown;
  } | null;
}

interface PlayerRow {
  id: number;
  name: string | null;
  in_game_name: string | null;
}

interface GameweekRow {
  id: number;
  gameweek_number: number;
  season_id: number;
  status: string;
  end_date: string | null;
}

interface GameweekLabelRow {
  id: number;
  gameweek_number: number;
}

interface SquadMemberRow {
  player_id: number;
  cost: number;
  acquired_date: string;
  removed_date: string | null;
}

interface SquadRow {
  id: number;
  fantasy_season_id: number;
  fantasy_squad_members: SquadMemberRow[] | null;
}

interface PerformanceScoreRow {
  player_id: number;
  gameweek_id: number;
  fantasy_points_breakdown:
    | { total_points: number | null }
    | { total_points: number | null }[]
    | null;
}

function getPositiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function getPlayerIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is number => Number.isInteger(id) && Number(id) > 0);
}

async function getHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const supabase = supabaseServer();
    const currentFantasySeason = await getOrCreateFantasySeason(supabase, userId);
    const { data: fantasySeasons, error: seasonsError } = await supabase
      .from('fantasy_seasons')
      .select('id, season_id')
      .eq('user_id', userId);
    if (seasonsError) throw new Error(`Failed to load fantasy seasons: ${seasonsError.message}`);
    const seasonRows = (fantasySeasons ?? []) as Array<{ id: number; season_id: number }>;
    const fantasySeasonIds = seasonRows.map((season) => season.id);
    const seasonIds = [...new Set(seasonRows.map((season) => season.season_id))];
    const seasonIdByFantasySeasonId = new Map(seasonRows.map((season) => [season.id, season.season_id]));

    if (fantasySeasonIds.length === 0) {
      return NextResponse.json({
        transfers: [],
        analytics: {
          netBudgetChange: null,
          pricedTransactions: 0,
          totalTransactions: 0,
          squadValueHistory: [],
          bestTransfer: null,
          worstTransfer: null,
        },
      });
    }

    const { data: auditRows, error: auditError } = await supabase
      .from('audit_log')
      .select('id, record_id, created_at, new_values')
      .eq('changed_by', userId)
      .eq('action', 'TRANSFER')
      .eq('table_name', 'squad_players')
      .in('record_id', fantasySeasonIds)
      .order('created_at', { ascending: false })
      .limit(100);

    if (auditError) {
      throw new Error(`Failed to fetch transfer history: ${auditError.message}`);
    }

    const rows = (auditRows ?? []) as TransferAuditRow[];
    const { data: squadsData, error: squadsError } = await supabase
      .from('fantasy_squads')
      .select('id, fantasy_season_id, fantasy_squad_members(player_id, cost, acquired_date, removed_date)')
      .in('fantasy_season_id', fantasySeasonIds);
    if (squadsError) throw new Error(`Failed to load squad membership history: ${squadsError.message}`);
    const squads = (squadsData ?? []) as SquadRow[];
    const members: TransferMember[] = squads.flatMap((squad) =>
      (squad.fantasy_squad_members ?? []).map((member) => ({
        fantasySeasonId: squad.fantasy_season_id,
        playerId: Number(member.player_id),
        cost: Number(member.cost),
        acquiredAt: member.acquired_date,
        removedAt: member.removed_date,
      }))
    );

    const playerIds = [...new Set([
      ...rows.flatMap((row) => [
        ...getPlayerIds(row.new_values?.transfers_in),
        ...getPlayerIds(row.new_values?.transfers_out),
      ]),
      ...members.map((member) => member.playerId),
    ])];
    const gameweekIds = [...new Set(rows
      .map((row) => Number(row.new_values?.gameweek_id))
      .filter((id) => Number.isInteger(id) && id > 0))];

    const [playersResult, gameweeksResult, seasonGameweeksResult] = await Promise.all([
      playerIds.length
        ? supabase.from('professional_players').select('id, name, in_game_name').in('id', playerIds)
        : Promise.resolve({ data: [], error: null }),
      gameweekIds.length
        ? supabase.from('gameweeks').select('id, gameweek_number').in('id', gameweekIds)
        : Promise.resolve({ data: [], error: null }),
      seasonIds.length
        ? supabase.from('gameweeks').select('id, gameweek_number, season_id, status, end_date').in('season_id', seasonIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (playersResult.error) throw new Error(`Failed to fetch transferred player names: ${playersResult.error.message}`);
    if (gameweeksResult.error) throw new Error(`Failed to fetch transfer gameweeks: ${gameweeksResult.error.message}`);
    if (seasonGameweeksResult.error) throw new Error(`Failed to fetch fantasy season gameweeks: ${seasonGameweeksResult.error.message}`);

    const playersById = new Map<number, PlayerRow>(
      ((playersResult.data ?? []) as PlayerRow[]).map((player) => [player.id, player]),
    );
    const gameweeksById = new Map<number, number>(
      ((gameweeksResult.data ?? []) as GameweekLabelRow[]).map((gameweek) => [gameweek.id, gameweek.gameweek_number]),
    );

    const gameweeks = ((seasonGameweeksResult.data ?? []) as GameweekRow[]).map((gameweek): TransferGameweek => ({
      id: gameweek.id,
      seasonId: gameweek.season_id,
      gameweekNumber: gameweek.gameweek_number,
      status: gameweek.status,
      endDate: gameweek.end_date,
    }));

    const rawTransfers: TransferAnalyticsRecord[] = rows.map((row) => {
      const playersIn = getPlayerIds(row.new_values?.transfers_in);
      const playersOut = getPlayerIds(row.new_values?.transfers_out);
      const rawPenalty = row.new_values?.penalty_points;
      const penaltyPoints = typeof rawPenalty === 'number' && Number.isFinite(rawPenalty)
        ? rawPenalty
        : null;
      const gameweekId = Number(row.new_values?.gameweek_id);
      return {
        id: row.id,
        createdAt: row.created_at,
        fantasySeasonId: getPositiveInteger(row.record_id),
        seasonId: seasonIdByFantasySeasonId.get(getPositiveInteger(row.record_id) ?? -1) ?? null,
        gameweekId: Number.isInteger(gameweekId) && gameweekId > 0 ? gameweekId : null,
        gameweekNumber: gameweeksById.get(gameweekId) ?? null,
        penaltyPoints,
        moves: Array.from({ length: Math.max(playersOut.length, playersIn.length) }, (_, index) => {
          const playerOutId = playersOut[index];
          const playerInId = playersIn[index];
          return {
            playerOutId: playerOutId ?? null,
            playerInId: playerInId ?? null,
            playerOut: playerOutId
              ? playersById.get(playerOutId)?.in_game_name || playersById.get(playerOutId)?.name || `Player #${playerOutId}`
              : null,
            playerIn: playerInId
              ? playersById.get(playerInId)?.in_game_name || playersById.get(playerInId)?.name || `Player #${playerInId}`
              : null,
            budgetImpact: null,
            netPointsNextThreeGameweeks: null,
            scoredGameweeks: 0,
            scoringGameweeks: [],
          };
        }),
        budgetImpact: null,
      };
    });

    const historicalPlayerIds = [...new Set(rawTransfers.flatMap((transfer) =>
      transfer.moves.flatMap((move) => [move.playerOutId, move.playerInId])
        .filter((id): id is number => id !== null)
    ))];
    const allGameweekIds = gameweeks.map((gameweek) => gameweek.id);
    const historicalCurrentSeasonMemberIds = [...new Set(
      members
        .filter((member) => member.fantasySeasonId === currentFantasySeason?.id)
        .map((member) => member.playerId)
    )];
    const currentSeasonWeekIds = gameweeks
      .filter((gameweek) => gameweek.seasonId === currentFantasySeason?.season_id)
      .map((gameweek) => gameweek.id);

    const [performanceResult, priceResult] = await Promise.all([
      historicalPlayerIds.length > 0 && allGameweekIds.length > 0
        ? supabase.from('player_performances')
            .select('player_id, gameweek_id, fantasy_points_breakdown(total_points)')
            .in('player_id', historicalPlayerIds)
            .in('gameweek_id', allGameweekIds)
        : Promise.resolve({ data: [], error: null }),
      historicalCurrentSeasonMemberIds.length > 0 && currentSeasonWeekIds.length > 0 && currentFantasySeason?.season_id
        ? supabase.from('player_prices')
            .select('player_id, gameweek_id, price')
            .eq('season_id', currentFantasySeason.season_id)
            .in('player_id', historicalCurrentSeasonMemberIds)
            .in('gameweek_id', currentSeasonWeekIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (performanceResult.error) throw new Error(`Failed to load transfer performance details: ${performanceResult.error.message}`);
    if (priceResult.error) throw new Error(`Failed to load historical squad prices: ${priceResult.error.message}`);

    const scores: PlayerGameweekScore[] = ((performanceResult.data ?? []) as PerformanceScoreRow[]).map((row) => {
      const breakdown = Array.isArray(row.fantasy_points_breakdown)
        ? row.fantasy_points_breakdown[0]
        : row.fantasy_points_breakdown;
      return {
        playerId: Number(row.player_id),
        gameweekId: Number(row.gameweek_id),
        points: Number(breakdown?.total_points ?? 0),
      };
    });
    const prices: PlayerGameweekPrice[] = ((priceResult.data ?? []) as Array<{
      player_id: number;
      gameweek_id: number;
      price: number;
    }>).map((row) => ({
      playerId: Number(row.player_id),
      gameweekId: Number(row.gameweek_id),
      price: Number(row.price),
    }));

    const analytics = buildTransferHistoryAnalytics({
      transfers: rawTransfers,
      members,
      gameweeks,
      scores,
      prices,
      currentFantasySeasonId: currentFantasySeason?.id ?? null,
      currentSeasonId: currentFantasySeason?.season_id ?? null,
    });

    return NextResponse.json({
      transfers: analytics.transfers,
      analytics: {
        netBudgetChange: analytics.netBudgetChange,
        pricedTransactions: analytics.pricedTransactions,
        totalTransactions: analytics.totalTransactions,
        squadValueHistory: analytics.squadValueHistory,
        bestTransfer: analytics.bestTransfer,
        worstTransfer: analytics.worstTransfer,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load transfer history.';
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: number }).status)
      : 500;
    return NextResponse.json({ error: message }, { status: Number.isInteger(status) ? status : 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/fantasy/transfer-history', getHandler);
