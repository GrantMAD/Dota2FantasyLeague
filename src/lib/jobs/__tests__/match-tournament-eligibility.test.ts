import { overlapsConfiguredGameweek } from '../match-tournament-eligibility';

const gameweeks = [
  {
    id: 1,
    gameweek_number: 1,
    start_date: '2026-11-01T00:00:00Z',
    end_date: '2026-11-07T23:59:59Z',
  },
  {
    id: 2,
    gameweek_number: 2,
    start_date: '2026-11-08T00:00:00Z',
    end_date: '2026-11-14T23:59:59Z',
  },
];

describe('overlapsConfiguredGameweek', () => {
  it('keeps tournaments overlapping a current or upcoming configured gameweek', () => {
    expect(overlapsConfiguredGameweek({
      start_date: '2026-11-10',
      end_date: '2026-11-20',
    }, gameweeks)).toBe(true);
  });

  it('skips tournaments whose full date range is outside configured gameweeks', () => {
    expect(overlapsConfiguredGameweek({
      start_date: '2026-11-15',
      end_date: '2026-11-20',
    }, gameweeks)).toBe(false);
  });

  it('fails open when tournament dates are invalid or reversed', () => {
    expect(overlapsConfiguredGameweek({
      start_date: 'unknown',
      end_date: '2026-11-20',
    }, gameweeks)).toBe(true);
    expect(overlapsConfiguredGameweek({
      start_date: '2026-11-20',
      end_date: '2026-11-15',
    }, gameweeks)).toBe(true);
  });

  it('fails open if a configured gameweek has invalid dates', () => {
    expect(overlapsConfiguredGameweek({
      start_date: '2026-11-15',
      end_date: '2026-11-20',
    }, [{
      ...gameweeks[0],
      start_date: 'invalid',
    }])).toBe(true);
  });
});
