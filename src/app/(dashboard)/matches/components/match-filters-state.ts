export function getActiveMatchFilterCount({
  activeTab,
  selectedTournamentId,
  searchQuery,
}: {
  activeTab: 'all' | 'live' | 'upcoming' | 'completed';
  selectedTournamentId: string;
  searchQuery: string;
}): number {
  return Number(activeTab !== 'all')
    + Number(selectedTournamentId !== '')
    + Number(searchQuery.trim() !== '');
}
