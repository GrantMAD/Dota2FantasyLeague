import type { SupabaseClient } from '@supabase/supabase-js';

interface GameweekMatchRow {
  series_id: number | null;
  status: string | null;
}

interface TournamentSeriesRow {
  id: number;
  tournament_id: number;
  best_of: number | null;
}

interface GameweekTournamentRow {
  id: number;
  name: string;
  tier: string | null;
  start_date: string;
}

export interface GameweekTournament {
  id: number;
  name: string;
  tier: string | null;
  start_date: string;
  seriesCount: number;
  matchCount: number;
  bestOfFormats: number[];
}

export async function fetchGameweekTournaments(
  supabase: SupabaseClient,
  seasonId: number,
  gameweekId: number,
): Promise<{ matches: GameweekMatchRow[]; tournaments: GameweekTournament[] }> {
  const { data: matchRows, error: matchesError } = await supabase
    .from('matches')
    .select('series_id, status')
    .eq('gameweek_id', gameweekId);

  if (matchesError) {
    throw new Error(`Failed to fetch matches for gameweek ${gameweekId}: ${matchesError.message}`);
  }

  const matches = (matchRows ?? []) as GameweekMatchRow[];
  const seriesIds = [...new Set(matches
    .map((match) => match.series_id)
    .filter((seriesId): seriesId is number => seriesId !== null))];
  if (seriesIds.length === 0) return { matches, tournaments: [] };

  const { data: seriesRows, error: seriesError } = await supabase
    .from('tournament_series')
    .select('id, tournament_id, best_of')
    .in('id', seriesIds);
  if (seriesError) {
    throw new Error(`Failed to fetch tournament series for gameweek ${gameweekId}: ${seriesError.message}`);
  }

  const series = (seriesRows ?? []) as TournamentSeriesRow[];
  const tournamentIds = [...new Set(series.map((row) => row.tournament_id))];
  if (tournamentIds.length === 0) return { matches, tournaments: [] };

  const { data: tournamentRows, error: tournamentsError } = await supabase
    .from('tournaments')
    .select('id, name, tier, start_date')
    .eq('season_id', seasonId)
    .eq('eligible', true)
    .neq('status', 'archived')
    .in('id', tournamentIds)
    .order('start_date', { ascending: false });
  if (tournamentsError) {
    throw new Error(`Failed to fetch tournaments for gameweek ${gameweekId}: ${tournamentsError.message}`);
  }

  const tournaments = (tournamentRows ?? []) as GameweekTournamentRow[];
  return {
    matches,
    tournaments: mapGameweekTournaments(matches, series, tournaments),
  };
}

export function mapGameweekTournaments(
  matches: GameweekMatchRow[],
  series: TournamentSeriesRow[],
  tournaments: GameweekTournamentRow[],
): GameweekTournament[] {
  const seriesById = new Map(series.map((row) => [row.id, row]));
  const tournamentStats = new Map<number, { seriesIds: Set<number>; matchCount: number }>();

  for (const match of matches) {
    if (match.series_id === null) continue;
    const seriesRow = seriesById.get(match.series_id);
    if (!seriesRow) continue;
    const stats = tournamentStats.get(seriesRow.tournament_id) ?? {
      seriesIds: new Set<number>(),
      matchCount: 0,
    };
    stats.seriesIds.add(seriesRow.id);
    stats.matchCount++;
    tournamentStats.set(seriesRow.tournament_id, stats);
  }

  const formatsByTournament = new Map<number, Set<number>>();
  for (const seriesRow of series) {
    if (seriesRow.best_of === null || seriesRow.best_of <= 0) continue;
    const formats = formatsByTournament.get(seriesRow.tournament_id) ?? new Set<number>();
    formats.add(seriesRow.best_of);
    formatsByTournament.set(seriesRow.tournament_id, formats);
  }

  return tournaments.flatMap((tournament) => {
    const stats = tournamentStats.get(tournament.id);
    if (!stats || stats.matchCount === 0) return [];
    return [{
      ...tournament,
      seriesCount: stats.seriesIds.size,
      matchCount: stats.matchCount,
      bestOfFormats: [...(formatsByTournament.get(tournament.id) ?? [])]
        .sort((left, right) => left - right),
    }];
  });
}
