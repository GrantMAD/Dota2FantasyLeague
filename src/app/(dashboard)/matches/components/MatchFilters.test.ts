import { getActiveMatchFilterCount } from './match-filters-state';

describe('getActiveMatchFilterCount', () => {
  it('counts status, tournament, and non-empty search filters', () => {
    expect(getActiveMatchFilterCount({
      activeTab: 'live',
      selectedTournamentId: '12',
      searchQuery: ' Team Spirit ',
    })).toBe(3);
  });

  it('ignores whitespace-only search and the default all-status tab', () => {
    expect(getActiveMatchFilterCount({
      activeTab: 'all',
      selectedTournamentId: '',
      searchQuery: '   ',
    })).toBe(0);
  });
});
