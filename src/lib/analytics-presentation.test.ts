import { getCaptainEfficiencyAssessment, getTrendRowsForRange } from './analytics-presentation';

describe('analytics presentation helpers', () => {
  const trend = [8, 2, 6, 4, 1, 5, 3].map((gameweekId) => ({
    gameweekId,
    userScore: gameweekId * 10,
    globalAverage: gameweekId * 8,
  }));

  it('sorts trend chronologically and limits it to the selected most recent gameweeks', () => {
    expect(getTrendRowsForRange(trend, '3').map((row) => row.gameweekId)).toEqual([5, 6, 8]);
    expect(getTrendRowsForRange(trend, '6').map((row) => row.gameweekId)).toEqual([2, 3, 4, 5, 6, 8]);
    expect(getTrendRowsForRange(trend, 'all').map((row) => row.gameweekId)).toEqual([1, 2, 3, 4, 5, 6, 8]);
    expect(trend[0].gameweekId).toBe(8);
  });

  it('labels captain efficiency against the documented good, average, and poor ranges', () => {
    expect(getCaptainEfficiencyAssessment(80).label).toBe('Good');
    expect(getCaptainEfficiencyAssessment(79.9).label).toBe('Average');
    expect(getCaptainEfficiencyAssessment(50).label).toBe('Average');
    expect(getCaptainEfficiencyAssessment(49.9).label).toBe('Poor');
  });
});
