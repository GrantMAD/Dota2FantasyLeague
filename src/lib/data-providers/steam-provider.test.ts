import { SteamProvider } from './steam-provider';

describe('SteamProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws an error if instantiated without apiKey', () => {
    expect(() => new SteamProvider({ apiKey: '' })).toThrow('SteamProvider requires an apiKey.');
  });

  it('performs a successful health check', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { status: 1, matches: [] } }),
    });

    const provider = new SteamProvider({ apiKey: 'TEST_KEY' });
    const isHealthy = await provider.healthCheck();
    expect(isHealthy).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('GetMatchHistory'),
      expect.any(Object)
    );
  });

  it('fetches and normalizes matches for a league combining live and completed', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('GetLiveLeagueGames')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            result: {
              games: [
                {
                  match_id: '9090050956',
                  league_id: 20486,
                  radiant_team_id: 10291652,
                  dire_team_id: 2163,
                  radiant_team: { team_name: 'LEGION', team_id: 10291652 },
                  dire_team: { team_name: 'Team Liquid', team_id: 2163 },
                  series_id: 1168375,
                  activate_time: 1794672136,
                  deactivate_time: 0,
                },
              ],
            },
          }),
        });
      }

      if (url.includes('GetMatchHistory')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            result: {
              matches: [
                {
                  match_id: 9089886596,
                  start_time: 1794667516,
                  radiant_team_id: 10331139,
                  dire_team_id: 2576071,
                  series_id: 1168207,
                },
              ],
            },
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const provider = new SteamProvider({ apiKey: 'TEST_KEY' });
    const matches = await provider.fetchMatches('20486');

    expect(matches.length).toBe(2);
    // Completed match
    const completed = matches.find((m) => m.id === '9089886596');
    expect(completed).toBeDefined();
    expect(completed?.status).toBe('concluded');
    expect(completed?.sourceSeriesId).toBe('1168207');
    expect(completed?.team1Id).toBe('10331139');
    expect(completed?.team2Id).toBe('2576071');

    // Live match
    const live = matches.find((m) => m.id === '9090050956');
    expect(live).toBeDefined();
    expect(live?.status).toBe('live');
    expect(live?.sourceSeriesId).toBe('1168375');
    expect(live?.team1Name).toBe('LEGION');
    expect(live?.team2Name).toBe('Team Liquid');
  });

  it('resolves team info and logo UGC URL', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('GetTeamInfoByTeamID')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({
            result: {
              teams: [
                {
                  name: 'Angry Birds',
                  tag: 'AB',
                  logo: 9670889445061171052,
                  country_code: 'ua',
                },
              ],
            },
          }),
        });
      }

      if (url.includes('GetUGCFileDetails')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              url: 'https://cdn.steamusercontent.com/ugc/9670889445061171052/TEST.png',
            },
          }),
        });
      }

      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const provider = new SteamProvider({ apiKey: 'TEST_KEY' });
    const team = await provider.fetchTeam('10322861');

    expect(team.name).toBe('Angry Birds');
    expect(team.tag).toBe('AB');
    expect(team.logoUrl).toBe('https://cdn.steamusercontent.com/ugc/9670889445061171052/TEST.png');

    const logoDirect = await provider.fetchTeamLogo('10322861');
    expect(logoDirect).toBe('https://cdn.steamusercontent.com/ugc/9670889445061171052/TEST.png');
  });

  it('fetches player summaries with 32-bit to 64-bit Steam ID conversion', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          players: [
            {
              steamid: '76561198278146366',
              personaname: 'Save-',
              avatarfull: 'https://avatars.steamstatic.com/save_full.jpg',
            },
          ],
        },
      }),
    });

    const provider = new SteamProvider({ apiKey: 'TEST_KEY' });
    const player = await provider.fetchPlayer('317880638');

    expect(player.name).toBe('Save-');
    expect(player.imageUrl).toBe('https://avatars.steamstatic.com/save_full.jpg');
    expect(player.steamId).toBe('76561198278146366');
  });
});
