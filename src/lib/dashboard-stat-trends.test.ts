import {
  calculateDashboardStatTrends,
  formatGameweekPointsDelta,
  formatGameweekRankMovement,
} from './dashboard-stat-trends';

describe('dashboard stat trends', () => {
  it('calculates gameweek points and rank movement from the latest two completed weeks', () => {
    expect(calculateDashboardStatTrends([
      { gameweek_id: 8, gameweek_points: 45, rank: 12 },
      { gameweek_id: 7, gameweek_points: 39, rank: 16 },
    ], [8, 7])).toEqual({
      gameweekPointsDelta: 6,
      gameweekRankMovement: 4,
      status: 'ready',
    });
  });

  it('handles rank drops and missing previous gameweek data', () => {
    expect(calculateDashboardStatTrends([
      { gameweek_id: 8, gameweek_points: 35, rank: 16 },
      { gameweek_id: 7, gameweek_points: 40, rank: 12 },
    ], [8, 7]).gameweekRankMovement).toBe(-4);
    expect(calculateDashboardStatTrends([
      { gameweek_id: 8, gameweek_points: 35, rank: 16 },
    ], [8, 7]).status).toBe('insufficient-history');
  });

  it('formats positive, neutral, and unavailable trend states clearly', () => {
    expect(formatGameweekPointsDelta(6, 'ready')).toBe('+6.0 GW pts vs prior');
    expect(formatGameweekPointsDelta(0, 'ready')).toBe('GW points unchanged vs prior');
    expect(formatGameweekPointsDelta(null, 'insufficient-history')).toBe('Not enough gameweek history');
    expect(formatGameweekRankMovement(2, 'ready')).toBe('2 places up vs prior GW');
    expect(formatGameweekRankMovement(-1, 'ready')).toBe('1 place down vs prior GW');
    expect(formatGameweekRankMovement(null, 'unavailable')).toBe('Trend unavailable');
  });
});
