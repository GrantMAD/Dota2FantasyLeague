import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';
import type { TransferRushData, TransferRushPlayer, TransferRushPulse } from '@/types/fantasy';

interface AuditTransferRow {
  id: number;
  created_at: string;
  new_values: {
    transfers_in?: unknown;
    transfers_out?: unknown;
    gameweek_id?: unknown;
  } | null;
}

interface PlayerLookupRow {
  id: number;
  name: string | null;
  in_game_name: string | null;
  role: string | null;
  current_price: number | null;
  professional_teams: {
    name: string | null;
    logo_url: string | null;
  } | null;
}

interface GameweekRow {
  id: number;
  gameweek_number: number;
  deadline: string | null;
  status: string;
}

/**
 * Parses numeric ID list from audit log array safely.
 */
function extractPlayerIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((val) => Number(val))
    .filter((id) => Number.isInteger(id) && id > 0);
}

/**
 * Builds aggregated milestone pulses based on observed transfer velocity and volumes.
 */
function generateActivityPulses(
  transfersInCounts: Map<number, number>,
  transfersOutCounts: Map<number, number>,
  playerMap: Map<number, PlayerLookupRow>,
  totalTransfers: number,
  transfersPerMinute: number,
  nowIso: string
): TransferRushPulse[] {
  const pulses: TransferRushPulse[] = [];

  // Velocity pulse
  if (transfersPerMinute >= 1) {
    pulses.push({
      id: 'velocity-current',
      type: 'velocity',
      message: `Transfer rush active: ~${Math.round(transfersPerMinute)} transfers/min across all leagues.`,
      timestamp: nowIso,
    });
  } else if (totalTransfers > 0) {
    pulses.push({
      id: 'volume-summary',
      type: 'velocity',
      message: `${totalTransfers} manager transfers logged ahead of the deadline.`,
      timestamp: nowIso,
    });
  }

  // Find top transferred in player
  let topInId: number | null = null;
  let topInCount = 0;
  for (const [id, count] of transfersInCounts.entries()) {
    if (count > topInCount) {
      topInCount = count;
      topInId = id;
    }
  }

  if (topInId && topInCount > 0) {
    const player = playerMap.get(topInId);
    const pName = player?.in_game_name || player?.name || `Player #${topInId}`;
    pulses.push({
      id: `top-in-${topInId}`,
      type: 'milestone',
      message: `Surging demand: ${topInCount} managers transferred in ${pName}.`,
      highlightPlayerName: pName,
      timestamp: nowIso,
    });
  }

  // Find top transferred out player
  let topOutId: number | null = null;
  let topOutCount = 0;
  for (const [id, count] of transfersOutCounts.entries()) {
    if (count > topOutCount) {
      topOutCount = count;
      topOutId = id;
    }
  }

  if (topOutId && topOutCount > 0 && topOutId !== topInId) {
    const player = playerMap.get(topOutId);
    const pName = player?.in_game_name || player?.name || `Player #${topOutId}`;
    pulses.push({
      id: `top-out-${topOutId}`,
      type: 'milestone',
      message: `Heavy rotation: ${topOutCount} managers transferred out ${pName}.`,
      highlightPlayerName: pName,
      timestamp: nowIso,
    });
  }

  if (pulses.length === 0) {
    pulses.push({
      id: 'calm-window',
      type: 'milestone',
      message: 'Quiet market window. Beat the deadline rush before lock!',
      timestamp: nowIso,
    });
  }

  return pulses;
}

