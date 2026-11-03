import { getGameweekMatchProgress } from './gameweek-match-progress';

describe('getGameweekMatchProgress', () => {
  it('counts total matches and their statuses', () => {
    expect(getGameweekMatchProgress([
      { status: 'completed' },
      { status: 'completed' },
      { status: 'in_progress' },
      { status: 'scheduled' },
    ])).toEqual({
      total: 4,
      statuses: { completed: 2, in_progress: 1, scheduled: 1 },
    });
  });

  it('returns zero matches for an empty gameweek', () => {
    expect(getGameweekMatchProgress([])).toEqual({ total: 0, statuses: {} });
  });
});
