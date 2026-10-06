/// <reference types="jest" />

import type { DataProvider } from '@/lib/data-providers/provider-interface';
import { StratzProvider } from '@/lib/data-providers/stratz-provider';
import { ResilientDataProvider } from '@/lib/data-providers/resilient-provider';

function makeProvider(name: string): DataProvider & {
  fetchPlayers: jest.Mock<Promise<never[]>, []>;
  healthCheck: jest.Mock<Promise<boolean>, []>;
} {
  return {
    name,
    version: 'test',
    healthCheck: jest.fn().mockResolvedValue(true),
    fetchPlayers: jest.fn().mockResolvedValue([]),
    fetchPlayer: jest.fn(),
    fetchTeams: jest.fn(),
    fetchTeam: jest.fn(),
    fetchTournaments: jest.fn(),
    fetchMatches: jest.fn(),
    fetchMatchDetails: jest.fn(),
    fetchRosterHistory: jest.fn(),
    getRateLimitStatus: jest.fn(),
  };
}

describe('ResilientDataProvider', () => {
  it('fails over at request time after a primary provider error', async () => {
    const primary = makeProvider('Primary');
    const fallback = makeProvider('Fallback');
    primary.fetchPlayers.mockRejectedValue(new Error('primary request failed'));
    fallback.fetchPlayers.mockResolvedValue([{ id: 'fallback-player' }] as never[]);
    const provider = new ResilientDataProvider(primary, fallback);

    await expect(provider.fetchPlayers()).resolves.toEqual([{ id: 'fallback-player' }]);
    expect(primary.fetchPlayers).toHaveBeenCalledTimes(1);
    expect(fallback.healthCheck).toHaveBeenCalledTimes(1);
    expect(fallback.fetchPlayers).toHaveBeenCalledTimes(1);
  });

  it('opens the primary circuit after repeated errors and retries it after cooldown', async () => {
    const primary = makeProvider('Primary');
    const fallback = makeProvider('Fallback');
    primary.fetchPlayers.mockRejectedValue(new Error('primary unavailable'));
    const provider = new ResilientDataProvider(primary, fallback);

    await provider.fetchPlayers();
    await provider.fetchPlayers();
    await provider.fetchPlayers();
    expect(primary.fetchPlayers).toHaveBeenCalledTimes(2);
    expect(fallback.fetchPlayers).toHaveBeenCalledTimes(3);

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31_000);
    primary.fetchPlayers.mockResolvedValue([{ id: 'recovered' }] as never[]);
    await expect(provider.fetchPlayers()).resolves.toEqual([{ id: 'recovered' }]);
    expect(primary.fetchPlayers).toHaveBeenCalledTimes(3);
  });

  it('throws an explicit combined error when both providers fail', async () => {
    const primary = makeProvider('Primary');
    const fallback = makeProvider('Fallback');
    primary.fetchPlayers.mockRejectedValue(new Error('primary unavailable'));
    fallback.healthCheck.mockResolvedValue(false);
    const provider = new ResilientDataProvider(primary, fallback);

    await expect(provider.fetchPlayers()).rejects.toThrow(
      'All configured data providers failed during fetchPlayers. Primary: primary unavailable; Fallback: Fallback health check failed'
    );
  });

  it('reports both request failures when both providers are unhealthy', async () => {
    const primary = makeProvider('Primary');
    const fallback = makeProvider('Fallback');
    primary.fetchPlayers.mockRejectedValue(new Error('primary request failed'));
    fallback.fetchPlayers.mockRejectedValue(new Error('fallback request failed'));
    const provider = new ResilientDataProvider(primary, fallback);

    await expect(provider.fetchPlayers()).rejects.toThrow(
      'All configured data providers failed during fetchPlayers. Primary: primary request failed; Fallback: fallback request failed'
    );
  });

  it('fails over when STRATZ returns a malformed successful payload instead of empty success', async () => {
    const primary = new StratzProvider({
      apiUrl: 'https://stratz.example/graphql',
      apiKey: 'test-key',
    });
    const fallback = makeProvider('OpenDota');
    fallback.fetchPlayers.mockResolvedValue([{ id: 'fallback-player' }] as never[]);
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 })
    );
    const provider = new ResilientDataProvider(primary, fallback);

    await expect(provider.fetchPlayers()).resolves.toEqual([{ id: 'fallback-player' }]);
    expect(fallback.fetchPlayers).toHaveBeenCalledTimes(1);
  });
});
