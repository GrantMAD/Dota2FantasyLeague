import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth-utils';
import { FantasyScoreCalculator } from '@/lib/jobs/calculate-fantasy-scores';
import { buildSimulationReport, type ScoringSample } from '@/lib/scoring-analytics';
import { supabaseServer } from '@/lib/supabase';

const MAX_PERFORMANCES = 500;

interface HistoricalMatch {
  id: number;
  gameweek_id: number;
  duration_minutes: number;
  winner_team_id: number;
}

interface HistoricalPlayer {
  id: number;
  primary_role: string;
}

interface HistoricalMatchStat {
  match_id: number;
  player_id: number;
  team_id: number;
}

export async function POST(request: NextRequest) {
  try {
    await verifyAdminAuth(request);
    const body = await request.json().catch(() => ({}));
    const seasonId = Number(body.seasonId ?? 1);
    const gameweekFrom = body.gameweekFrom ? Number(body.gameweekFrom) : null;
    const gameweekTo = body.gameweekTo ? Number(body.gameweekTo) : null;
    const supabase = supabaseServer();

    let performanceQuery = (supabase.from('player_performances') as any)
      .select('*')
      .order('gameweek_id', { ascending: true })
      .limit(MAX_PERFORMANCES);
    if (gameweekFrom !== null) performanceQuery = performanceQuery.gte('gameweek_id', gameweekFrom);
    if (gameweekTo !== null) performanceQuery = performanceQuery.lte('gameweek_id', gameweekTo);

    const { data: performances, error: performanceError } = await performanceQuery;
    if (performanceError) return NextResponse.json({ error: 'Failed to load historical performances.' }, { status: 500 });
    if (!performances || performances.length === 0) return NextResponse.json({ error: 'No historical performances matched the selected range.' }, { status: 404 });

    const matchIds = [...new Set(performances.map((performance: { match_id: number }) => performance.match_id))];
    const playerIds = [...new Set(performances.map((performance: { player_id: number }) => performance.player_id))];
    const [{ data: matches }, { data: players }, { data: matchStats }] = await Promise.all([
      (supabase.from('matches') as any).select('id, gameweek_id, duration_minutes, winner_team_id').in('id', matchIds),
      (supabase.from('professional_players') as any).select('id, primary_role').in('id', playerIds),
      (supabase.from('match_player_stats') as any).select('match_id, player_id, team_id').in('match_id', matchIds),
    ]);

    const matchMap = new Map<number, HistoricalMatch>((matches ?? []).map((match: HistoricalMatch) => [match.id, match]));
    const playerMap = new Map<number, HistoricalPlayer>((players ?? []).map((player: HistoricalPlayer) => [player.id, player]));
    const statMap = new Map<string, HistoricalMatchStat>((matchStats ?? []).map((stat: HistoricalMatchStat) => [`${stat.match_id}:${stat.player_id}`, stat]));
    const calculator = new FantasyScoreCalculator();
    await calculator.loadScoringRules(seasonId);
    const samples: ScoringSample[] = [];

    for (const performance of performances) {
      const match = matchMap.get(performance.match_id);
      if (!match) continue;
      const stat = statMap.get(`${performance.match_id}:${performance.player_id}`);
      const breakdown = await calculator.calculatePlayerMatchScore(
        {
          ...performance,
          tower_damage: performance.building_damage ?? 0,
          roshan_kills: performance.roshan_participation ?? 0,
        },
        match,
        stat?.team_id ?? 0,
      );
      const totalPoints = breakdown.combat + breakdown.economy + breakdown.objective + breakdown.teamfight + breakdown.win + breakdown.series + breakdown.performance + breakdown.consistency - breakdown.penalty;
      samples.push({
        role: playerMap.get(performance.player_id)?.primary_role ?? 'Support',
        playerId: performance.player_id,
        totalPoints,
        price: 0,
        ownershipPercentage: 0,
        captainPoints: 0,
        gameweekId: performance.gameweek_id,
      });
    }

    const gameweeks = [...new Set(samples.map((sample) => sample.gameweekId).filter((id): id is number => id !== undefined))];
    return NextResponse.json(buildSimulationReport(samples, { seasonId, gameweeks, matchesProcessed: matchIds.length }));
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to run historical scoring simulation.' }, { status });
  }
}
