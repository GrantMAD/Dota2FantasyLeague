import { calculateFixtureDifficulty } from './fixture-difficulty';

function makeMatches(winners: Array<number | null>, teamId = 7) {
  return winners.map((winner, index) => {
    const opponentId = 100 + index;
    return {
      team_a_id: teamId,
      team_b_id: opponentId,
      winner_team_id: winner === null ? null : winner === teamId ? teamId : opponentId,
      scheduled_time: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    };
  });
}

describe('calculateFixtureDifficulty', () => {
  it('uses the last ten decisive results and maps strong opponent form to harder fixtures', () => {
    const matches = makeMatches([7, 7, 7, 7, 7, 7, 7, 7, 100, 100, 100]);

    expect(calculateFixtureDifficulty(7, matches)).toEqual({
      games: 10,
      wins: 7,
      losses: 3,
      winRate: 70,
      rating: 5,
      label: 'Very Hard',
    });
  });

  it('returns unknown when fewer than five decisive results are available', () => {
    expect(calculateFixtureDifficulty(7, makeMatches([7, 100, 7, null]))).toEqual({
      games: 3,
      wins: 0,
      losses: 0,
      winRate: null,
      rating: null,
      label: 'Unknown',
    });
  });

  it('ignores results that do not belong to the team or have an invalid winner', () => {
    const matches = [
      ...makeMatches([7, 7, 7, 7, 100]),
      { team_a_id: 8, team_b_id: 9, winner_team_id: 8, scheduled_time: '2026-02-01T00:00:00Z' },
      { team_a_id: 7, team_b_id: 9, winner_team_id: 99, scheduled_time: '2026-02-02T00:00:00Z' },
    ];

    expect(calculateFixtureDifficulty(7, matches)).toMatchObject({
      games: 5,
      wins: 4,
      losses: 1,
      winRate: 80,
      rating: 5,
      label: 'Very Hard',
    });
  });

  it.each([
    [0, 1, 'Very Easy'],
    [3, 2, 'Easy'],
    [5, 3, 'Average'],
    [6, 4, 'Hard'],
    [7, 5, 'Very Hard'],
  ] as const)('maps %i wins out of ten to rating %i', (wins, rating, label) => {
    const winners = Array.from({ length: 10 }, (_, index) => index < wins ? 7 : 100 + index);
    expect(calculateFixtureDifficulty(7, makeMatches(winners))).toMatchObject({ rating, label });
  });
});
