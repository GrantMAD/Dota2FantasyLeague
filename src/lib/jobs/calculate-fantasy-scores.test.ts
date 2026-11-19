import { findMatchesNeedingScores } from './calculate-fantasy-scores';

describe('findMatchesNeedingScores', () => {
  it('skips fully scored matches and returns matches with missing breakdowns in order', () => {
    const matches = [
      { id: 1, winner_team_id: null },
      { id: 2, winner_team_id: null },
      { id: 3, winner_team_id: null },
    ];
    const stats = [{ match_id: 1 }, { match_id: 2 }, { match_id: 3 }];
    const performances = [
      { match_id: 1, fantasy_points_breakdown: { id: 11, win_points: 5 } },
      { match_id: 2, fantasy_points_breakdown: null },
      { match_id: 3, fantasy_points_breakdown: [{ id: 33, win_points: 5 }] },
    ];

    expect(findMatchesNeedingScores(matches, stats, performances, 15)).toEqual([2]);
  });

  it('does not select matches without player stats and reports one extra pending match for hasMore', () => {
    const matches = [
      { id: 1, winner_team_id: null },
      { id: 2, winner_team_id: null },
      { id: 3, winner_team_id: null },
    ];

    expect(findMatchesNeedingScores(
      matches,
      [{ match_id: 1 }, { match_id: 2 }],
      [],
      1,
    )).toEqual([1, 2]);
  });

  it('re-scores a match where winner is set but all win_points are zero', () => {
    const matches = [
      { id: 1, winner_team_id: 42 },
      { id: 2, winner_team_id: 42 },
    ];
    const stats = [{ match_id: 1 }, { match_id: 2 }];
    const performances = [
      { match_id: 1, fantasy_points_breakdown: { id: 11, win_points: 0 } },
      { match_id: 2, fantasy_points_breakdown: [{ id: 21, win_points: 5 }] },
    ];

    // Match 1 has breakdowns but all win_points = 0 and winner is known → needs re-score
    // Match 2 has non-zero win_points → already correct, skip
    expect(findMatchesNeedingScores(matches, stats, performances, 15)).toEqual([1]);
  });

  it('does not re-score a match where winner_team_id is null even if win_points are zero', () => {
    const matches = [{ id: 1, winner_team_id: null }];
    const stats = [{ match_id: 1 }];
    const performances = [
      { match_id: 1, fantasy_points_breakdown: { id: 11, win_points: 0 } },
    ];

    // No winner known, so zero win_points is correct
    expect(findMatchesNeedingScores(matches, stats, performances, 15)).toEqual([]);
  });
});
