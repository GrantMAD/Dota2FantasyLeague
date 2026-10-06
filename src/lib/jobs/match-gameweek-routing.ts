export interface GameweekWindow {
  id: number;
  gameweek_number: number;
  start_date: string;
  end_date: string;
}

function timestampAsUtc(value: Date | string): number {
  if (value instanceof Date) return value.getTime();

  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    ? value
    : `${value}Z`;
  return Date.parse(normalized);
}

export function findGameweekForMatch(
  scheduledAt: Date | string,
  gameweeks: GameweekWindow[],
): GameweekWindow | null {
  const scheduledTimestamp = timestampAsUtc(scheduledAt);
  if (!Number.isFinite(scheduledTimestamp)) return null;

  const matches = gameweeks.filter((gameweek) => {
    const start = timestampAsUtc(gameweek.start_date);
    const end = timestampAsUtc(gameweek.end_date);
    return Number.isFinite(start) &&
      Number.isFinite(end) &&
      scheduledTimestamp >= start &&
      scheduledTimestamp <= end;
  });

  return matches.length === 1 ? matches[0] : null;
}
