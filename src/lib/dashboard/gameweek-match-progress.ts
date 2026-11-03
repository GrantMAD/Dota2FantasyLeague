export interface GameweekMatchProgress {
  total: number;
  statuses: Record<string, number>;
}

export function getGameweekMatchProgress(
  matches: Array<{ status: string | null }>
): GameweekMatchProgress {
  const statuses = matches.reduce<Record<string, number>>((counts, match) => {
    const status = match.status ?? 'unknown';
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});

  return { total: matches.length, statuses };
}
