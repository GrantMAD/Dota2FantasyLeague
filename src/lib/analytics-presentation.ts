export type AnalyticsTrendPoint = {
  gameweekId: number;
  userScore: number;
  globalAverage: number;
  rank?: number | null;
};

export interface AnalyticsCsvData {
  user: {
    totalPoints: number;
    globalRank: number | null;
    budget: number;
    squadValue: number;
    freeTransfers: number;
  };
  trend: readonly AnalyticsTrendPoint[];
  roleBreakdown: readonly { role: string; points: number }[];
  captainEfficiency: {
    captainPoints: number;
    idealCapPoints: number;
    efficiency: number;
  };
  market: readonly AnalyticsCsvPlayer[];
  dreamTeam: readonly AnalyticsCsvPlayer[];
  valueForMoney: readonly AnalyticsCsvPlayer[];
}

interface AnalyticsCsvPlayer {
  playerName: string;
  team: string;
  role: string;
  points?: number;
  ownership?: number;
  price?: number;
  roi?: number;
}

export type TrendRange = '3' | '6' | 'all';

export function getTrendRowsForRange(rows: AnalyticsTrendPoint[], range: TrendRange): AnalyticsTrendPoint[] {
  const sortedRows = [...rows].sort((a, b) => a.gameweekId - b.gameweekId);
  return range === 'all' ? sortedRows : sortedRows.slice(-Number(range));
}

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  const safe = typeof value === 'string' && /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function serializeAnalyticsCsv(data: AnalyticsCsvData): string {
  const csvRows = [
    ['Section', 'Gameweek', 'Metric', 'Value', 'Player', 'Team', 'Role', 'Points', 'Global Average', 'Global Rank', 'Ownership (%)', 'Price', 'ROI'],
    ['Manager', '', 'Total points', data.user.totalPoints],
    ['Manager', '', 'Global rank', data.user.globalRank],
    ['Manager', '', 'Budget', data.user.budget],
    ['Manager', '', 'Squad value', data.user.squadValue],
    ['Manager', '', 'Free transfers', data.user.freeTransfers],
    ['Captain', '', 'Captain points', data.captainEfficiency.captainPoints],
    ['Captain', '', 'Ideal captain points', data.captainEfficiency.idealCapPoints],
    ['Captain', '', 'Efficiency (%)', data.captainEfficiency.efficiency],
    ...data.trend.map((row) => [
      'Gameweek Trend', `GW ${row.gameweekId}`, '', '', '', '', '',
      row.userScore.toFixed(1), row.globalAverage.toFixed(1), row.rank ?? '', '', '', '',
    ]),
    ...data.roleBreakdown.map((row) => ['Role Breakdown', '', 'Total points', '', '', '', row.role, row.points.toFixed(1)]),
    ...data.market.map((row) => [
      'Market', '', '', '', row.playerName, row.team, row.role, '', '', '', row.ownership, row.price, row.roi,
    ]),
    ...data.dreamTeam.map((row) => [
      'Dream Team', '', '', '', row.playerName, row.team, row.role, row.points, '', '', '', row.price, row.roi,
    ]),
    ...data.valueForMoney.map((row) => [
      'Value for Money', '', '', '', row.playerName, row.team, row.role, '', '', '', row.ownership, row.price, row.roi,
    ]),
  ];
  return `\uFEFF${csvRows
    .map((row) => Array.from({ length: 13 }, (_, index) => csvCell(row[index])).join(','))
    .join('\r\n')}\r\n`;
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
