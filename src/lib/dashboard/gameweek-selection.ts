export interface DashboardGameweekCandidate {
  status: string;
}

export function selectDashboardGameweek<T extends DashboardGameweekCandidate>(
  candidates: T[],
  previousClosedGameweek: T | null,
): T | null {
  return candidates.find((gameweek) => gameweek.status === 'active')
    ?? candidates.find((gameweek) => gameweek.status === 'upcoming')
    ?? previousClosedGameweek;
}
