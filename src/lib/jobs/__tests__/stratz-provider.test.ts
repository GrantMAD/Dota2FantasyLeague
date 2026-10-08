/// <reference types="jest" />

import { StratzProvider } from '@/lib/data-providers/stratz-provider';
import { OpenDotaProvider } from '@/lib/data-providers/opendota-provider';
import { ResilientDataProvider } from '@/lib/data-providers/resilient-provider';

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
            id: 123456,
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

    expect(request.query).toContain('id');
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      id: '123456',
      steamId: '123456',
      name: 'Player One',
    });
  });

  it.each([null, 'not-a-number', 0])('rejects a pro player record with invalid account id %p', async (id) => {
    process.env.ENABLE_PROVIDER_FALLBACK = 'false';
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          proSteamAccounts: [{
            id,
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

  it('rejects a successful GraphQL response missing the queried player collection', async () => {
    process.env.ENABLE_PROVIDER_FALLBACK = 'false';
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), { status: 200 })
    );
    const provider = new StratzProvider({ apiUrl: 'https://stratz.example/graphql', apiKey: 'test-key' });

    await expect(provider.fetchPlayers()).rejects.toThrow('proSteamAccounts response is missing or invalid');
  });

  it('uses a bounded health probe against the configured GraphQL API', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { constants: { gameVersions: [] } } }), { status: 200 })
    );
    const provider = new StratzProvider({ apiUrl: 'https://stratz.example/graphql', apiKey: 'test-key' });

    await expect(provider.healthCheck()).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://stratz.example/graphql',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('builds active team records from the current pro player team fields', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          proSteamAccounts: [
            {
              id: 101,
              name: 'Player One',
              isPro: true,
              team: {
                id: 42,
                name: 'Team One',
                tag: 'ONE',
                countryCode: 'US',
                logo: 'https://example.com/team.png',
              },
            },
            {
              id: 102,
              name: 'Player Two',
              isPro: true,
              team: { id: 42, name: 'Team One', tag: 'ONE', countryCode: 'US' },
            },
            {
              id: 103,
              name: 'Inactive Player',
              isPro: false,
              team: { id: 43, name: 'Inactive Team' },
            },
          ],
        },
      }), { status: 200 })
    );
    const provider = new StratzProvider({ apiUrl: 'https://stratz.example/graphql', apiKey: 'test-key' });

    const teams = await provider.fetchTeams();
    const request = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)) as { query: string };

    expect(request.query).toContain('proSteamAccounts');
    expect(request.query).not.toContain('team(request:');
    expect(request.query).not.toContain('founded');
    expect(request.query).not.toContain('players {');
    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({
      id: '42',
      name: 'Team One',
      tag: 'ONE',
      country: 'US',
      logoUrl: 'https://example.com/team.png',
      isActive: true,
      roster: [
        { playerId: '101' },
        { playerId: '102' },
      ],
    });
  });

  it('paginates the deduplicated team list', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          proSteamAccounts: [1, 2, 3].map((id) => ({
            id,
            name: `Player ${id}`,
            isPro: true,
            team: { id, name: `Team ${id}` },
          })),
        },
      }), { status: 200 })
    );
    const provider = new StratzProvider({ apiUrl: 'https://stratz.example/graphql', apiKey: 'test-key' });

    await expect(provider.fetchTeams({ offset: 1, limit: 1 })).resolves.toMatchObject([
      { id: '2', name: 'Team 2' },
    ]);
  });

  it('fetches a single team with the required teamId and current member fields', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          team: {
            id: 42,
            name: 'Team One',
            tag: 'ONE',
            countryCode: 'US',
            logo: 'https://example.com/team.png',
            members: [
              { steamAccountId: 101, firstMatchDateTime: 1_700_000_000 },
            ],
          },
        },
      }), { status: 200 })
    );
    const provider = new StratzProvider({ apiUrl: 'https://stratz.example/graphql', apiKey: 'test-key' });

    const team = await provider.fetchTeam('42');
    const request = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)) as {
      query: string;
      variables: { teamId: number };
    };

    expect(request.query).toContain('team(teamId: $teamId)');
    expect(request.query).toContain('members');
    expect(request.query).not.toContain('team(request:');
    expect(request.variables).toEqual({ teamId: 42 });
    expect(team).toMatchObject({
      id: '42',
      name: 'Team One',
      roster: [{ playerId: '101' }],
    });
  });

  it('rejects non-numeric team IDs before sending a GraphQL request', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const provider = new StratzProvider({ apiUrl: 'https://stratz.example/graphql', apiKey: 'test-key' });

    await expect(provider.fetchTeam('42) { teams { teamIds: [] }')).rejects.toThrow('Team 42) { teams');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('serves team sync from STRATZ when OpenDota starts with an open circuit', async () => {
    jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ data: { constants: { gameVersions: [] } } }),
        { status: 200 },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          data: {
            proSteamAccounts: [{
              id: 101,
              name: 'Player One',
              isPro: true,
              team: { id: 42, name: 'Team One', tag: 'ONE' },
            }],
          },
        }),
        { status: 200 },
      ));
    const provider = new ResilientDataProvider(
      new OpenDotaProvider(),
      new StratzProvider({ apiUrl: 'https://stratz.example/graphql', apiKey: 'test-key' }),
      false,
    );

    await expect(provider.fetchTeams({ activeOnly: true })).resolves.toMatchObject([
      { id: '42', name: 'Team One', roster: [{ playerId: '101' }] },
    ]);
  });
});
