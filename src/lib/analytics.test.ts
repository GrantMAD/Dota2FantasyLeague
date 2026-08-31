import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAnalyticsSummary, isPremiumFeatureUnlocked } from './analytics';

test('generateAnalyticsSummary creates a stable production dashboard snapshot', () => {
  const summary = generateAnalyticsSummary({
    totalUsers: 1280,
    activeUsers: 812,
    avgFantasyScore: 94.6,
    premiumUsers: 184,
    conversionRate: 14.4,
  });

  assert.equal(summary.totalUsers, 1280);
  assert.equal(summary.activeUsers, 812);
  assert.equal(summary.avgFantasyScore, 94.6);
  assert.equal(summary.premiumUsers, 184);
  assert.equal(summary.conversionRate, 14.4);
  assert.equal(summary.premiumRatio, 14.38);
});

test('premium features are unlocked only for paid users', () => {
  assert.equal(isPremiumFeatureUnlocked('pro', 'pro'), true);
  assert.equal(isPremiumFeatureUnlocked('basic', 'pro'), false);
  assert.equal(isPremiumFeatureUnlocked('pro', 'basic'), true);
});
