import {
  overlapsConfiguredGameweek,
  isDisqualifiedTournament,
} from '../match-tournament-eligibility';

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

describe('isDisqualifiedTournament', () => {
  it('disqualifies known amateur ticket leagues (Party To Play 16251 and 互联网联赛 17508)', () => {
    expect(isDisqualifiedTournament('16251')).toBe(true);
    expect(isDisqualifiedTournament(16251)).toBe(true);
    expect(isDisqualifiedTournament('17508')).toBe(true);
    expect(isDisqualifiedTournament(17508)).toBe(true);
  });

  it('disqualifies tournaments spanning longer than MAX_VALID_TOURNAMENT_DURATION_DAYS (180 days)', () => {
    // 6-year multi-year ticket (like Party To Play)
    expect(isDisqualifiedTournament('99999', '2023-12-31', '2029-12-31')).toBe(true);
    // 200 days duration
    const start = new Date('2026-01-01');
    const end = new Date('2026-08-01');
    expect(isDisqualifiedTournament('99999', start, end)).toBe(true);
  });

  it('allows legitimate professional tournaments with normal durations and IDs', () => {
    // DreamLeague (approx 20 days)
    expect(isDisqualifiedTournament('20511', '2026-11-15', '2026-12-04')).toBe(false);
    // BLAST Slam (approx 15 days)
    expect(isDisqualifiedTournament('20208', '2026-11-20', '2026-12-05')).toBe(false);
    // 1win Essence III (approx 17 days)
    expect(isDisqualifiedTournament('20486', '2026-11-10', '2026-11-27')).toBe(false);
  });
});

