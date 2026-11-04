export interface FixtureDifficultyResult {
  games: number;
  wins: number;
  losses: number;
  winRate: number | null;
  rating: number | null;
  label: 'Very Easy' | 'Easy' | 'Average' | 'Hard' | 'Very Hard' | 'Unknown';
}

export interface CompletedTeamMatch {
  team_a_id: number | null;
  team_b_id: number | null;
  winner_team_id: number | null;
  scheduled_time: string;
}

export const FIXTURE_DIFFICULTY_SAMPLE_SIZE = 10;
export const FIXTURE_DIFFICULTY_MIN_GAMES = 5;

const UNKNOWN_DIFFICULTY: FixtureDifficultyResult = {
  games: 0,
  wins: 0,
  losses: 0,
  winRate: null,
  rating: null,
  label: 'Unknown',
};

export function calculateFixtureDifficulty(
  teamId: number,
  matches: CompletedTeamMatch[],
): FixtureDifficultyResult {
  const decisiveMatches = matches
    .filter((match) =>
      (match.team_a_id === teamId || match.team_b_id === teamId)
      && match.winner_team_id !== null
      && (match.winner_team_id === match.team_a_id || match.winner_team_id === match.team_b_id))
    .sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime())
    .slice(0, FIXTURE_DIFFICULTY_SAMPLE_SIZE);

  if (decisiveMatches.length < FIXTURE_DIFFICULTY_MIN_GAMES) {
    return { ...UNKNOWN_DIFFICULTY, games: decisiveMatches.length };
  }

  const wins = decisiveMatches.filter((match) => match.winner_team_id === teamId).length;
  const winRate = Math.round((wins / decisiveMatches.length) * 100);
  const rating = winRate < 30 ? 1
    : winRate < 45 ? 2
      : winRate < 55 ? 3
        : winRate < 70 ? 4
          : 5;
  const labels: Record<number, FixtureDifficultyResult['label']> = {
    1: 'Very Easy',
    2: 'Easy',
    3: 'Average',
    4: 'Hard',
    5: 'Very Hard',
  };

  return {
    games: decisiveMatches.length,
    wins,
    losses: decisiveMatches.length - wins,
    winRate,
    rating,
    label: labels[rating],
  };
}
