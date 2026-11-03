export interface TrackedSquadPlayer {
  id: number;
  name: string;
  teamId: number | null;
}

export interface MatchSquadPlayer {
  id: number;
  name: string;
  confirmedAppearance: boolean;
}

export function getSquadPlayersForMatch(
  radiantTeamId: number,
  direTeamId: number,
  matchPlayerIds: number[],
  squadPlayers: TrackedSquadPlayer[],
): MatchSquadPlayer[] {
  if (matchPlayerIds.length > 0) {
    const matchPlayerIdSet = new Set(matchPlayerIds);
    return squadPlayers
      .filter((player) => matchPlayerIdSet.has(player.id))
      .map((player) => ({ id: player.id, name: player.name, confirmedAppearance: true }));
  }

  return squadPlayers
    .filter((player) => player.teamId === radiantTeamId || player.teamId === direTeamId)
    .map((player) => ({ id: player.id, name: player.name, confirmedAppearance: false }));
}
