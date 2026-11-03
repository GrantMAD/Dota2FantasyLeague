import { StratzProvider } from './stratz-provider';

describe('STRATZ match ingestion queries', () => {
  const provider = new StratzProvider({
    apiKey: 'test-key',
    apiUrl: 'https://api.stratz.com/graphql',
  });
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockGraphQLResponse(data: unknown) {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data }), { status: 200 }));
  }

  function getQuery(): string {
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as { query: string };
    return body.query;
  }

  it('lists leagues using the current STRATZ schema and maps Unix timestamps', async () => {
    const startDateTime = Math.floor(Date.now() / 1000) + 3600;
    const endDateTime = startDateTime + 7200;
    mockGraphQLResponse({
      leagues: [{
        id: 100,
        name: 'Upcoming League',
        region: 'EUROPE',
        prizePool: 50000,
        tier: 'PROFESSIONAL',
        startDateTime,
        endDateTime,
        hasLiveMatches: false,
      }],
    });

    const tournaments = await provider.fetchTournaments();
    const query = getQuery();

    expect(query).toContain('leagues(request:');
    expect(query).toContain('startDateTime');
    expect(query).toContain('endDateTime');
    expect(query).toContain('displayName');
    expect(query).toContain('requireStartAndEndDates: true');
    expect(query).toContain('tiers: [PROFESSIONAL, MINOR, MAJOR, INTERNATIONAL, DPC_QUALIFIER, DPC_LEAGUE_QUALIFIER, DPC_LEAGUE, DPC_LEAGUE_FINALS]');
    expect(query).not.toContain('league(request:');
    expect(query).not.toContain('status');
    expect(query).not.toContain('teams');
    expect(tournaments[0]).toMatchObject({
      id: '100',
      status: 'upcoming',
      startDate: new Date(startDateTime * 1000),
      endDate: new Date(endDateTime * 1000),
    });
  });

  it('uses displayName when name is missing and skips leagues without either name', async () => {
    mockGraphQLResponse({
      leagues: [
        {
          id: 100,
          name: '  ',
          tier: 'PROFESSIONAL',
          startDateTime: Math.floor(Date.now() / 1000),
        },
        {
          id: 101,
          name: null,
          displayName: 'League display name',
          tier: 'MAJOR',
          startDateTime: Math.floor(Date.now() / 1000),
        },
        {
          id: 102,
          name: 'Valid League',
          displayName: null,
          tier: 'PROFESSIONAL',
          startDateTime: Math.floor(Date.now() / 1000) + 3600,
          endDateTime: Math.floor(Date.now() / 1000) + 7200,
        },
        {
          id: 103,
          name: null,
          displayName: null,
          tier: 'PROFESSIONAL',
          startDateTime: Math.floor(Date.now() / 1000) + 3600,
          endDateTime: Math.floor(Date.now() / 1000) + 7200,
        },
        {
          id: 104,
          name: 'Community League',
          tier: 'AMATEUR',
          startDateTime: Math.floor(Date.now() / 1000) + 3600,
          endDateTime: Math.floor(Date.now() / 1000) + 7200,
        },
      ],
    });

    await expect(provider.fetchTournaments()).resolves.toMatchObject([
      { id: '101', name: 'League display name' },
      { id: '102', name: 'Valid League' },
    ]);
  });

  it('fetches league matches and includes live matches with normalized statuses', async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const scheduledTime = nowInSeconds + 3600;
    mockGraphQLResponse({
      league: {
        matches: [{
          id: 200,
          leagueId: 100,
          radiantTeamId: 1,
          direTeamId: 2,
          startDateTime: nowInSeconds - 7200,
          endDateTime: nowInSeconds - 3600,
          durationSeconds: 3600,
          didRadiantWin: true,
          series: { teamOneWinCount: 1, teamTwoWinCount: 0 },
        }],
        nodeGroups: [{
          nodes: [{
            id: 8,
            nodeGroupId: 3,
            seriesId: 300,
            scheduledTime,
            teamOneId: 5,
            teamTwoId: 6,
            hasStarted: false,
            isCompleted: false,
          }],
        }],
        liveMatches: [{
          matchId: 201,
          leagueId: 100,
          radiantTeamId: 3,
          direTeamId: 4,
          completed: false,
          createdDateTime: nowInSeconds - 600,
        }],
      },
    });

    const matches = await provider.fetchMatches('100');
    const query = getQuery();

    expect(query).toContain('league(id: 100)');
    expect(query).toContain('matches(request:');
    expect(query).toContain('liveMatches');
    expect(query).toContain('nodeGroups');
    expect(query).toContain('scheduledTime');
    expect(query).toContain('teamOneWinCount');
    expect(query).not.toContain('match(request:');
    expect(query).not.toContain('status');
    expect(matches.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: '200', status: 'concluded' },
      { id: '201', status: 'live' },
      { id: 'scheduled:100:300', status: 'scheduled' },
    ]);
    expect(matches[0].seriesStatus).toEqual({ team1Wins: 1, team2Wins: 0 });
    expect(matches[2].sourceSeriesId).toBe('300');
    expect(matches[2].scheduledAt).toEqual(new Date(scheduledTime * 1000));
  });

  it('fetches match details with current player fields and maps unavailable stats explicitly', async () => {
    mockGraphQLResponse({
      match: {
        id: 200,
        durationSeconds: 2400,
        radiantTeamId: 1,
        direTeamId: 2,
        didRadiantWin: true,
        players: [{
          steamAccountId: 12345,
          heroId: 7,
          isRadiant: true,
          kills: 4,
          deaths: 2,
          assists: 9,
          goldPerMinute: 500,
          experiencePerMinute: 600,
          numLastHits: 250,
          numDenies: 10,
          heroDamage: 20000,
          towerDamage: 3000,
          heroHealing: 1000,
          hero: { displayName: 'Hero Name', shortName: 'hero_name' },
        }],
      },
    });

    const details = await provider.fetchMatchDetails('200');
    const query = getQuery();
    const player = details.teams[0].players[0];

    expect(query).toContain('match(id: 200)');
    expect(query).toContain('didRadiantWin');
    expect(query).toContain('steamAccountId');
    expect(query).toContain('numLastHits');
    expect(query).toContain('heroHealing');
    expect(query).not.toContain('isRadiantVictory');
    expect(query).not.toContain('wardsPlaced');
    expect(details.winner).toBe('1');
    expect(player).toMatchObject({
      playerId: '12345',
      lastHits: 250,
      denies: 10,
      healing: 1000,
      wardsPlaced: 0,
      wardsDestroyed: 0,
      firstBloodAchieved: false,
      roshansKilled: 0,
    });
  });
});
