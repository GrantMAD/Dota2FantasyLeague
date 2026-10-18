export interface DashboardOnboardingState {
  hasSquad: boolean;
  ownedPlayerCount: number;
  hasCompleteLineup: boolean;
  hasLeague: boolean;
}

export function getDashboardOnboardingSteps(state: DashboardOnboardingState) {
  return [
    { title: 'Create your fantasy squad', href: '/squads', complete: state.hasSquad, action: 'Create squad' },
    {
      title: 'Fill your 8-player squad',
      href: '/squads',
      complete: state.ownedPlayerCount >= 8,
      action: 'Choose players',
    },
    {
      title: 'Set five starters and a captain',
      href: '/lineups',
      complete: state.hasCompleteLineup,
      action: 'Set lineup',
    },
    { title: 'Join a league', href: '/leagues', complete: state.hasLeague, action: 'Find a league' },
  ];
}
