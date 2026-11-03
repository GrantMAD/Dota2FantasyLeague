export interface GameweekWindow {
  id: number;
  gameweek_number: number;
  start_date: string;
  end_date: string;
}

export type GameweekMatchResolution =
  | { status: 'matched'; gameweek: GameweekWindow }
  | { status: 'outside' }
  | { status: 'ambiguous' }
  | { status: 'invalid-time' };

export interface OutOfGameweekMatchDiagnostic {
  id: string;
  status: string;
  scheduledAt: Date;
}

export interface OutOfGameweekDiagnostics {
  pastCount: number;
  futureCount: number;
  futureExamples: Array<{
    matchId: string;
    tournamentName: string;
    status: string;
    scheduledAt: string;
  }>;
}

export function summarizeOutOfGameweekMatches(
  matches: OutOfGameweekMatchDiagnostic[],
  gameweeks: GameweekWindow[],
  tournamentName: string,
  now: Date,
  exampleLimit = 5,
): OutOfGameweekDiagnostics {
  const diagnostics: OutOfGameweekDiagnostics = {
    pastCount: 0,
    futureCount: 0,
    futureExamples: [],
  };
  const nowTimestamp = now.getTime();

  for (const match of matches) {
    if (resolveGameweekForMatch(match.scheduledAt, gameweeks).status !== 'outside') continue;

    const scheduledTimestamp = match.scheduledAt.getTime();
    if (scheduledTimestamp <= nowTimestamp) {
      diagnostics.pastCount++;
      continue;
    }

    diagnostics.futureCount++;
    if (diagnostics.futureExamples.length < exampleLimit) {
      diagnostics.futureExamples.push({
        matchId: match.id,
        tournamentName,
        status: match.status,
        scheduledAt: match.scheduledAt.toISOString(),
      });
    }
  }

  return diagnostics;
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
  const resolution = resolveGameweekForMatch(scheduledAt, gameweeks);
  return resolution.status === 'matched' ? resolution.gameweek : null;
}

export function resolveGameweekForMatch(
  scheduledAt: Date | string,
  gameweeks: GameweekWindow[],
): GameweekMatchResolution {
  const scheduledTimestamp = timestampAsUtc(scheduledAt);
  if (!Number.isFinite(scheduledTimestamp)) return { status: 'invalid-time' };

  const matches = gameweeks.filter((gameweek) => {
    const start = timestampAsUtc(gameweek.start_date);
    const end = timestampAsUtc(gameweek.end_date);
    return Number.isFinite(start) &&
      Number.isFinite(end) &&
      scheduledTimestamp >= start &&
      scheduledTimestamp <= end;
  });

  if (matches.length === 1) return { status: 'matched', gameweek: matches[0] };
  return matches.length === 0 ? { status: 'outside' } : { status: 'ambiguous' };
}
