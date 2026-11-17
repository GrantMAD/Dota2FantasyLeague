import { findMatchesWithCompleteScores } from '../calculate-fantasy-scores';
import { getMatchLifecyclePlayerIds } from '../match-lifecycle-notifications';

describe('findMatchesWithCompleteScores', () => {
  it('returns only matches with a score breakdown for every player stat row', () => {
    expect(findMatchesWithCompleteScores(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      [
        { match_id: 1, player_id: 10 },
        { match_id: 1, player_id: 11 },
        { match_id: 2, player_id: 20 },
        { match_id: 3, player_id: 30 },
      ],
      [
        { match_id: 1, fantasy_points_breakdown: { id: 101 } },
        { match_id: 1, fantasy_points_breakdown: [{ id: 102 }] },
        { match_id: 2, fantasy_points_breakdown: null },
        { match_id: 3, fantasy_points_breakdown: { id: 103 } },
      ],
    )).toEqual([1, 3]);
  });

  describe('getMatchLifecyclePlayerIds', () => {
    it('includes the rostered player represented by a match stand-in', () => {
      expect(getMatchLifecyclePlayerIds(
        7,
        [
          { match_id: 7, player_id: 10 },
          { match_id: 8, player_id: 11 },
        ],
        [{ match_id: 7, rostered_player_id: 12, stand_in_player_id: 10 }],
      )).toEqual([10, 12]);
    });
  });

  it('does not treat a partially populated performance set as fully scored', () => {
    expect(findMatchesWithCompleteScores(
      [{ id: 1 }],
      [
        { match_id: 1, player_id: 10 },
        { match_id: 1, player_id: 11 },
      ],
      [{ match_id: 1, fantasy_points_breakdown: { id: 101 } }],
    )).toEqual([]);
  });
});
