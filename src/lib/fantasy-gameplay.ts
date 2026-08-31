export interface BenchPlayer {
  id: number;
  name: string;
  role: string;
  available: boolean;
  points: number;
}

export interface StarterSlot {
  id: number;
  name: string;
  role: string;
  available: boolean;
  points: number;
}

export interface BenchResolution {
  starter: string;
  replacement: string | null;
  wasSubstituted: boolean;
  reason: string;
}

export function resolveBenchSubstitution(
  starters: StarterSlot[],
  bench: BenchPlayer[],
): BenchResolution[] {
  return starters.map((starter) => {
    if (starter.available) {
      return {
        starter: starter.name,
        replacement: null,
        wasSubstituted: false,
        reason: 'Starter was active and remained in the lineup.',
      };
    }

    const replacement = bench.find(
      (player) => player.role === starter.role && player.available,
    );

    if (!replacement) {
      return {
        starter: starter.name,
        replacement: null,
        wasSubstituted: false,
        reason: 'No eligible bench player could replace the inactive starter.',
      };
    }

    return {
      starter: starter.name,
      replacement: replacement.name,
      wasSubstituted: true,
      reason: `${replacement.name} replaced ${starter.name} because they matched the required role and were available.`,
    };
  });
}

export interface SeasonSnapshot {
  seasonName: string;
  week: number;
  totalPoints: number;
  transfersUsed: number;
  activeSquadCount: number;
  updatedAt: string;
}

export function persistSeasonSnapshot(snapshot: SeasonSnapshot): SeasonSnapshot {
  const persisted = {
    ...snapshot,
    updatedAt: new Date().toISOString(),
  };

  return persisted;
}

export function buildSeasonSummary(
  seasonName: string,
  week: number,
  totalPoints: number,
  transfersUsed: number,
  activeSquadCount: number,
): SeasonSnapshot {
  return persistSeasonSnapshot({
    seasonName,
    week,
    totalPoints,
    transfersUsed,
    activeSquadCount,
    updatedAt: new Date().toISOString(),
  });
}

export interface PlayerPriceChange {
  playerId: number;
  playerName: string;
  previousPrice: number;
  currentPrice: number;
  change: number;
  trend: 'up' | 'down' | 'flat';
}

export function simulatePriceDynamics(
  playerId: number,
  playerName: string,
  previousPrice: number,
  pointsDelta: number,
): PlayerPriceChange {
  const multiplier = pointsDelta >= 0 ? 1.2 : 0.88;
  const currentPrice = Math.max(1, Math.round(previousPrice * multiplier));
  const change = currentPrice - previousPrice;

  return {
    playerId,
    playerName,
    previousPrice,
    currentPrice,
    change,
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
  };
}

export interface HeadToHeadResult {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  winner: string;
  summary: string;
}

export function simulateHeadToHead(
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
): HeadToHeadResult {
  const winner = homeScore === awayScore ? 'Draw' : homeScore > awayScore ? homeTeam : awayTeam;

  return {
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    winner,
    summary:
      winner === 'Draw'
        ? `${homeTeam} and ${awayTeam} finished level after a tightly contested matchup.`
        : `${winner} won the matchup by ${Math.abs(homeScore - awayScore)} points.`,
  };
}

export interface LeaderboardEntry {
  rank: number;
  manager: string;
  points: number;
  wins: number;
  losses: number;
}

export function calculateLeaderboard(entries: Array<{ manager: string; points: number; wins: number; losses: number }>) {
  return entries
    .sort((a, b) => b.points - a.points)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

export interface PlayerPerformanceRecord {
  playerName: string;
  matches: number;
  averagePoints: number;
  formTrend: number;
  recentScore: number;
}

export function summarizePlayerPerformance(
  playerName: string,
  matches: number,
  averagePoints: number,
  formTrend: number,
  recentScore: number,
): PlayerPerformanceRecord {
  return {
    playerName,
    matches,
    averagePoints,
    formTrend,
    recentScore,
  };
}
