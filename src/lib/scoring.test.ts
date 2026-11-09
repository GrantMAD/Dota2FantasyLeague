import { calculateFantasyScore, type FantasyPerformanceInput } from './scoring';

const basePerformance: FantasyPerformanceInput = {
  kills: 0,
  deaths: 0,
  assists: 0,
  lastHits: 0,
  denies: 0,
  goldPerMinute: 0,
  experiencePerMinute: 0,
  heroDamage: 0,
  buildingDamage: 0,
  healing: 0,
  wardsPlaced: 0,
  wardsDestroyed: 0,
  performanceIndex: 0,
  gameCount: 0,
  hasWin: false,
};

describe('calculateFantasyScore', () => {
  it('deducts each death exactly once as a one-point penalty, not from combat', () => {
    const noDeaths = calculateFantasyScore(basePerformance);
    const threeDeaths = calculateFantasyScore({ ...basePerformance, deaths: 3 });

    expect(threeDeaths.combat).toBe(noDeaths.combat);
    expect(threeDeaths.penalties).toBe(3);
    expect(noDeaths.total - threeDeaths.total).toBe(3);
  });
});
