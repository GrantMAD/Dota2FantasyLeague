import type { DataProvider, MatchData } from '../../data-providers/provider-interface';
import {
  mapStratzMatchStatus,
  mapStratzTournamentStatus,
} from '../../data-providers/stratz-provider';
import {
  filterTournamentsToProviderIds,
  findExistingMatchByTeamsAndTime,
  fetchAllTournamentMatches,
  getTournamentSeriesIdentity,
  preserveMatchStatus,
  requireStratzMatchProvider,
  toDatabaseMatchStatus,
} from '../match-sync';

function makeMatch(id: string, status: MatchData['status']): MatchData {
  return {
    id,
    tournamentId: 'league-1',
    team1Id: 'team-1',
    team2Id: 'team-2',
    scheduledAt: new Date('2026-11-03T10:00:00Z'),
    status,
    lastUpdated: new Date('2026-11-03T10:00:00Z'),
  };
}

describe('match synchronization helpers', () => {
  it('uses provider series identity and falls back to a gameweek/team-pair key', () => {
    expect(getTournamentSeriesIdentity('stratz', 'bracket-series-7', 5, 12, 4, new Date('2026-11-12T19:00:00Z')))
      .toBe('provider:stratz:5:bracket-series-7');
    expect(getTournamentSeriesIdentity('opendota', undefined, 5, 12, 4, new Date('2026-11-12T19:00:00Z')))
      .toBe('fallback:5:2026-11-12:4:12');
    expect(getTournamentSeriesIdentity('opendota', undefined, 5, 4, 12, new Date('2026-11-12T21:00:00Z')))
      .toBe('fallback:5:2026-11-12:4:12');
  });

  it('maps STRATZ tournament timestamps and live state to status', () => {
    const now = Date.UTC(2026, 10, 3, 10);
    const nowInSeconds = now / 1000;

    expect(mapStratzTournamentStatus(false, nowInSeconds + 3600, nowInSeconds + 7200, now))
      .toBe('upcoming');
    expect(mapStratzTournamentStatus(true, nowInSeconds - 3600, nowInSeconds + 3600, now))
      .toBe('active');
    expect(mapStratzTournamentStatus(false, nowInSeconds - 7200, nowInSeconds - 3600, now))
      .toBe('concluded');
  });

  it('maps STRATZ match timestamps and live state to status', () => {
    const now = Date.UTC(2026, 10, 3, 10);
    const nowInSeconds = now / 1000;

    expect(mapStratzMatchStatus({ startDateTime: nowInSeconds + 3600 }, false, now))
      .toBe('scheduled');
    expect(mapStratzMatchStatus({ startDateTime: nowInSeconds - 3600 }, true, now))
      .toBe('live');
    expect(mapStratzMatchStatus({
      startDateTime: nowInSeconds - 7200,
      endDateTime: nowInSeconds - 3600,
    }, false, now)).toBe('concluded');
  });

  it.each([
    ['scheduled', 'scheduled'],
    ['live', 'in_progress'],
    ['concluded', 'completed'],
  ] as const)('maps provider status %s to database status %s', (providerStatus, databaseStatus) => {
    expect(toDatabaseMatchStatus(providerStatus)).toBe(databaseStatus);
  });

  it('does not downgrade an existing match status', () => {
    expect(preserveMatchStatus('in_progress', 'scheduled')).toBe('in_progress');
    expect(preserveMatchStatus('completed', 'in_progress')).toBe('completed');
    expect(preserveMatchStatus('scheduled', 'in_progress')).toBe('in_progress');
  });

  it('reconciles an OpenDota match by teams and start time when STRATZ IDs differ', () => {
    const existing = {
      id: 17,
      team_a_id: 1,
      team_b_id: 2,
      scheduled_time: '2026-11-03T10:00:00.000Z',
      external_match_id: 'opendota-match-id',
    };

    expect(findExistingMatchByTeamsAndTime(
      [existing],
      2,
      1,
      new Date('2026-11-03T10:10:00.000Z')
    )).toEqual({ match: existing, ambiguous: false });
  });

  it('does not reconcile when identity is ambiguous, outside the time window, or only scheduled', () => {
    const existing = {
      id: 17,
      team_a_id: 1,
      team_b_id: 2,
      scheduled_time: '2026-11-03T10:00:00.000Z',
      external_match_id: 'opendota-match-id',
    };
    const second = { ...existing, id: 18 };

    expect(findExistingMatchByTeamsAndTime(
      [existing, second],
      1,
      2,
      new Date('2026-11-03T10:00:00.000Z')
    )).toEqual({ match: null, ambiguous: true });

    expect(findExistingMatchByTeamsAndTime(
      [existing],
      1,
      2,
      new Date('2026-11-03T10:30:00.000Z')
    )).toEqual({ match: null, ambiguous: false });

    expect(findExistingMatchByTeamsAndTime(
      [{ ...existing, external_match_id: 'scheduled:100:300' }],
      1,
      2,
      new Date('2026-11-03T10:00:00.000Z')
    )).toEqual({ match: null, ambiguous: false });
  });

  it('requires STRATZ for full match synchronization', () => {
    const makeProvider = (name: string): DataProvider => ({
      name,
      version: 'test',
      healthCheck: jest.fn(),
      fetchPlayers: jest.fn(),
      fetchPlayer: jest.fn(),
      fetchTeams: jest.fn(),
      fetchTeam: jest.fn(),
      fetchTournaments: jest.fn(),
      fetchMatches: jest.fn(),
      fetchMatchDetails: jest.fn(),
      fetchRosterHistory: jest.fn(),
      getRateLimitStatus: jest.fn(),
    });

    expect(() => requireStratzMatchProvider(makeProvider('OpenDota')))
      .toThrow('Full match synchronization requires STRATZ');
    expect(() => requireStratzMatchProvider(makeProvider('STRATZ'))).not.toThrow();
  });

  it('limits match sync to tournaments returned by the professional STRATZ tier query', () => {
    const tournaments = [
      { id: 1, data_provider_id: 'pro-league' },
      { id: 2, data_provider_id: 'community-league' },
      { id: 3, data_provider_id: null },
    ];

    expect(filterTournamentsToProviderIds(tournaments, new Set(['pro-league'])))
      .toEqual([tournaments[0]]);
  });

  it('fetches all pages of match statuses and deduplicates provider records', async () => {
    const matches = Array.from({ length: 205 }, (_, index) => makeMatch(`match-${index}`, 'scheduled'));
    const fetchMatches = jest.fn(async (_tournamentId?: string, filters?: { offset?: number; limit?: number }) => (
      matches.slice(filters?.offset ?? 0, (filters?.offset ?? 0) + (filters?.limit ?? 100))
    ));
    const provider: DataProvider = {
      name: 'STRATZ',
      version: 'test',
      healthCheck: jest.fn(),
      fetchPlayers: jest.fn(),
      fetchPlayer: jest.fn(),
      fetchTeams: jest.fn(),
      fetchTeam: jest.fn(),
      fetchTournaments: jest.fn(),
      fetchMatches,
      fetchMatchDetails: jest.fn(),
      fetchRosterHistory: jest.fn(),
      getRateLimitStatus: jest.fn(),
    };

    const result = await fetchAllTournamentMatches(provider, 'league-1');

    expect(result).toHaveLength(205);
    expect(fetchMatches.mock.calls.map(([id, filters]) => [id, filters?.offset])).toEqual([
      ['league-1', 0],
      ['league-1', 100],
      ['league-1', 200],
    ]);
  });

  it('stops pagination when a provider repeats a full page', async () => {
    const matches = Array.from({ length: 100 }, (_, index) => makeMatch(`match-${index}`, 'scheduled'));
    const fetchMatches = jest.fn(async () => matches);
    const provider: DataProvider = {
      name: 'OpenDota',
      version: 'test',
      healthCheck: jest.fn(),
      fetchPlayers: jest.fn(),
      fetchPlayer: jest.fn(),
      fetchTeams: jest.fn(),
      fetchTeam: jest.fn(),
      fetchTournaments: jest.fn(),
      fetchMatches,
      fetchMatchDetails: jest.fn(),
      fetchRosterHistory: jest.fn(),
      getRateLimitStatus: jest.fn(),
    };

    const result = await fetchAllTournamentMatches(provider, 'league-1');

    expect(result).toHaveLength(100);
    expect(fetchMatches).toHaveBeenCalledTimes(2);
  });
});
