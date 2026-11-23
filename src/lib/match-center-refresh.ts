export type MatchStatusFilter = 'all' | 'live' | 'upcoming' | 'completed';

export function getMatchAutoRefreshInterval(
  activeTab: MatchStatusFilter,
  liveMatchCount: number,
): number | null {
  if (activeTab !== 'all' && activeTab !== 'live') return null;
  return liveMatchCount > 0 ? 60_000 : 5 * 60_000;
}
