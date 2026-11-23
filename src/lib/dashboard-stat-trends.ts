import type { SupabaseClient } from '@supabase/supabase-js';

interface StandingTrendRow {
  gameweek_id: number;
  gameweek_points: number | null;
  rank: number | null;
}

export interface DashboardStatTrends {
  gameweekPointsDelta: number | null;
  gameweekRankMovement: number | null;
  status: 'ready' | 'insufficient-history' | 'unavailable';
}

const EMPTY_TRENDS: DashboardStatTrends = {
  gameweekPointsDelta: null,
  gameweekRankMovement: null,
  status: 'insufficient-history',
};

function finiteNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function calculateDashboardStatTrends(
  rows: readonly StandingTrendRow[],
  gameweekIds: readonly number[],
): DashboardStatTrends {
  const latestGameweekId = gameweekIds[0];
  const previousGameweekId = gameweekIds[1];
  if (latestGameweekId === undefined || previousGameweekId === undefined) return EMPTY_TRENDS;

  const latest = rows.find((row) => row.gameweek_id === latestGameweekId);
  const previous = rows.find((row) => row.gameweek_id === previousGameweekId);
  if (!latest || !previous) return EMPTY_TRENDS;

  const latestPoints = finiteNumber(latest.gameweek_points);
  const previousPoints = finiteNumber(previous.gameweek_points);
  const latestRank = finiteNumber(latest.rank);
  const previousRank = finiteNumber(previous.rank);

  return {
    gameweekPointsDelta: latestPoints !== null && previousPoints !== null
      ? Number((latestPoints - previousPoints).toFixed(2))
      : null,
    gameweekRankMovement: latestRank !== null && previousRank !== null
      ? previousRank - latestRank
      : null,
    status: 'ready',
  };
}

export async function fetchDashboardStatTrends(
  supabase: SupabaseClient,
  fantasySeasonId: number,
  seasonId: number,
): Promise<DashboardStatTrends> {
  const { data: gameweeks, error: gameweeksError } = await supabase
    .from('gameweeks')
    .select('id')
    .eq('season_id', seasonId)
    .in('status', ['closed', 'locked'])
    .order('gameweek_number', { ascending: false })
    .limit(2)
    .returns<Array<{ id: number }>>();

  if (gameweeksError) {
    console.warn('Unable to fetch dashboard trend gameweeks:', gameweeksError.message);
    return { ...EMPTY_TRENDS, status: 'unavailable' };
  }

  const gameweekIds = (gameweeks ?? []).map((gameweek) => gameweek.id);
  if (gameweekIds.length < 2) return EMPTY_TRENDS;

  const { data: standings, error: standingsError } = await supabase
    .from('season_standings')
    .select('gameweek_id, gameweek_points, rank')
    .eq('fantasy_season_id', fantasySeasonId)
    .in('gameweek_id', gameweekIds)
    .returns<StandingTrendRow[]>();

  if (standingsError) {
    console.warn('Unable to fetch dashboard trend standings:', standingsError.message);
    return { ...EMPTY_TRENDS, status: 'unavailable' };
  }

  return calculateDashboardStatTrends(standings ?? [], gameweekIds);
}

export function formatGameweekPointsDelta(
  delta: number | null,
  status: DashboardStatTrends['status'],
): string {
  if (status === 'unavailable') return 'Trend unavailable';
  if (delta === null) return 'Not enough gameweek history';
  if (Math.abs(delta) < 0.05) return 'GW points unchanged vs prior';
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} GW pts vs prior`;
}

export function formatGameweekRankMovement(
  movement: number | null,
  status: DashboardStatTrends['status'],
): string {
  if (status === 'unavailable') return 'Trend unavailable';
  if (movement === null) return 'No rank history';
  if (movement === 0) return 'No change vs prior GW';
  const places = Math.abs(movement);
  return `${places} ${places === 1 ? 'place' : 'places'} ${movement > 0 ? 'up' : 'down'} vs prior GW`;
}
