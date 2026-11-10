import {
  getCaptainEfficiencyAssessment,
  getTrendRowsForRange,
  serializeAnalyticsCsv,
} from './analytics-presentation';

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

  it('exports complete analytics sections and protects spreadsheet formula cells', () => {
    const csv = serializeAnalyticsCsv({
      user: { totalPoints: 300, globalRank: null, budget: 5, squadValue: 9, freeTransfers: 1 },
      trend: [{ gameweekId: 4, userScore: 57.46, globalAverage: 43.2, rank: 12 }],
      roleBreakdown: [{ role: 'Carry', points: 57.46 }],
      captainEfficiency: { captainPoints: 50, idealCapPoints: 60, efficiency: 83.3 },
      market: [{ playerName: '=HYPERLINK(1)', team: 'Radiant', role: 'Carry', ownership: 12.5, price: 5.2, roi: 3.1 }],
      dreamTeam: [{ playerName: 'Dream Player', team: 'Radiant', role: 'Carry', points: 57.46, price: 5.2, roi: 11 }],
      valueForMoney: [{ playerName: 'Value Player', team: 'Dire', role: 'Mid', ownership: 8, price: 4.1, roi: 14 }],
    });
    const rows = csv.slice(1).trimEnd().split('\r\n');

    expect(rows[0]).toBe('"Section","Gameweek","Metric","Value","Player","Team","Role","Points","Global Average","Global Rank","Ownership (%)","Price","ROI"');
    expect(csv).toContain('"Gameweek Trend","GW 4","","","","","","57.5","43.2","12","","",""');
    expect(csv).toContain('"Market","","","","\'=HYPERLINK(1)","Radiant","Carry","","","","12.5","5.2","3.1"');
    expect(rows.every((row) => (row.match(/,/g) ?? []).length === 12)).toBe(true);
  });
});
