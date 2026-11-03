import type { DataProvider, MatchData } from '../data-providers/provider-interface';
import type { MatchStatus } from '@/types/database';

const MATCH_PAGE_SIZE = 100;
const MATCH_RECONCILIATION_WINDOW_MS = 15 * 60 * 1000;

type ExistingMatchIdentity = {
  id: number;
  team_a_id: number;
  team_b_id: number;
  scheduled_time: string;
  external_match_id?: string | null;
};

export function filterTournamentsToProviderIds<T extends { data_provider_id?: string | null }>(
  tournaments: T[],
  allowedProviderIds: Set<string>
): T[] {
  return tournaments.filter(
    (tournament) => tournament.data_provider_id != null &&
      allowedProviderIds.has(String(tournament.data_provider_id))
  );
}

export function findExistingMatchByTeamsAndTime<T extends ExistingMatchIdentity>(
  candidates: T[],
  teamAId: number,
  teamBId: number,
  scheduledAt: Date,
  excludedIds: Set<number> = new Set()
): { match: T | null; ambiguous: boolean } {
  const scheduledTime = scheduledAt.getTime();
  const matchingCandidates = candidates.filter((candidate) => {
    if (excludedIds.has(candidate.id)) return false;
    if (!candidate.external_match_id || candidate.external_match_id.startsWith('scheduled:')) return false;
    const sameTeams =
      (candidate.team_a_id === teamAId && candidate.team_b_id === teamBId) ||
      (candidate.team_a_id === teamBId && candidate.team_b_id === teamAId);
    const existingTime = new Date(candidate.scheduled_time).getTime();
    return sameTeams &&
      Number.isFinite(existingTime) &&
      Math.abs(existingTime - scheduledTime) <= MATCH_RECONCILIATION_WINDOW_MS;
  });

  if (matchingCandidates.length > 1) return { match: null, ambiguous: true };
  return { match: matchingCandidates[0] ?? null, ambiguous: false };
}

export function requireStratzMatchProvider(provider: DataProvider): void {
  if (provider.name !== 'STRATZ') {
    throw new Error(
      'Full match synchronization requires STRATZ. Set NEXT_PUBLIC_DATA_PROVIDER=stratz and configure STRATZ_API_KEY.'
    );
  }
}

export function toDatabaseMatchStatus(status: MatchData['status']): MatchStatus {
  switch (status) {
    case 'scheduled':
      return 'scheduled';
    case 'live':
      return 'in_progress';
    case 'concluded':
      return 'completed';
    default:
      throw new Error(`Unsupported provider match status: ${status}`);
  }
}

const MATCH_STATUS_ORDER: Record<MatchStatus, number> = {
  scheduled: 0,
  in_progress: 1,
  completed: 2,
  cancelled: 3,
  postponed: 3,
};

export function preserveMatchStatus(
  existingStatus: MatchStatus,
  incomingStatus: MatchStatus
): MatchStatus {
  return MATCH_STATUS_ORDER[existingStatus] > MATCH_STATUS_ORDER[incomingStatus]
    ? existingStatus
    : incomingStatus;
}

export async function fetchAllTournamentMatches(
  provider: DataProvider,
  tournamentId: string
): Promise<MatchData[]> {
  const matchesById = new Map<string, MatchData>();
  let offset = 0;

  while (true) {
    const page = await provider.fetchMatches(tournamentId, {
      limit: MATCH_PAGE_SIZE,
      offset,
    });

    for (const match of page) matchesById.set(match.id, match);
    if (page.length < MATCH_PAGE_SIZE) break;
    offset += MATCH_PAGE_SIZE;
  }

  return [...matchesById.values()];
}
