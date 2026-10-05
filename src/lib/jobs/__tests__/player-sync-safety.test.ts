/// <reference types="jest" />

import { fetchRawOpenDotaProPlayers } from '@/lib/data-providers/opendota-provider';
import { shouldDeactivateMissingPlayers } from '../player-sync-safety';

describe('player sync safety', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('OpenDota pro player feed', () => {
    it('throws for an unsuccessful HTTP response instead of returning an empty feed', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response('provider unavailable', { status: 503 }),
      );

      await expect(fetchRawOpenDotaProPlayers()).rejects.toThrow('status 503');
    });

    it('propagates network failures instead of returning an empty feed', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network unavailable'));

      await expect(fetchRawOpenDotaProPlayers()).rejects.toThrow('network unavailable');
    });

    it('throws when the feed is malformed', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ players: [] }), { status: 200 }),
      );

      await expect(fetchRawOpenDotaProPlayers()).rejects.toThrow('expected an array');
    });

    it('throws when a response contains an incomplete player record', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify([{ account_id: 123 }, { name: 'Missing account id' }]), { status: 200 }),
      );

      await expect(fetchRawOpenDotaProPlayers()).rejects.toThrow('incomplete player record');
    });

    it('accepts a valid empty feed as distinct from a failed fetch', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200 }),
      );

      await expect(fetchRawOpenDotaProPlayers()).resolves.toEqual([]);
    });
  });

  describe('missing-player deactivation guard', () => {
    it('never deactivates from an empty feed', () => {
      expect(shouldDeactivateMissingPlayers(0, 400)).toBe(false);
    });

    it('skips deactivation when a fetched feed is less than half of the existing provider-linked roster', () => {
      expect(shouldDeactivateMissingPlayers(199, 400)).toBe(false);
    });

    it('allows deactivation when the feed meets the minimum coverage threshold', () => {
      expect(shouldDeactivateMissingPlayers(200, 400)).toBe(true);
    });

    it('allows a non-empty initial sync when there are no existing provider-linked players', () => {
      expect(shouldDeactivateMissingPlayers(12, 0)).toBe(true);
    });
  });
});
