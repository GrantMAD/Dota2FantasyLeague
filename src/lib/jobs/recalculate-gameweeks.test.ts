import { buildPlayerScoringMaps } from './recalculate-gameweeks';

describe('buildPlayerScoringMaps', () => {
  it('credits canonical performance points to duplicate player identities only once per match', () => {
    const identity = 'steam-account:847565596';
    const { playersWhoPlayed, playerPointsMap } = buildPlayerScoringMaps(
      [
        { player_id: 20, match_id: 100, fantasy_points_breakdown: { total_points: 12 } },
        { player_id: 10, match_id: 100, fantasy_points_breakdown: { total_points: 12 } },
      ],
      new Map([
        [10, [identity]],
        [20, [identity]],
      ]),
      new Map([[identity, [10, 20]]]),
    );

    expect(playersWhoPlayed).toEqual(new Set([10, 20]));
    expect(playerPointsMap).toEqual(new Map([[10, 12], [20, 12]]));
  });
});
