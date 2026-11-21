import { mapGameweekTournaments, isGameweekEndingSoon } from './gameweek-tournaments';

describe('mapGameweekTournaments', () => {
  it('only includes tournaments linked to matches in the selected gameweek', () => {
    const result = mapGameweekTournaments(
      [
        { series_id: 10, status: 'completed' },
        { series_id: 10, status: 'scheduled' },
        { series_id: 11, status: 'in_progress' },
      ],
      [
        { id: 10, tournament_id: 1, best_of: 3 },
        { id: 11, tournament_id: 2, best_of: 5 },
        { id: 12, tournament_id: 3, best_of: 3 },
      ],
      [
        { id: 1, name: 'Tournament with matches', tier: '1', start_date: '2026-11-01' },
        { id: 2, name: 'Tournament with matches', tier: '2', start_date: '2026-11-02' },
        { id: 3, name: 'Tournament without gameweek matches', tier: '1', start_date: '2026-11-03' },
      ],
    );

    expect(result).toEqual([
      {
        id: 1,
        name: 'Tournament with matches',
        tier: '1',
        start_date: '2026-11-01',
        seriesCount: 1,
        matchCount: 2,
        bestOfFormats: [3],
      },
      {
        id: 2,
        name: 'Tournament with matches',
        tier: '2',
        start_date: '2026-11-02',
        seriesCount: 1,
        matchCount: 1,
        bestOfFormats: [5],
      },
    ]);
  });

  it('returns no tournaments when the gameweek has no matches', () => {
    expect(mapGameweekTournaments(
      [],
      [{ id: 10, tournament_id: 1, best_of: 3 }],
      [{ id: 1, name: 'Tournament', tier: '1', start_date: '2026-11-01' }],
    )).toEqual([]);
  });
});

describe('isGameweekEndingSoon', () => {
  const baseTime = new Date('2026-11-21T12:00:00Z').getTime();

  it('returns false when the gameweek has more than 24 hours remaining', () => {
    // 36 hours remaining
    const endDate = new Date(baseTime + 36 * 60 * 60 * 1000).toISOString();
    expect(isGameweekEndingSoon('active', endDate, baseTime)).toBe(false);
  });

  it('returns true when an active gameweek is within 24 hours of ending', () => {
    // 12 hours remaining
    const endDate = new Date(baseTime + 12 * 60 * 60 * 1000).toISOString();
    expect(isGameweekEndingSoon('active', endDate, baseTime)).toBe(true);
  });

  it('returns true at exactly 24 hours remaining boundary', () => {
    const endDate = new Date(baseTime + 24 * 60 * 60 * 1000).toISOString();
    expect(isGameweekEndingSoon('active', endDate, baseTime)).toBe(true);
  });

  it('returns false when the gameweek end date has already passed', () => {
    // 2 hours in the past
    const endDate = new Date(baseTime - 2 * 60 * 60 * 1000).toISOString();
    expect(isGameweekEndingSoon('active', endDate, baseTime)).toBe(false);
  });

  it('returns false when gameweek is upcoming even if within 24 hours of start or end', () => {
    const endDate = new Date(baseTime + 12 * 60 * 60 * 1000).toISOString();
    expect(isGameweekEndingSoon('upcoming', endDate, baseTime)).toBe(false);
  });

  it('returns false when gameweek is closed', () => {
    const endDate = new Date(baseTime + 12 * 60 * 60 * 1000).toISOString();
    expect(isGameweekEndingSoon('closed', endDate, baseTime)).toBe(false);
  });

  it('returns false when end date is missing or invalid', () => {
    expect(isGameweekEndingSoon('active', null, baseTime)).toBe(false);
    expect(isGameweekEndingSoon('active', undefined, baseTime)).toBe(false);
    expect(isGameweekEndingSoon('active', 'not-a-valid-date', baseTime)).toBe(false);
  });
});

