import { supabaseServer } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/response-cache';
import type { GameweekRow } from '@/types/fantasy';

type GameweeksResponse = { gameweeks: GameweekRow[] };

export async function getInitialGameweeks(): Promise<GameweeksResponse> {
  const cacheKey = 'gameweeks:v2:';
  const cached = getCached<GameweeksResponse>(cacheKey);
  if (cached) return cached;

  const supabase = supabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('gameweeks') as any)
    .select('id, season_id, gameweek_number, start_date, end_date, deadline, status, created_at')
    .order('gameweek_number', { ascending: true });
  if (error) throw new Error(`Failed to fetch gameweeks: ${error.message}`);

  const gameweeks = data ?? [];
  if (!gameweeks.length) {
    const emptyResponse = { gameweeks: [] };
    setCached(cacheKey, emptyResponse, 60_000);
    return emptyResponse;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gameweekIds = gameweeks.map((gameweek: any) => gameweek.id);
  const [
    { data: matchRows, error: matchError },
    { data: flagRows, error: flagError },
    { data: scoreRows, error: scoresError },
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('matches') as any).select('gameweek_id, series_id, status').in('gameweek_id', gameweekIds),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('gameweek_team_flags') as any)
      .select('gameweek_id, flag, team_id, professional_teams (id, name, slug, logo_url)')
      .in('gameweek_id', gameweekIds),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('player_performances') as any)
      .select('gameweek_id, player_id, professional_players!player_performances_player_id_fkey (id, name, in_game_name, primary_role), fantasy_points_breakdown (total_points)')
      .in('gameweek_id', gameweekIds)
      .not('fantasy_points_breakdown', 'is', null),
  ]);
  if (matchError || flagError || scoresError) {
    const error = matchError ?? flagError ?? scoresError;
    throw new Error(`Failed to load gameweek details: ${error?.message ?? 'Unknown database error.'}`);
  }

  const uniqueSeriesIds = [...new Set(
    (matchRows ?? [])
      .filter((match: { series_id?: number | null }) => match.series_id)
      .map((match: { series_id: number }) => match.series_id),
  )];
  const seriesTournamentMap = new Map<number, { id: number; name: string; slug: string | null }>();
  if (uniqueSeriesIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: seriesRows, error: seriesError } = await (supabase.from('tournament_series') as any)
      .select('id, tournament_id, tournaments(id, name, slug)')
      .in('id', uniqueSeriesIds);
    if (seriesError) throw new Error(`Failed to load gameweek tournaments: ${seriesError.message}`);
    for (const series of seriesRows ?? []) {
      const tournament = series.tournaments;
      if (tournament) {
        seriesTournamentMap.set(Number(series.id), {
          id: Number(tournament.id),
          name: tournament.name,
          slug: tournament.slug ?? null,
        });
      }
    }
  }

  const matchCountMap = new Map<number, number>();
  const liveMatchCountMap = new Map<number, number>();
  const tournamentMap = new Map<number, Array<{ id: number; name: string; slug: string | null }>>();
  const flagMap = new Map<number, GameweekRow['flags']>();
  const topScorerMap = new Map<number, NonNullable<GameweekRow['top_scorer']>>();
  for (const match of matchRows ?? []) {
    const gameweekId = Number(match.gameweek_id);
    matchCountMap.set(gameweekId, (matchCountMap.get(gameweekId) ?? 0) + 1);
    if (match.status === 'in_progress') {
      liveMatchCountMap.set(gameweekId, (liveMatchCountMap.get(gameweekId) ?? 0) + 1);
    }
    if (match.series_id) {
      const tournament = seriesTournamentMap.get(Number(match.series_id));
      if (tournament) {
        const current = tournamentMap.get(gameweekId) ?? [];
        if (!current.some((item) => item.id === tournament.id)) {
          current.push(tournament);
          tournamentMap.set(gameweekId, current);
        }
      }
    }
  }

  const perPlayerTotals = new Map<string, {
    gameweekId: number;
    playerId: number;
    points: number;
    name: string;
    role: string | null;
  }>();
  for (const row of scoreRows ?? []) {
    const gameweekId = Number(row.gameweek_id);
    const playerId = Number(row.player_id);
    const points = Number(row.fantasy_points_breakdown?.total_points ?? 0);
    const player = row.professional_players;
    const key = `${playerId}:${gameweekId}`;
    const existing = perPlayerTotals.get(key);
    if (existing) {
      existing.points = Math.round((existing.points + points) * 100) / 100;
    } else {
      const rawName = player?.in_game_name || player?.name;
      perPlayerTotals.set(key, {
        gameweekId,
        playerId,
        points,
        name: !rawName || rawName === 'Unknown' || rawName === 'Player (Unknown)' ? `Player #${playerId}` : rawName,
        role: player?.primary_role ?? null,
      });
    }
  }
  for (const player of perPlayerTotals.values()) {
    const current = topScorerMap.get(player.gameweekId);
    if (!current || player.points > Number(current.total_points ?? 0)) {
      topScorerMap.set(player.gameweekId, {
        player_id: player.playerId,
        total_points: player.points,
        name: player.name,
        in_game_name: player.name,
        primary_role: player.role,
      });
    }
  }

  for (const flag of flagRows ?? []) {
    const gameweekId = Number(flag.gameweek_id);
    const current = flagMap.get(gameweekId) ?? [];
    current.push({
      flag: flag.flag,
      team_id: Number(flag.team_id),
      professional_teams: flag.professional_teams ?? null,
    });
    flagMap.set(gameweekId, current);
  }

  const { data: globalAverages, error: averagesError } = await supabase.rpc(
    'get_global_gameweek_averages',
    { p_gameweek_ids: gameweekIds },
  );
  if (averagesError) throw new Error(`Failed to load global gameweek averages: ${averagesError.message}`);
  const globalAverageMap = new Map<number, number | null>(
    (globalAverages ?? []).map((row: { gameweek_id: number; global_average: number | string | null }) => [
      Number(row.gameweek_id),
      row.global_average === null ? null : Number(row.global_average),
    ]),
  );

  const response: GameweeksResponse = {
    gameweeks: gameweeks.map((gameweek: GameweekRow) => ({
      ...gameweek,
      match_count: matchCountMap.get(Number(gameweek.id)) ?? 0,
      live_match_count: liveMatchCountMap.get(Number(gameweek.id)) ?? 0,
      global_average: globalAverageMap.get(Number(gameweek.id)) ?? null,
      tournaments: tournamentMap.get(Number(gameweek.id)) ?? [],
      flags: flagMap.get(Number(gameweek.id)) ?? [],
      top_scorer: topScorerMap.get(Number(gameweek.id)) ?? null,
      user_score: null,
    })),
  };
  setCached(cacheKey, response, 60_000);
  return response;
}
