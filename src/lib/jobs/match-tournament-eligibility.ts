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

function timestampAsUtc(value: string): number {
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
  return Date.parse(normalized);
}
