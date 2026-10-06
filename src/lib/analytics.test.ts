import { generateAnalyticsSummary, isPremiumFeatureUnlocked } from './analytics';

describe('analytics utilities', () => {
it('generateAnalyticsSummary creates a stable production dashboard snapshot', () => {
  const summary = generateAnalyticsSummary({
    totalUsers: 1280,
    activeUsers: 812,
    avgFantasyScore: 94.6,
    premiumUsers: 184,
    conversionRate: 14.4,
  });

  expect(summary).toEqual({
    totalUsers: 1280,
    activeUsers: 812,
    avgFantasyScore: 94.6,
    premiumUsers: 184,
    conversionRate: 14.4,
    premiumRatio: 14.38,
  });
});

it('premium features are unlocked only for users at or above the required tier', () => {
  expect(isPremiumFeatureUnlocked('pro', 'pro')).toBe(true);
  expect(isPremiumFeatureUnlocked('basic', 'pro')).toBe(false);
  expect(isPremiumFeatureUnlocked('pro', 'basic')).toBe(true);
});
});
