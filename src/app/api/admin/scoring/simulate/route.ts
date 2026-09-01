import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { FantasyScoreCalculator } from '@/lib/jobs/calculate-fantasy-scores';

export async function POST(request: NextRequest) {
  try {
    await verifyAuth(request);

    const body = await request.json();
    const { seasonId = 1, matchId, playerId, teamId, metrics } = body;

    if (!matchId || !playerId || !teamId || !metrics) {
      return NextResponse.json({ error: 'Missing required simulation parameters' }, { status: 400 });
    }

    const calculator = new FantasyScoreCalculator();
    await calculator.loadScoringRules(parseInt(seasonId, 10));

    // Prepare mock data matching the required interfaces
    const mockStats: any = {
      player_id: parseInt(playerId, 10),
      match_id: parseInt(matchId, 10),
      team_id: parseInt(teamId, 10),
      ...metrics
    };

    const mockMatch: any = {
      id: parseInt(matchId, 10),
      duration_minutes: metrics.duration_minutes || 40,
      winner_team_id: metrics.winner_team_id || parseInt(teamId, 10)
    };

    const breakdown = await calculator.calculatePlayerMatchScore(
      mockStats,
      mockMatch,
      parseInt(teamId, 10)
    );

    return NextResponse.json(breakdown);
  } catch (error: any) {
    console.error('Error simulating scores:', error);
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
