export interface PlayerGameweekBreakdown {
  combat: number;
  economy: number;
  objective: number;
  teamfight: number;
  win: number;
  series: number;
  performance: number;
  consistency: number;
  penalty: number;
  total: number;
}

export interface PlayerGameweekBreakdownRow {
  player_id: number;
  fantasy_points_breakdown: {
    combat_points: number | null;
    economy_points: number | null;
    objective_points: number | null;
    teamfight_points: number | null;
    win_points: number | null;
    series_points: number | null;
    performance_index_points: number | null;
    consistency_points: number | null;
    penalty_points: number | null;
    total_points: number | null;
  } | null;
}

export function aggregatePlayerGameweekBreakdowns(
  rows: PlayerGameweekBreakdownRow[],
): Map<number, PlayerGameweekBreakdown> {
  const totals = new Map<number, PlayerGameweekBreakdown>();

  for (const row of rows) {
    if (!row.fantasy_points_breakdown) continue;
    const breakdown = row.fantasy_points_breakdown;
    const current = totals.get(row.player_id) ?? {
      combat: 0,
      economy: 0,
      objective: 0,
      teamfight: 0,
      win: 0,
      series: 0,
      performance: 0,
      consistency: 0,
      penalty: 0,
      total: 0,
    };

    current.combat += Number(breakdown.combat_points ?? 0);
    current.economy += Number(breakdown.economy_points ?? 0);
    current.objective += Number(breakdown.objective_points ?? 0);
    current.teamfight += Number(breakdown.teamfight_points ?? 0);
    current.win += Number(breakdown.win_points ?? 0);
    current.series += Number(breakdown.series_points ?? 0);
    current.performance += Number(breakdown.performance_index_points ?? 0);
    current.consistency += Number(breakdown.consistency_points ?? 0);
    current.penalty -= Number(breakdown.penalty_points ?? 0);
    current.total += Number(breakdown.total_points ?? 0);
    totals.set(row.player_id, current);
  }

  return totals;
}