async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const windowMinutesParam = searchParams.get('windowMinutes');
    const windowMinutes = Math.min(
      Math.max(windowMinutesParam ? parseInt(windowMinutesParam, 10) || 60 : 60, 5),
      1440
    );

    const supabase = supabaseServer();
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Fetch current active or upcoming gameweek
    const { data: gameweeks, error: gwError } = await supabase
      .from('gameweeks')
      .select('id, gameweek_number, deadline, status')
      .in('status', ['upcoming', 'active'])
      .order('gameweek_number', { ascending: true })
      .limit(2);

    if (gwError) {
      console.error('[TransferRush] Failed to load gameweeks:', gwError);
    }

    const gwList = (gameweeks ?? []) as GameweekRow[];
    // Pick upcoming first (where deadline hasn't passed), or active gameweek
    const targetGw = gwList.find((g) => g.status === 'upcoming') || gwList[0] || null;

    let secondsRemaining = 0;
    let isLocked = true;
    let isRushActive = false;

    if (targetGw && targetGw.deadline) {
      const deadlineDate = new Date(targetGw.deadline);
      const diffMs = deadlineDate.getTime() - now.getTime();
      secondsRemaining = Math.max(0, Math.floor(diffMs / 1000));
      isLocked = targetGw.status === 'closed' || targetGw.status === 'locked' || diffMs <= 0;
      // Rush considered active in final 2 hours before deadline
      isRushActive = !isLocked && diffMs <= 2 * 60 * 60 * 1000 && diffMs > 0;
    }

    // 2. Fetch transfer audit records within window
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000).toISOString();

    const { data: auditData, error: auditError } = await supabase
      .from('audit_log')
      .select('id, created_at, new_values')
      .eq('action', 'TRANSFER')
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })
      .limit(500);

    if (auditError) {
      console.error('[TransferRush] Failed to fetch audit logs:', auditError);
      return NextResponse.json(
        { error: 'Unable to fetch transfer rush data' },
        { status: 500 }
      );
    }

    const auditRows = (auditData ?? []) as AuditTransferRow[];

    // 3. Aggregate transfers in and out
    const transfersInCounts = new Map<number, number>();
    const transfersOutCounts = new Map<number, number>();
    let totalTransfersInWindow = 0;

    for (const row of auditRows) {
      const transfersIn = extractPlayerIds(row.new_values?.transfers_in);
      const transfersOut = extractPlayerIds(row.new_values?.transfers_out);

      totalTransfersInWindow += Math.max(transfersIn.length, transfersOut.length);

      for (const id of transfersIn) {
        transfersInCounts.set(id, (transfersInCounts.get(id) || 0) + 1);
      }
      for (const id of transfersOut) {
        transfersOutCounts.set(id, (transfersOutCounts.get(id) || 0) + 1);
      }
    }

    const transfersPerMinute = windowMinutes > 0 ? totalTransfersInWindow / windowMinutes : 0;

    // 4. Collect top player IDs to hydrate player details
    const topInEntries = Array.from(transfersInCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topOutEntries = Array.from(transfersOutCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const relevantPlayerIds = Array.from(
      new Set([...topInEntries.map(([id]) => id), ...topOutEntries.map(([id]) => id)])
    );

    const playerMap = new Map<number, PlayerLookupRow>();
    if (relevantPlayerIds.length > 0) {
      const { data: playersData, error: playersError } = await supabase
        .from('professional_players')
        .select(`
          id,
          name,
          in_game_name,
          role,
          current_price,
          professional_teams (
            name,
            logo_url
          )
        `)
        .in('id', relevantPlayerIds);

      if (!playersError && playersData) {
        for (const p of playersData as unknown as PlayerLookupRow[]) {
          playerMap.set(p.id, p);
        }
      }
    }

    const mapToPlayerObj = (id: number, count: number): TransferRushPlayer => {
      const p = playerMap.get(id);
      return {
        id,
        name: p?.name || `Player #${id}`,
        inGameName: p?.in_game_name || null,
        teamName: p?.professional_teams?.name || null,
        teamLogoUrl: p?.professional_teams?.logo_url || null,
        role: p?.role || null,
        currentPrice: Number(p?.current_price ?? 5.0),
        transferCount: count,
      };
    };

    const topTransferredIn: TransferRushPlayer[] = topInEntries.map(([id, count]) =>
      mapToPlayerObj(id, count)
    );
    const topTransferredOut: TransferRushPlayer[] = topOutEntries.map(([id, count]) =>
      mapToPlayerObj(id, count)
    );

    const activityPulses = generateActivityPulses(
      transfersInCounts,
      transfersOutCounts,
      playerMap,
      totalTransfersInWindow,
      transfersPerMinute,
      nowIso
    );

    const responsePayload: TransferRushData = {
      gameweek: targetGw
        ? {
            id: targetGw.id,
            gameweekNumber: targetGw.gameweek_number,
            deadline: targetGw.deadline,
            status: targetGw.status,
            isLocked,
            secondsRemaining,
          }
        : null,
      windowMinutes,
      totalTransfersInWindow,
      transfersPerMinute: Math.round(transfersPerMinute * 10) / 10,
      topTransferredIn,
      topTransferredOut,
      activityPulses,
      isRushActive,
    };

    return NextResponse.json(responsePayload, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
      },
    });
  } catch (err) {
    console.error('[TransferRush] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error processing transfer rush' },
      { status: 500 }
    );
  }
}

export const GET = withApiTelemetry('GET', '/api/fantasy/transfer-rush', getHandler);
