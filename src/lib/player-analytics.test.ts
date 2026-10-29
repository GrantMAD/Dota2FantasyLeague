import { buildPlayerAnalytics } from './player-analytics';

describe('buildPlayerAnalytics', () => {
  it('computes floor, ceiling, volatility, and smart projections', () => {
    const samples = [
      { gameweekId: 1, points: 15, price: 5.0 },
      { gameweekId: 2, points: 22, price: 5.2 },
      { gameweekId: 3, points: 18, price: 5.5 },
      { gameweekId: 4, points: 28, price: 5.8 },
      { gameweekId: 5, points: 35, price: 6.0 },
      { gameweekId: 6, points: 20, price: 6.2 },
    ];

    const result = buildPlayerAnalytics(samples, { role: 'Carry', roleAverage: 20.0 });

    expect(result.matches).toBe(6);
    expect(result.averagePoints).toBe(23);
    expect(result.floor).toBeDefined();
    expect(result.ceiling).toBeDefined();
    expect(result.ceiling).toBeGreaterThanOrEqual(result.floor);
    expect(result.volatility).toBeDefined();
    expect(result.role).toBe('Carry');
    expect(result.roleAverage).toBe(20.0);
    expect(result.roleDelta).toBe(3.0); // 23 - 20
    expect(result.consistencyRate).toBeGreaterThan(0);
    expect(result.projectedPoints).toBeGreaterThan(0);
  });

  it('handles empty samples safely', () => {
    const result = buildPlayerAnalytics([]);
    expect(result.matches).toBe(0);
    expect(result.averagePoints).toBe(0);
    expect(result.floor).toBe(0);
    expect(result.ceiling).toBe(0);
    expect(result.roleDelta).toBeNull();
  });
});

