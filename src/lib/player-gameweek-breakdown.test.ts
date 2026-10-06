import { aggregatePlayerGameweekBreakdowns } from './player-gameweek-breakdown';

describe('aggregate player gameweek breakdowns', () => {
  it('adds category and total points across every match performance in a gameweek', () => {
    const totals = aggregatePlayerGameweekBreakdowns([
      {
        player_id: 42,
        fantasy_points_breakdown: {
          combat_points: 5,
          economy_points: 1,
          objective_points: 0,
          teamfight_points: 2,
          win_points: 3,
          series_points: 0,
          performance_index_points: 1,
          consistency_points: 0,
          penalty_points: 0.5,
          total_points: 11.5,
        },
      },
      {
        player_id: 42,
        fantasy_points_breakdown: {
          combat_points: 3,
          economy_points: 2,
          objective_points: 1,
          teamfight_points: 0,
          win_points: 0,
          series_points: 1,
          performance_index_points: 0,
          consistency_points: 0.5,
          penalty_points: 0,
          total_points: 7.5,
        },
      },
      {
        player_id: 77,
        fantasy_points_breakdown: {
          combat_points: 9,
          economy_points: 0,
          objective_points: 0,
          teamfight_points: 0,
          win_points: 0,
          series_points: 0,
          performance_index_points: 0,
          consistency_points: 0,
          penalty_points: 0,
          total_points: 9,
        },
      },
    ]);

    expect(totals.get(42)).toEqual({
      combat: 8,
      economy: 3,
      objective: 1,
      teamfight: 2,
      win: 3,
      series: 1,
      performance: 1,
      consistency: 0.5,
      penalty: -0.5,
      total: 19,
    });
    expect(totals.get(77)?.total).toBe(9);
  });

  it('ignores performances without a scoring breakdown', () => {
    expect(aggregatePlayerGameweekBreakdowns([
      { player_id: 42, fantasy_points_breakdown: null },
    ])).toEqual(new Map());
  });
});
