export interface TournamentBatch<T> {
  tournaments: T[];
  hasMore: boolean;
  lastProcessedTournamentId: number | null;
}

export function selectNextTournamentBatch<T extends { id: number }>(
  tournaments: T[],
  limit: number,
  lastProcessedTournamentId: number | null,
): TournamentBatch<T> {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new RangeError('Tournament batch limit must be a positive safe integer.');
  }

  const sortedTournaments = [...tournaments].sort((left, right) => left.id - right.id);
  if (sortedTournaments.length === 0) {
    return { tournaments: [], hasMore: false, lastProcessedTournamentId: null };
  }

  const nextIndex = lastProcessedTournamentId === null
    ? 0
    : sortedTournaments.findIndex((tournament) => tournament.id > lastProcessedTournamentId);
  const startIndex = nextIndex < 0 ? 0 : nextIndex;
  const batchLength = Math.min(limit, sortedTournaments.length);
  const batch = Array.from({ length: batchLength }, (_, index) => (
    sortedTournaments[(startIndex + index) % sortedTournaments.length]
  ));

  return {
    tournaments: batch,
    hasMore: sortedTournaments.length > batchLength,
    lastProcessedTournamentId: batch[batch.length - 1].id,
  };
}

export function findLastProcessedTournamentId(
  rows: Array<{ metadata: unknown }>,
): number | null {
  for (const row of rows) {
    if (!isRecord(row.metadata)) continue;

    const directId = readTournamentId(row.metadata.lastProcessedTournamentId);
    if (directId !== null) return directId;

    if (isRecord(row.metadata.result)) {
      const resultId = readTournamentId(row.metadata.result.lastProcessedTournamentId);
      if (resultId !== null) return resultId;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTournamentId(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}
