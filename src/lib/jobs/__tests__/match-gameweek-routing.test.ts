import {
  findGameweekForMatch,
  resolveGameweekForMatch,
  summarizeOutOfGameweekMatches,
  type GameweekWindow,
} from '../match-gameweek-routing';

const gameweeks: GameweekWindow[] = [
  {
    id: 1,
    gameweek_number: 1,
    start_date: '2026-09-23T00:00:00',
    end_date: '2026-10-05T23:59:00',
  },
  {
    id: 2,
    gameweek_number: 2,
    start_date: '2026-10-06T00:00:00',
    end_date: '2026-10-19T23:59:00',
  },
];

describe('findGameweekForMatch', () => {
  it('routes a historical match to the gameweek containing its scheduled time', () => {
    expect(findGameweekForMatch('2026-10-03T09:51:51', gameweeks)?.id).toBe(1);
  });

  it('includes both configured window boundaries', () => {
    expect(findGameweekForMatch('2026-09-23T00:00:00Z', gameweeks)?.id).toBe(1);
    expect(findGameweekForMatch('2026-10-06T00:00:00Z', gameweeks)?.id).toBe(2);
  });

  it('does not assign a match outside every configured gameweek', () => {
    expect(findGameweekForMatch('2026-09-20T15:52:22', gameweeks)).toBeNull();
    expect(resolveGameweekForMatch('2026-01-17T22:18:58Z', gameweeks)).toEqual({ status: 'outside' });
  });

  it('does not choose arbitrarily when gameweek windows overlap', () => {
    const overlapping = [
      ...gameweeks,
      {
        id: 3,
        gameweek_number: 3,
        start_date: '2026-10-05T12:00:00',
        end_date: '2026-10-07T12:00:00',
      },
    ];

    expect(findGameweekForMatch('2026-10-06T12:00:00', overlapping)).toBeNull();
    expect(resolveGameweekForMatch('2026-10-06T12:00:00', overlapping)).toEqual({ status: 'ambiguous' });
  });

  it('reports invalid timestamps separately from valid out-of-window matches', () => {
    expect(resolveGameweekForMatch('not-a-date', gameweeks)).toEqual({ status: 'invalid-time' });
  });

  it('separates past and future out-of-gameweek fixtures and caps future examples', () => {
    const diagnostics = summarizeOutOfGameweekMatches(
      [
        {
          id: 'past',
          status: 'concluded',
          scheduledAt: new Date('2026-09-20T15:00:00Z'),
        },
        {
          id: 'future-1',
          status: 'scheduled',
          scheduledAt: new Date('2026-10-21T15:00:00Z'),
        },
        {
          id: 'future-2',
          status: 'scheduled',
          scheduledAt: new Date('2026-10-22T15:00:00Z'),
        },
        {
          id: 'in-window',
          status: 'scheduled',
          scheduledAt: new Date('2026-10-10T15:00:00Z'),
        },
      ],
      gameweeks,
      'Test Tournament',
      new Date('2026-10-20T12:00:00Z'),
      1,
    );

    expect(diagnostics).toEqual({
      pastCount: 1,
      futureCount: 2,
      futureExamples: [{
        matchId: 'future-1',
        tournamentName: 'Test Tournament',
        status: 'scheduled',
        scheduledAt: '2026-10-21T15:00:00.000Z',
      }],
    });
  });
});
