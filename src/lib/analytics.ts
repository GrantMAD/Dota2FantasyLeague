export type AnalyticsSummaryInput = {
  totalUsers: number;
  activeUsers: number;
  avgFantasyScore: number;
  premiumUsers: number;
  conversionRate: number;
};

export type AnalyticsSummary = {
  totalUsers: number;
  activeUsers: number;
  avgFantasyScore: number;
  premiumUsers: number;
  conversionRate: number;
  premiumRatio: number;
};

export function generateAnalyticsSummary(input: AnalyticsSummaryInput): AnalyticsSummary {
  const premiumRatio = Number(((input.premiumUsers * 100) / input.totalUsers).toFixed(2));

  return {
    totalUsers: input.totalUsers,
    activeUsers: input.activeUsers,
    avgFantasyScore: input.avgFantasyScore,
    premiumUsers: input.premiumUsers,
    conversionRate: input.conversionRate,
    premiumRatio,
  };
}

export function isPremiumFeatureUnlocked(
  userTier: 'free' | 'basic' | 'pro' | 'admin',
  requiredTier: 'free' | 'basic' | 'pro' | 'admin',
): boolean {
  const tierRank = {
    free: 0,
    basic: 1,
    pro: 2,
    admin: 3,
  };

  return tierRank[userTier] >= tierRank[requiredTier];
}
