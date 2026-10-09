import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth-utils';
import { FantasyScoreCalculator } from '@/lib/jobs/calculate-fantasy-scores';
import { withApiTelemetry } from '@/lib/api-telemetry';


async function postHandler(request: NextRequest) {
  try {
    await verifyAdminAuth(request);

    const body = (await request.json()) as {
      seasonId?: string | number;
      matchId?: string | number;
      playerId?: string | number;
      teamId?: string | number;
      metrics?: Record<string, unknown>;
    };
    const { seasonId = 1, matchId, playerId, teamId, metrics } = body;

    if (!matchId || !playerId || !teamId || !metrics) {
      return NextResponse.json({ error: 'Missing required simulation parameters' }, { status: 400 });
    }

    const calculator = new FantasyScoreCalculator();
    await calculator.loadScoringRules(parseInt(String(seasonId), 10));

    // Prepare mock data matching the required interfaces
    const mockStats = {
      player_id: parseInt(String(playerId), 10),
      match_id: parseInt(String(matchId), 10),
      team_id: parseInt(String(teamId), 10),
      ...metrics
    } as unknown as Parameters<FantasyScoreCalculator['calculatePlayerMatchScore']>[0];

    const mockMatch = {
      id: parseInt(String(matchId), 10),
      duration_minutes: metrics.duration_minutes || 40,
      winner_team_id: metrics.winner_team_id || parseInt(String(teamId), 10)
    } as unknown as Parameters<FantasyScoreCalculator['calculatePlayerMatchScore']>[1];

    const breakdown = await calculator.calculatePlayerMatchScore(
      mockStats,
      mockMatch,
      parseInt(String(teamId), 10)
    );

    return NextResponse.json(breakdown);
  } catch (error: unknown) {
    console.error('Error simulating scores:', error);
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number(error.status)
      : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to simulate scores.' },
      { status }
    );
  }
}

export const POST = withApiTelemetry('POST', '/api/admin/scoring/simulate', postHandler);
