import {
  calculateConsistencyPoints,
  calculateDeathPenaltyPoints,
  calculatePerformanceBonus,
  calculatePerformanceIndex,
  calculateTeamfightPoints,
  findSeriesClincherMatches,
} from './scoring-categories';

describe('scoring categories', () => {
  it('calculates teamfight contribution from available match statistics', () => {
    expect(calculateTeamfightPoints({
      hero_damage: 10000,
      healing: 2000,
      tower_damage: 2500,
    }, {})).toBeCloseTo(9);
  });

  it('normalizes the performance index to a bounded 0-100 scale', () => {
    expect(calculatePerformanceIndex(10, 10, 8)).toBe(70);
    expect(calculatePerformanceIndex(-10, 0, 0)).toBe(0);
    expect(calculatePerformanceIndex(40, 30, 20)).toBe(100);
  });

  it('awards configured performance bonuses at the documented thresholds', () => {
    const rules = { performance_90_bonus: 5, performance_80_bonus: 3, performance_70_bonus: 1 };
    expect(calculatePerformanceBonus(69.99, rules)).toBe(0);
    expect(calculatePerformanceBonus(70, rules)).toBe(1);
    expect(calculatePerformanceBonus(80, rules)).toBe(3);
    expect(calculatePerformanceBonus(90, rules)).toBe(5);
  });

  it('calculates death penalties separately from combat points', () => {
    expect(calculateDeathPenaltyPoints(4, {})).toBe(4);
    expect(calculateDeathPenaltyPoints(2, { death_penalty: -1.5 })).toBe(3);
    expect(calculateDeathPenaltyPoints(2, { death_points: -0.5 })).toBe(1);
  });

  it('awards consistency only after three consecutive qualifying appearances', () => {
    expect(calculateConsistencyPoints(80, 0)).toBe(0);
    expect(calculateConsistencyPoints(80, 1)).toBe(0);
    expect(calculateConsistencyPoints(80, 2)).toBe(1);
    expect(calculateConsistencyPoints(79.99, 2)).toBe(0);
  });

  it('finds the match that clinches a best-of series without awarding an unclinched series', () => {
    const matches = [
      { id: 1, series_id: 10, best_of: 3, scheduled_time: '2026-01-01T00:00:00Z', winner_team_id: 100 },
      { id: 2, series_id: 10, best_of: 3, scheduled_time: '2026-01-01T01:00:00Z', winner_team_id: 200 },
      { id: 3, series_id: 10, best_of: 3, scheduled_time: '2026-01-01T02:00:00Z', winner_team_id: 100 },
      { id: 4, series_id: 20, best_of: 3, scheduled_time: '2026-01-01T00:00:00Z', winner_team_id: 100 },
    ];

    expect(findSeriesClincherMatches(matches)).toEqual(new Map([[10, 3]]));
  });
});
