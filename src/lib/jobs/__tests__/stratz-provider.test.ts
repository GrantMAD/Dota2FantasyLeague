/// <reference types="jest" />

import { StratzProvider } from '@/lib/data-providers/stratz-provider';

describe('STRATZ pro player identifiers', () => {
  const originalFallback = process.env.ENABLE_PROVIDER_FALLBACK;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFallback === undefined) {
      delete process.env.ENABLE_PROVIDER_FALLBACK;
    } else {
      process.env.ENABLE_PROVIDER_FALLBACK = originalFallback;
    }
  });

  it('maps the queried steamAccountId to both provider player identifiers', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          proSteamAccounts: [{
            steamAccountId: 123456,
            name: 'Player One',
            isPro: true,
            fantasyRole: 1,
            team: { id: 42, name: 'Team One', tag: 'ONE' },
            countries: ['US'],
            steam: { avatar: 'https://example.com/avatar.png', profileUrl: 'https://example.com/player' },
          }],
        },
      }), { status: 200 })
    );
    const provider = new StratzProvider({ apiUrl: 'https://stratz.example/graphql', apiKey: 'test-key' });

    const players = await provider.fetchPlayers();
    const request = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)) as { query: string };

    expect(request.query).toContain('steamAccountId');
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      id: '123456',
      steamId: '123456',
      name: 'Player One',
    });
  });

  it.each([null, 'not-a-number', 0])('rejects a pro player record with invalid steamAccountId %p', async (steamAccountId) => {
    process.env.ENABLE_PROVIDER_FALLBACK = 'false';
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          proSteamAccounts: [{
            steamAccountId,
            name: 'Player Without ID',
            isPro: true,
            team: { id: 42, name: 'Team One' },
          }],
        },
      }), { status: 200 })
    );
    const provider = new StratzProvider({ apiUrl: 'https://stratz.example/graphql', apiKey: 'test-key' });

    await expect(provider.fetchPlayers()).rejects.toThrow('valid steamAccountId');
  });
});
