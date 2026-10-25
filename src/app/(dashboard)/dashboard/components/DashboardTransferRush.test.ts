jest.mock('@/lib/supabase', () => ({
  supabaseServer: jest.fn(),
  getSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/fetch-with-auth', () => ({
  fetchWithAuth: jest.fn(),
}));

import { formatCountdown, getRushBadgeMeta } from './DashboardTransferRush';

describe('DashboardTransferRush helpers', () => {
  describe('formatCountdown', () => {
    it('formats days, hours, and minutes when remaining time is greater than 24 hours', () => {
      const remainingSeconds = 2 * 86400 + 4 * 3600 + 30 * 60; // 2d 4h 30m
      expect(formatCountdown(remainingSeconds)).toBe('2d 4h 30m');
    });

    it('formats HH:MM:SS when remaining time is under 24 hours', () => {
      const remainingSeconds = 3600 + 15 * 60 + 42; // 01:15:42
      expect(formatCountdown(remainingSeconds)).toBe('01:15:42');
    });

    it('returns 00:00:00 when remaining time is zero or negative', () => {
      expect(formatCountdown(0)).toBe('00:00:00');
      expect(formatCountdown(-10)).toBe('00:00:00');
    });
  });

  describe('getRushBadgeMeta', () => {
    it('returns Lineups Locked styling when isLocked is true', () => {
      const meta = getRushBadgeMeta(true, false, false);
      expect(meta.label).toBe('Lineups Locked');
      expect(meta.badgeStyle).toContain('rose');
    });

    it('returns Rush Active badge when rush is active and lineups are not locked', () => {
      const meta = getRushBadgeMeta(false, true, true);
      expect(meta.label).toBe('Rush Active');
      expect(meta.badgeStyle).toContain('amber');
    });

    it('returns Deadline Today when approaching under 24 hours', () => {
      const meta = getRushBadgeMeta(false, false, true);
      expect(meta.label).toBe('Deadline Today');
      expect(meta.badgeStyle).toContain('sky');
    });

    it('returns Market Open when deadline is far away', () => {
      const meta = getRushBadgeMeta(false, false, false);
      expect(meta.label).toBe('Market Open');
      expect(meta.badgeStyle).toContain('emerald');
    });
  });
});
