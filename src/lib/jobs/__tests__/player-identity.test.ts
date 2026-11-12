import {
  deduplicatePlayerRecords,
  getCanonicalSteamId,
  getEquivalentProviderIds,
  getPlayerIdentityKeys,
  getRelatedPlayerIds,
  hasCanonicalSteamId,
  normalizePlayerIdentity,
} from '../player-identity';

describe('player identity normalization', () => {
  it('matches SteamID64 and account ID as the same player', () => {
    expect(normalizePlayerIdentity('76561198262015854')).toBe('steam-account:301750126');
    expect(normalizePlayerIdentity('301750126')).toBe('steam-account:301750126');
    expect(getPlayerIdentityKeys('76561198262015854', '301750126')).toEqual([
      'steam-account:301750126',
    ]);
  });

  it('uses the canonical SteamID64 for account-ID-only provider records', () => {
    expect(getCanonicalSteamId('301750126')).toBe('76561198262015854');
    expect(getCanonicalSteamId('76561198262015854')).toBe('76561198262015854');
    expect(getCanonicalSteamId('321580662')).toBe('76561198281846390');
  });

  it('finds provider-ID aliases for dashboard performance lookups', () => {
    expect(getEquivalentProviderIds('847565596')).toEqual([
      '847565596',
      '76561198807831324',
    ]);
    expect(getRelatedPlayerIds([
      { id: 10, data_provider_id: '847565596' },
      { id: 20, data_provider_id: '76561198807831324' },
    ])).toEqual(new Map([
      [10, [10, 20]],
      [20, [20, 10]],
    ]));
  });

  it('does not conflate arbitrary provider identifiers', () => {
    expect(normalizePlayerIdentity('player-alpha')).toBe('provider:player-alpha');
    expect(normalizePlayerIdentity('player-beta')).toBe('provider:player-beta');
    expect(normalizePlayerIdentity('0')).toBe('provider:0');
  });

  it('recognizes canonical Steam IDs for existing-record preference', () => {
    expect(hasCanonicalSteamId('301750126')).toBe(false);
    expect(hasCanonicalSteamId('76561198262015854')).toBe(true);
    expect(hasCanonicalSteamId('custom-provider-id')).toBe(false);
  });

  it('keeps one provider record when account ID and SteamID64 are both present', () => {
    const accountIdRecord = { id: '301750126', steamId: '301750126', name: 'Mikoto account ID' };
    const steamIdRecord = { id: '301750126', steamId: '76561198262015854', name: 'Mikoto SteamID64' };

    expect(deduplicatePlayerRecords([accountIdRecord, steamIdRecord])).toEqual([steamIdRecord]);
  });
});
