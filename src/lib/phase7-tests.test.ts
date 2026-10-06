import { calculateFantasyScore } from '@/lib/scoring';
import { resolveCaptainAssignment } from '@/lib/captain-system';
import {
  createLeagueDraft,
  resolveBenchSubstitution,
  simulatePriceDynamics,
  simulateHeadToHead,
  validateLeagueMembership,
} from '@/lib/fantasy-gameplay';

describe('fantasy gameplay utilities', () => {
it('calculateFantasyScore totals positive performance correctly', () => {
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

  expect(score.total).toBeGreaterThan(0);
  expect(score.win).toBe(5);
  expect(score.series).toBe(3);
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

  expect(result.captain.name).toBe('Aegis');
  expect(result.captainMultiplier).toBe(2);
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

  expect(result[0].wasSubstituted).toBe(true);
  expect(result[0].replacement).toBe('Dusk');
});

test('price dynamics update a player valuation based on recent output', () => {
  const result = simulatePriceDynamics(1, 'Aegis', 100, 12);

  expect(result.trend).toBe('up');
  expect(result.currentPrice).toBeGreaterThan(result.previousPrice);
});

test('head to head simulation returns the proper winner and summary', () => {
  const result = simulateHeadToHead('Storm', 'Nova', 88, 76);

  expect(result.winner).toBe('Storm');
  expect(result.summary).toContain('Storm');
});

test('league drafts can be created with invite codes and respect membership caps', () => {
  const draft = createLeagueDraft({
    name: 'Night Raid League',
    type: 'classic',
    privacyLevel: 'private',
    maxParticipants: 12,
    description: 'Weekly classic challenge',
  });

  expect(draft.name).toBe('Night Raid League');
  expect(draft.inviteCode).toMatch(/^[A-Z0-9-]+$/);
  expect(validateLeagueMembership(8, 12)).toBe(true);
  expect(validateLeagueMembership(13, 12)).toBe(false);
});
});
