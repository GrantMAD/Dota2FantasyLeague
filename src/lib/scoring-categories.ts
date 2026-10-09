export interface TeamfightStats {
  hero_damage: number;
  healing: number;
  tower_damage: number;
}

export function calculateTeamfightPoints(
  stats: TeamfightStats,
  rules: Record<string, number>,
): number {
  const heroDamageMultiplier = rules.teamfight_hero_damage_multiplier ?? 0.0004;
  const healingMultiplier = rules.teamfight_healing_multiplier ?? 0.0015;
  const towerDamageMultiplier = rules.teamfight_tower_damage_multiplier ?? 0.0008;

  return Math.max(0, stats.hero_damage) * heroDamageMultiplier
    + Math.max(0, stats.healing) * healingMultiplier
    + Math.max(0, stats.tower_damage) * towerDamageMultiplier;
}

export function calculatePerformanceIndex(
  combat: number,
  economy: number,
  objective: number,
): number {
  return Math.min(100, Math.max(0, ((combat + economy + objective) / 40) * 100));
}

export function calculatePerformanceBonus(
  performanceIndex: number,
  rules: Record<string, number>,
): number {
  if (performanceIndex >= 90) return rules.performance_90_bonus ?? 5;
  if (performanceIndex >= 80) return rules.performance_80_bonus ?? 3;
  if (performanceIndex >= 70) return rules.performance_70_bonus ?? 1;
  return 0;
}

export function calculateDeathPenaltyPoints(deaths: number, rules: Record<string, number>): number {
  const configuredDeathPenalty = rules.death_penalty ?? rules.death_points ?? -1;
  return Math.max(0, deaths) * Math.abs(configuredDeathPenalty);
}

export function calculateConsistencyPoints(performanceIndex: number, previousPerformanceStreak: number): number {
  return performanceIndex >= 80 && previousPerformanceStreak >= 2 ? 1 : 0;
}

export interface SeriesMatchResult {
  id: number;
  series_id: number;
  best_of: number;
  scheduled_time: string;
  winner_team_id: number | null;
}

export function findSeriesClincherMatches(matches: SeriesMatchResult[]): Map<number, number> {
  const clinchers = new Map<number, number>();
  const winsBySeries = new Map<number, Map<number, number>>();
  const chronologicalMatches = [...matches].sort(
    (left, right) => new Date(left.scheduled_time).getTime() - new Date(right.scheduled_time).getTime(),
  );

  for (const match of chronologicalMatches) {
    if (match.winner_team_id === null || clinchers.has(match.series_id)) continue;
    const wins = winsBySeries.get(match.series_id) ?? new Map<number, number>();
    const teamWins = (wins.get(match.winner_team_id) ?? 0) + 1;
    wins.set(match.winner_team_id, teamWins);
    winsBySeries.set(match.series_id, wins);
    if (teamWins >= Math.ceil(match.best_of / 2)) clinchers.set(match.series_id, match.id);
  }

  return clinchers;
}
