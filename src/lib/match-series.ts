export interface MatchSeriesRow {
  id: number;
  series_id?: number | null;
  gameweek_id?: number | null;
  radiant_team_id?: number | null;
  dire_team_id?: number | null;
  team_a_id?: number | null;
  team_b_id?: number | null;
  scheduled_at?: string;
  scheduled_time?: string;
  match_number?: number | null;
  series_matches?: MatchSeriesRow[];
}

export interface MatchSeriesGroup<T extends MatchSeriesRow> {
  key: string;
  match: T;
  games: T[];
}

export interface MatchSeriesScore {
  radiantWins: number;
  direWins: number;
  completedGames: number;
  clinchedTeamId: number | null;
  isComplete: boolean;
  isLive: boolean;
}

export function getEffectiveBestOf(
  games: MatchSeriesRow[],
  bestOf: number | null | undefined,
): number {
  if (typeof bestOf === 'number' && Number.isFinite(bestOf) && bestOf > 0) return bestOf;
  return games.length > 1 || games.some((game) => game.series_id != null) ? 3 : 1;
}

export function getCompletedGamesAwaitingPlayerStats<
  T extends {
    status: string;
    player_ids?: number[];
    playerStats?: unknown[];
    match_number?: number | null;
  },
>(games: T[]): T[] {
  return games.filter((game) => (
    game.status === 'completed'
    && (game.player_ids?.length ?? 0) === 0
    && (game.playerStats?.length ?? 0) === 0
  ));
}

export function getDefaultSeriesGame<T extends { match_number?: number }>(games: T[]): T | undefined {
  return games.find((game) => game.match_number === 1) ?? games[0];
}

export function getMatchSeriesKey(match: MatchSeriesRow): string {
  if (match.series_id == null) return `match:${match.id}`;

  const teamAId = match.radiant_team_id ?? match.team_a_id;
  const teamBId = match.dire_team_id ?? match.team_b_id;
  if (match.gameweek_id == null || teamAId == null || teamBId == null) {
    return `series:${match.series_id}`;
  }

  const [teamLowId, teamHighId] = [teamAId, teamBId].sort((left, right) => left - right);
  return `series:${match.series_id}:gameweek:${match.gameweek_id}:teams:${teamLowId}:${teamHighId}`;
}

export function shouldShowMatchSeries<T extends MatchSeriesRow & {
  status: string;
  player_ids?: number[];
}>(games: T[]): boolean {
  return games.some((game) => (
    game.status !== 'completed' || (game.player_ids?.length ?? 0) > 0
  ));
}

export function groupMatchesBySeries<T extends MatchSeriesRow>(matches: T[]): MatchSeriesGroup<T>[] {
  const groups = new Map<string, MatchSeriesGroup<T>>();

  for (const match of matches) {
    const key = getMatchSeriesKey(match);
    let group = groups.get(key);
    if (!group) {
      group = { key, match, games: [] };
      groups.set(key, group);
    }

    for (const game of match.series_matches?.length ? match.series_matches : [match]) {
      if (getMatchSeriesKey(game) !== key) continue;
      if (!group.games.some((existing) => existing.id === game.id)) {
        group.games.push(game as T);
      }
    }
  }

  return [...groups.values()].map((group) => ({
    ...group,
    games: group.games.sort((left, right) => (
      (left.scheduled_at ?? left.scheduled_time ?? '').localeCompare(
        right.scheduled_at ?? right.scheduled_time ?? '',
      ) || left.id - right.id
    )),
  }));
}

export function summarizeMatchSeries(
  games: Array<MatchSeriesRow & {
    status?: string;
    winner_team_id?: number | null;
    radiant_team_id?: number | null;
    dire_team_id?: number | null;
  }>,
  bestOf: number | null | undefined = 3,
  referenceRadiantTeamId?: number | null,
  referenceDireTeamId?: number | null,
): MatchSeriesScore {
  const firstGame = games[0];
  const refRadiantId = referenceRadiantTeamId !== undefined
    ? referenceRadiantTeamId
    : (firstGame?.radiant_team_id ?? null);
  const refDireId = referenceDireTeamId !== undefined
    ? referenceDireTeamId
    : (firstGame?.dire_team_id ?? null);

  const completed = games.filter((game) => game.status === 'completed');
  const radiantWins = refRadiantId == null
    ? 0
    : completed.filter((game) => game.winner_team_id === refRadiantId).length;
  const direWins = refDireId == null
    ? 0
    : completed.filter((game) => game.winner_team_id === refDireId).length;
  const effectiveBestOf = getEffectiveBestOf(games, bestOf);
  const clinchThreshold = effectiveBestOf <= 1 ? 1 : Math.floor(effectiveBestOf / 2) + 1;
  const clinchedTeamId = radiantWins >= clinchThreshold
    ? refRadiantId
    : direWins >= clinchThreshold
      ? refDireId
      : null;

  return {
    radiantWins,
    direWins,
    completedGames: completed.length,
    clinchedTeamId,
    isComplete: clinchedTeamId !== null
      || (games.length >= effectiveBestOf && completed.length === games.length),
    isLive: games.some((game) => game.status === 'live' || game.status === 'in_progress'),
  };
}
