import { findMatchesNeedingScores } from './calculate-fantasy-scores';

describe('findMatchesNeedingScores', () => {
  it('skips fully scored matches and returns matches with missing breakdowns in order', () => {
    const matches = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const stats = [{ match_id: 1 }, { match_id: 2 }, { match_id: 3 }];
    const performances = [
      { match_id: 1, fantasy_points_breakdown: { id: 11 } },
      { match_id: 2, fantasy_points_breakdown: null },
      { match_id: 3, fantasy_points_breakdown: [{ id: 33 }] },
    ];

    expect(findMatchesNeedingScores(matches, stats, performances, 15)).toEqual([2]);
  });

  it('does not select matches without player stats and reports one extra pending match for hasMore', () => {
    const matches = [{ id: 1 }, { id: 2 }, { id: 3 }];

    expect(findMatchesNeedingScores(
      matches,
      [{ match_id: 1 }, { match_id: 2 }],
      [],
      1,
    )).toEqual([1, 2]);
  });
});
