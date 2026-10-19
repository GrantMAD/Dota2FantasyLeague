export type AnalyticsTrendPoint = {
  gameweekId: number;
  userScore: number;
  globalAverage: number;
  rank?: number | null;
};

export type TrendRange = '3' | '6' | 'all';

export function getTrendRowsForRange(rows: AnalyticsTrendPoint[], range: TrendRange): AnalyticsTrendPoint[] {
  const sortedRows = [...rows].sort((a, b) => a.gameweekId - b.gameweekId);
  return range === 'all' ? sortedRows : sortedRows.slice(-Number(range));
}

export function getCaptainEfficiencyAssessment(efficiency: number) {
  if (efficiency >= 80) {
    return { label: 'Good', color: 'text-emerald-400', description: 'Strong captain selection' };
  }
  if (efficiency >= 50) {
    return { label: 'Average', color: 'text-amber-400', description: 'Room to improve your captain pick' };
  }
  return { label: 'Poor', color: 'text-rose-400', description: 'Your captain returned well below the ideal pick' };
}
