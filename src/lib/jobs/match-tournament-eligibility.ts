import type { Tournament } from '@/types/database';
import type { GameweekWindow } from './match-gameweek-routing';

export function overlapsConfiguredGameweek(
  tournament: Pick<Tournament, 'start_date' | 'end_date'>,
  gameweeks: GameweekWindow[],
): boolean {
  const tournamentStart = timestampAsUtc(tournament.start_date);
  const tournamentEnd = timestampAsUtc(tournament.end_date);

  if (!Number.isFinite(tournamentStart) || !Number.isFinite(tournamentEnd) || tournamentEnd < tournamentStart) {
    return true;
  }

  return gameweeks.some((gameweek) => {
    const gameweekStart = timestampAsUtc(gameweek.start_date);
    const gameweekEnd = timestampAsUtc(gameweek.end_date);

    if (!Number.isFinite(gameweekStart) || !Number.isFinite(gameweekEnd) || gameweekEnd < gameweekStart) {
      return true;
    }

    return tournamentStart <= gameweekEnd && tournamentEnd >= gameweekStart;
  });
}

/** Known amateur/community inhouse league tickets that upstream providers miscategorize as professional */
export const DISQUALIFIED_LEAGUE_IDS = new Set(['16251', '17508']);

/** Maximum allowable tournament duration in days. Standard esports events run 3 to 45 days; tickets >180 days are multi-year amateur community ladders. */
export const MAX_VALID_TOURNAMENT_DURATION_DAYS = 180;

/**
 * Checks whether a tournament is a disqualified amateur ticket or multi-year community league.
 */
export function isDisqualifiedTournament(
  providerId: string | number | null | undefined,
  startDate?: Date | string | null,
  endDate?: Date | string | null,
): boolean {
  if (providerId !== null && providerId !== undefined && DISQUALIFIED_LEAGUE_IDS.has(String(providerId).trim())) {
    return true;
  }
  if (startDate && endDate) {
    const start = timestampAsUtc(startDate instanceof Date ? startDate.toISOString() : startDate);
    const end = timestampAsUtc(endDate instanceof Date ? endDate.toISOString() : endDate);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const durationDays = (end - start) / (24 * 60 * 60 * 1000);
      if (durationDays > MAX_VALID_TOURNAMENT_DURATION_DAYS) {
        return true;
      }
    }
  }
  return false;
}

function timestampAsUtc(value: string): number {

  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
  return Date.parse(normalized);
}
