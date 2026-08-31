export interface FantasyPerformanceInput {
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  goldPerMinute: number;
  experiencePerMinute: number;
  heroDamage: number;
  buildingDamage: number;
  healing: number;
  wardsPlaced: number;
  wardsDestroyed: number;
  performanceIndex: number;
  gameCount: number;
  hasWin: boolean;
}

export interface FantasyScoreBreakdown {
  combat: number;
  economy: number;
  objective: number;
  teamfight: number;
  win: number;
  series: number;
  performance: number;
  consistency: number;
  penalties: number;
  total: number;
}

export function calculateFantasyScore(
  input: FantasyPerformanceInput,
): FantasyScoreBreakdown {
  const combat = input.kills * 1.5 + input.assists * 0.75 - input.deaths * 1;

  const economy =
    input.lastHits * 0.02 +
    input.denies * 0.35 +
    Math.max(0, input.goldPerMinute - 350) * 0.05 +
    Math.max(0, input.experiencePerMinute - 350) * 0.04;

  const objective =
    input.heroDamage * 0.0006 +
    input.buildingDamage * 0.0012 +
    input.wardsPlaced * 0.45 +
    input.wardsDestroyed * 0.65 +
    input.healing * 0.002;

  const teamfight =
    Math.max(0, input.heroDamage * 0.0004) +
    Math.max(0, input.healing * 0.0015) +
    Math.max(0, input.buildingDamage * 0.0008);

  const win = input.hasWin ? 5 : 0;
  const series = input.gameCount > 1 ? 3 : 0;

  const performance =
    input.performanceIndex >= 90
      ? 5
      : input.performanceIndex >= 80
        ? 3
        : input.performanceIndex >= 70
          ? 1
          : 0;

  const consistency = input.gameCount >= 5 && input.performanceIndex >= 80 ? 2 : 0;
  const penalties = Math.max(0, input.deaths * 0.75);

  const total =
    combat +
    economy +
    objective +
    teamfight +
    win +
    series +
    performance +
    consistency -
    penalties;

  return {
    combat: Number(combat.toFixed(2)),
    economy: Number(economy.toFixed(2)),
    objective: Number(objective.toFixed(2)),
    teamfight: Number(teamfight.toFixed(2)),
    win,
    series,
    performance,
    consistency,
    penalties: Number(penalties.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}
