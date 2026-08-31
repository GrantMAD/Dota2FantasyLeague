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

export interface LeagueDraft {
  name: string;
  type: 'classic' | 'h2h';
  privacyLevel: 'public' | 'private';
  maxParticipants: number;
  description: string;
  inviteCode: string;
  createdAt: string;
  isFull: boolean;
}

export function createLeagueDraft(params: {
  name: string;
  type: 'classic' | 'h2h';
  privacyLevel: 'public' | 'private';
  maxParticipants: number;
  description?: string;
  currentParticipants?: number;
}): LeagueDraft {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const inviteCode = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

  return {
    name: params.name,
    type: params.type,
    privacyLevel: params.privacyLevel,
    maxParticipants: params.maxParticipants,
    description: params.description || 'League created from the fantasy engine.',
    inviteCode,
    createdAt: new Date().toISOString(),
    isFull: (params.currentParticipants ?? 0) >= params.maxParticipants,
  };
}

export function validateLeagueMembership(currentParticipants: number, maxParticipants: number): boolean {
  return currentParticipants < maxParticipants;
}

export function joinLeague(currentParticipants: number, maxParticipants: number): {
  allowed: boolean;
  reason: string;
  currentParticipants: number;
  maxParticipants: number;
} {
  const allowed = validateLeagueMembership(currentParticipants, maxParticipants);

  return {
    allowed,
    reason: allowed ? 'Invitation accepted.' : 'This league is full and cannot accept more members.',
    currentParticipants,
    maxParticipants,
  };
}

export interface LeagueStanding {
  manager: string;
  points: number;
  wins: number;
  losses: number;
  rank: number;
  form: string;
}

export function calculateLeagueStandings(
  entries: Array<{ manager: string; points: number; wins: number; losses: number; form?: string[] }>,
): LeagueStanding[] {
  return entries
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .map((entry, index) => ({
      manager: entry.manager,
      points: entry.points,
      wins: entry.wins,
      losses: entry.losses,
      rank: index + 1,
      form: entry.form?.join(' ') || '—',
    }));
}

export interface HeadToHeadFixture {
  home: string;
  away: string;
  result: string;
  score: string;
}

export function generateHeadToHeadFixtures(participants: string[]): HeadToHeadFixture[] {
  const shuffled = [...participants].sort(() => Math.random() - 0.5);

  return shuffled.map((participant, index) => {
    const opponent = shuffled[(index + 1) % shuffled.length];
    if (participant === opponent) {
      return {
        home: participant,
        away: 'BYE',
        result: 'bye',
        score: '—',
      };
    }

    const homeScore = 70 + Math.round(Math.random() * 25);
    const awayScore = 60 + Math.round(Math.random() * 25);
    const winner = homeScore >= awayScore ? participant : opponent;

    return {
      home: participant,
      away: opponent,
      result: winner === participant ? 'home' : 'away',
      score: `${homeScore}-${awayScore}`,
    };
  });
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
