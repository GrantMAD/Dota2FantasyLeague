import { findGameweekForMatch, type GameweekWindow } from '../match-gameweek-routing';

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
  });
});
