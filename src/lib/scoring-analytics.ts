export const SCORING_ROLES = ['Carry', 'Mid', 'Offlane', 'Support', 'Hard Support'] as const;
export type ScoringRole = (typeof SCORING_ROLES)[number];

export interface ScoringSample {
  role: string;
  playerId: number;
  totalPoints: number;
  price: number;
  ownershipPercentage: number;
  captainPoints: number;
  gameweekId?: number;
}

export interface RoleBalanceReport {
  role: string;
  sampleSize: number;
  averagePoints: number;
  medianPoints: number;
  topTenPercentPoints: number;
  bottomTenPercentPoints: number;
  averagePrice: number;
  averageOwnershipPercentage: number;
  averagePriceToPointRatio: number;
  captainImpact: number;
}

function percentile(values: number[], percentage: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentage / 100) * sorted.length) - 1));
  return sorted[index];
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rounded(value: number): number {
  return Number(value.toFixed(2));
}

export function buildRoleBalanceReport(samples: ScoringSample[]): RoleBalanceReport[] {
  return SCORING_ROLES.map((role) => {
    const roleSamples = samples.filter((sample) => sample.role === role);
    const points = roleSamples.map((sample) => sample.totalPoints);
    const prices = roleSamples.map((sample) => sample.price).filter((price) => price > 0);
    const ownership = roleSamples.map((sample) => sample.ownershipPercentage);
    const priceToPointRatios = roleSamples
      .filter((sample) => sample.totalPoints > 0 && sample.price > 0)
      .map((sample) => sample.price / sample.totalPoints);
    const captainSamples = roleSamples.filter((sample) => sample.captainPoints > 0);

    return {
      role,
      sampleSize: roleSamples.length,
      averagePoints: rounded(average(points)),
      medianPoints: rounded(percentile(points, 50)),
      topTenPercentPoints: rounded(percentile(points, 90)),
      bottomTenPercentPoints: rounded(percentile(points, 10)),
      averagePrice: rounded(average(prices)),
      averageOwnershipPercentage: rounded(average(ownership)),
      averagePriceToPointRatio: rounded(average(priceToPointRatios)),
      captainImpact: rounded(average(captainSamples.map((sample) => sample.captainPoints - sample.totalPoints))),
    };
  });
}

export function buildSimulationReport(
  samples: ScoringSample[],
  metadata: { seasonId: number; gameweeks: number[]; matchesProcessed: number },
) {
  return {
    generatedAt: new Date().toISOString(),
    seasonId: metadata.seasonId,
    gameweeks: metadata.gameweeks,
    matchesProcessed: metadata.matchesProcessed,
    playerPerformances: samples.length,
    roleBreakdown: buildRoleBalanceReport(samples),
    totals: {
      averagePoints: rounded(average(samples.map((sample) => sample.totalPoints))),
      medianPoints: rounded(percentile(samples.map((sample) => sample.totalPoints), 50)),
      highestPoints: rounded(Math.max(0, ...samples.map((sample) => sample.totalPoints))),
    },
  };
}
