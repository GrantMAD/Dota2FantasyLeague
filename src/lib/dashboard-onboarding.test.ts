import { getDashboardOnboardingSteps } from './dashboard-onboarding';

describe('getDashboardOnboardingSteps', () => {
  it('marks only milestones completed by the current dashboard data', () => {
    const steps = getDashboardOnboardingSteps({
      hasSquad: true,
      ownedPlayerCount: 6,
      hasCompleteLineup: false,
      hasLeague: true,
    });

    expect(steps.map((step) => step.complete)).toEqual([true, false, false, true]);
  });

  it('completes the full checklist when the manager has finished setup', () => {
    const steps = getDashboardOnboardingSteps({
      hasSquad: true,
      ownedPlayerCount: 8,
      hasCompleteLineup: true,
      hasLeague: true,
    });

    expect(steps.every((step) => step.complete)).toBe(true);
  });
});
