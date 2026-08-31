export interface CaptainCandidate {
  id: number;
  name: string;
  role: string;
  available: boolean;
}

export interface CaptainAssignmentResult {
  captain: CaptainCandidate;
  viceCaptain: CaptainCandidate | null;
  captainMultiplier: number;
  viceMultiplier: number;
  note: string;
}

export function resolveCaptainAssignment(
  players: CaptainCandidate[],
  captainId: number,
  viceCaptainId: number,
): CaptainAssignmentResult {
  const captain = players.find((player) => player.id === captainId) ?? players[0];
  const viceCaptain =
    players.find((player) => player.id === viceCaptainId) ?? players.find((player) => player.id !== captainId) ?? null;

  if (!captain) {
    throw new Error('A captain must be selected before resolving lineup multipliers.');
  }

  if (captain.available) {
    return {
      captain,
      viceCaptain,
      captainMultiplier: 2,
      viceMultiplier: viceCaptain && viceCaptain.available ? 1 : 0,
      note: 'Captain is active and receives the full 2x multiplier.',
    };
  }

  if (viceCaptain && viceCaptain.available) {
    return {
      captain: viceCaptain,
      viceCaptain: captain,
      captainMultiplier: 2,
      viceMultiplier: 1,
      note: 'Captain is unavailable, so the vice captain is promoted and receives 2x.',
    };
  }

  return {
    captain,
    viceCaptain,
    captainMultiplier: 1,
    viceMultiplier: 0,
    note: 'No eligible captain replacement is available for this gameweek.',
  };
}
