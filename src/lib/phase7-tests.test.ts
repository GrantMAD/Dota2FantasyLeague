import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateFantasyScore } from '@/lib/scoring';
import { resolveCaptainAssignment } from '@/lib/captain-system';
import { resolveBenchSubstitution, simulatePriceDynamics, simulateHeadToHead } from '@/lib/fantasy-gameplay';

test('calculateFantasyScore totals positive performance correctly', () => {
  const score = calculateFantasyScore({
    kills: 10,
    deaths: 3,
    assists: 12,
    lastHits: 250,
    denies: 12,
    goldPerMinute: 550,
    experiencePerMinute: 480,
    heroDamage: 15000,
    buildingDamage: 7000,
    healing: 3500,
    wardsPlaced: 8,
    wardsDestroyed: 5,
    performanceIndex: 84,
    gameCount: 2,
    hasWin: true,
  });

  assert.ok(score.total > 0);
  assert.equal(score.win, 5);
  assert.equal(score.series, 3);
});

test('captain assignment uses the active captain when available', () => {
  const result = resolveCaptainAssignment(
    [
      { id: 1, name: 'Aegis', role: 'Carry', available: true },
      { id: 2, name: 'Beacon', role: 'Mid', available: true },
    ],
    1,
    2,
  );

  assert.equal(result.captain.name, 'Aegis');
  assert.equal(result.captainMultiplier, 2);
});

test('bench substitution swaps inactive starters with available matching bench players', () => {
  const result = resolveBenchSubstitution(
    [
      { id: 1, name: 'Aegis', role: 'Carry', available: false, points: 12 },
      { id: 2, name: 'Beacon', role: 'Mid', available: true, points: 22 },
    ],
    [
      { id: 3, name: 'Dusk', role: 'Carry', available: true, points: 18 },
      { id: 4, name: 'Ember', role: 'Support', available: true, points: 14 },
    ],
  );

  assert.equal(result[0].wasSubstituted, true);
  assert.equal(result[0].replacement, 'Dusk');
});

test('price dynamics update a player valuation based on recent output', () => {
  const result = simulatePriceDynamics(1, 'Aegis', 100, 12);

  assert.equal(result.trend, 'up');
  assert.ok(result.currentPrice > result.previousPrice);
});

test('head to head simulation returns the proper winner and summary', () => {
  const result = simulateHeadToHead('Storm', 'Nova', 88, 76);

  assert.equal(result.winner, 'Storm');
  assert.ok(result.summary.includes('Storm'));
});
