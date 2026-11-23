import { getMatchAutoRefreshInterval } from './match-center-refresh';

describe('getMatchAutoRefreshInterval', () => {
  it('refreshes every minute when a live match is present', () => {
    expect(getMatchAutoRefreshInterval('all', 1)).toBe(60_000);
    expect(getMatchAutoRefreshInterval('live', 3)).toBe(60_000);
  });

  it('checks less often for new live matches and skips unrelated status tabs', () => {
    expect(getMatchAutoRefreshInterval('all', 0)).toBe(5 * 60_000);
    expect(getMatchAutoRefreshInterval('upcoming', 3)).toBeNull();
    expect(getMatchAutoRefreshInterval('completed', 3)).toBeNull();
  });
});
