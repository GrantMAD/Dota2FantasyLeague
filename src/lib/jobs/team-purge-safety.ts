export function getTeamsSafeToDelete(
  candidateTeamIds: number[],
  recentMatchTeamIds: Set<number>,
  rosterHistoryTeamIds: Set<number>
): number[] {
  return candidateTeamIds.filter(
    (teamId) => !recentMatchTeamIds.has(teamId) && !rosterHistoryTeamIds.has(teamId)
  );
}
