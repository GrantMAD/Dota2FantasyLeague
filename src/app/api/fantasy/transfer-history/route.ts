import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';


interface TransferAuditRow {
  id: number;
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
}

function getPlayerIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is number => Number.isInteger(id) && Number(id) > 0);
}

async function getHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const supabase = supabaseServer();
    const { data: auditRows, error: auditError } = await supabase
      .from('audit_log')
      .select('id, created_at, new_values')
      .eq('changed_by', userId)
      .eq('action', 'TRANSFER')
      .eq('table_name', 'squad_players')
      .order('created_at', { ascending: false })
      .limit(100);

    if (auditError) {
      throw new Error(`Failed to fetch transfer history: ${auditError.message}`);
    }

    const rows = (auditRows ?? []) as TransferAuditRow[];
    const playerIds = [...new Set(rows.flatMap((row) => [
      ...getPlayerIds(row.new_values?.transfers_in),
      ...getPlayerIds(row.new_values?.transfers_out),
    ]))];
    const gameweekIds = [...new Set(rows
      .map((row) => Number(row.new_values?.gameweek_id))
      .filter((id) => Number.isInteger(id) && id > 0))];

    const [playersResult, gameweeksResult] = await Promise.all([
      playerIds.length
        ? supabase.from('professional_players').select('id, name, in_game_name').in('id', playerIds)
        : Promise.resolve({ data: [], error: null }),
      gameweekIds.length
        ? supabase.from('gameweeks').select('id, gameweek_number').in('id', gameweekIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (playersResult.error) throw new Error(`Failed to fetch transferred player names: ${playersResult.error.message}`);
    if (gameweeksResult.error) throw new Error(`Failed to fetch transfer gameweeks: ${gameweeksResult.error.message}`);

    const playersById = new Map<number, PlayerRow>(
      ((playersResult.data ?? []) as PlayerRow[]).map((player) => [player.id, player]),
    );
    const gameweeksById = new Map<number, number>(
      ((gameweeksResult.data ?? []) as GameweekRow[]).map((gameweek) => [gameweek.id, gameweek.gameweek_number]),
    );

    const transfers = rows.map((row) => {
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
        gameweekNumber: gameweeksById.get(gameweekId) ?? null,
        penaltyPoints,
        moves: Array.from({ length: Math.max(playersOut.length, playersIn.length) }, (_, index) => {
          const playerOutId = playersOut[index];
          const playerInId = playersIn[index];
          return {
            playerOut: playerOutId
              ? playersById.get(playerOutId)?.in_game_name || playersById.get(playerOutId)?.name || `Player #${playerOutId}`
              : null,
            playerIn: playerInId
              ? playersById.get(playerInId)?.in_game_name || playersById.get(playerInId)?.name || `Player #${playerInId}`
              : null,
          };
        }),
      };
    });

    return NextResponse.json({ transfers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load transfer history.';
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: number }).status)
      : 500;
    return NextResponse.json({ error: message }, { status: Number.isInteger(status) ? status : 500 });
  }
}

export const GET = withApiTelemetry('GET', '/api/fantasy/transfer-history', getHandler);
