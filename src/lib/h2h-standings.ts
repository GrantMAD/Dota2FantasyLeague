export interface H2HParticipant {
  id: number;
}

export interface H2HMatchupResult {
  participant_a_id: number;
  participant_b_id: number;
  points_a: number | null;
  points_b: number | null;
  is_bye: boolean;
  is_resolved: boolean;
}

export interface H2HStanding {
  participantId: number;
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  leaguePoints: number;
  pointsFor: number;
  pointsAgainst: number;
  scoreDifference: number;
}

interface StandingTotals extends H2HStanding {
  pointsForCents: number;
  pointsAgainstCents: number;
}

function toCents(value: number | null): number {
  const points = Number(value ?? 0);
  return Number.isFinite(points) ? Math.round(points * 100) : 0;
}

function sameTieBreakers(a: StandingTotals, b: StandingTotals): boolean {
  return a.leaguePoints === b.leaguePoints
    && a.pointsForCents - a.pointsAgainstCents === b.pointsForCents - b.pointsAgainstCents
    && a.pointsForCents === b.pointsForCents;
}

export function calculateH2HStandings(
  participants: H2HParticipant[],
  matchups: H2HMatchupResult[],
): H2HStanding[] {
  const totals = new Map<number, StandingTotals>();
  for (const participant of participants) {
    totals.set(participant.id, {
      participantId: participant.id,
      rank: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      leaguePoints: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      scoreDifference: 0,
      pointsForCents: 0,
      pointsAgainstCents: 0,
    });
  }

  for (const matchup of matchups) {
    if (!matchup.is_resolved) continue;
    const participantA = totals.get(matchup.participant_a_id);
    if (!participantA) continue;

    if (matchup.is_bye) {
      // Byes award a win but do not add fantasy points to tie-break totals.
      participantA.wins += 1;
      continue;
    }

    const participantB = totals.get(matchup.participant_b_id);
    if (!participantB) continue;

    const pointsA = toCents(matchup.points_a);
    const pointsB = toCents(matchup.points_b);
    participantA.pointsForCents += pointsA;
    participantA.pointsAgainstCents += pointsB;
    participantB.pointsForCents += pointsB;
    participantB.pointsAgainstCents += pointsA;

    if (pointsA > pointsB) {
      participantA.wins += 1;
      participantB.losses += 1;
    } else if (pointsB > pointsA) {
      participantB.wins += 1;
      participantA.losses += 1;
    } else {
      participantA.draws += 1;
      participantB.draws += 1;
    }
  }

  const sorted = [...totals.values()]
    .map((standing) => {
      standing.leaguePoints = standing.wins * 3 + standing.draws;
      standing.pointsFor = standing.pointsForCents / 100;
      standing.pointsAgainst = standing.pointsAgainstCents / 100;
      standing.scoreDifference = (standing.pointsForCents - standing.pointsAgainstCents) / 100;
      return standing;
    })
    .sort((a, b) => b.leaguePoints - a.leaguePoints
      || b.scoreDifference - a.scoreDifference
      || b.pointsFor - a.pointsFor
      || a.participantId - b.participantId);

  let rank = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const standing = sorted[index];
    const previous = sorted[index - 1];
    if (!previous || !sameTieBreakers(standing, previous)) {
      rank = index + 1;
    }
    standing.rank = rank;
  }

  return sorted.map(({
    participantId,
    rank: standingRank,
    wins,
    losses,
    draws,
    leaguePoints,
    pointsFor,
    pointsAgainst,
    scoreDifference,
  }) => ({
    participantId,
    rank: standingRank,
    wins,
    losses,
    draws,
    leaguePoints,
    pointsFor,
    pointsAgainst,
    scoreDifference,
  }));
}
