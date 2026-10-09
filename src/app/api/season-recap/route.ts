import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';


type FantasySeasonRow = {
  id: number;
  season_id: number;
  total_points: number | null;
  global_rank: number | null;
};

type SeasonRow = {
  id: number;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type GameweekRow = {
  id: number;
  season_id: number;
  gameweek_number: number;
  status: string;
};

type LineupRow = {
  fantasy_season_id: number;
  gameweek_id: number;
  total_points: number | null;
};

type StandingRow = {
  fantasy_season_id: number;
  gameweek_id: number;
  rank: number;
  league_id: number | null;
};

type PlayerScoreRow = {
  player_id: number;
  points_with_multiplier: number | null;
};

type PlayerRow = {
  id: number;
  name: string | null;
  in_game_name: string | null;
};

type LeagueStandingRow = {
  fantasy_season_id: number;
  rank: number | null;
};

type TransferAuditRow = {
  record_id: number | string | null;
  new_values: {
    transfers_in?: unknown;
    transfers_out?: unknown;
  } | null;
};

function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function countTransferMoves(value: unknown): number {
  return Array.isArray(value)
    ? value.filter((playerId) => Number.isInteger(playerId) && Number(playerId) > 0).length
    : 0;
}

async function getHandler(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);
    const supabase = supabaseServer();

    // These tables are not represented in the generated Supabase table types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: fantasySeasonData, error: fantasySeasonError } = await db
      .from('fantasy_seasons')
      .select('id, season_id, total_points, global_rank')
      .eq('user_id', userId);
    if (fantasySeasonError) {
      throw new Error(`Failed to fetch your season records: ${fantasySeasonError.message}`);
    }

    const fantasySeasons = (fantasySeasonData ?? []) as FantasySeasonRow[];
    if (fantasySeasons.length === 0) return NextResponse.json({ recaps: [] });
    const fantasySeasonIds = fantasySeasons.map((season) => season.id);
    const seasonIds = [...new Set(fantasySeasons.map((season) => season.season_id))];

    const [
      seasonsResult,
      gameweeksResult,
      lineupsResult,
      standingsResult,
      leagueStandingsResult,
    ] = await Promise.all([
      db.from('seasons')
        .select('id, name, status, start_date, end_date')
        .in('id', seasonIds),
      db.from('gameweeks')
        .select('id, season_id, gameweek_number, status')
        .in('season_id', seasonIds)
        .order('gameweek_number', { ascending: true }),
      db.from('fantasy_lineups')
        .select('fantasy_season_id, gameweek_id, total_points')
        .in('fantasy_season_id', fantasySeasonIds),
      db.from('season_standings')
        .select('fantasy_season_id, gameweek_id, rank, league_id')
        .in('fantasy_season_id', fantasySeasonIds)
        .is('league_id', null),
      db.from('league_participants')
        .select('fantasy_season_id, rank')
        .in('fantasy_season_id', fantasySeasonIds)
        .not('rank', 'is', null)
        .order('rank', { ascending: true })
        .limit(100),
    ]);

    for (const [label, result] of [
      ['seasons', seasonsResult],
      ['gameweeks', gameweeksResult],
      ['lineups', lineupsResult],
      ['standings', standingsResult],
      ['league standings', leagueStandingsResult],
    ] as const) {
      if (result.error) throw new Error(`Failed to fetch season ${label}: ${result.error.message}`);
    }

    const seasons = (seasonsResult.data ?? []) as SeasonRow[];
    const gameweeks = (gameweeksResult.data ?? []) as GameweekRow[];
    const lineups = (lineupsResult.data ?? []) as LineupRow[];
    const standings = (standingsResult.data ?? []) as StandingRow[];
    const leagueStandings = (leagueStandingsResult.data ?? []) as LeagueStandingRow[];
    const gameweekById = new Map(gameweeks.map((gameweek) => [gameweek.id, gameweek]));
    const finishedSeasonIds = new Set(
      seasons.filter((season) => {
        const seasonGameweeks = gameweeks.filter((gameweek) => gameweek.season_id === season.id);
        const allGameweeksClosed = seasonGameweeks.length > 0
          && seasonGameweeks.every((gameweek) => gameweek.status === 'closed' || gameweek.status === 'locked');
        return season.status === 'ended' || season.status === 'archived' || allGameweeksClosed;
      }).map((season) => season.id),
    );
    const finishedFantasySeasons = fantasySeasons.filter((fantasySeason) =>
      finishedSeasonIds.has(fantasySeason.season_id));
    if (finishedFantasySeasons.length === 0) return NextResponse.json({ recaps: [] });

    const finishedFantasySeasonIds = finishedFantasySeasons.map((season) => season.id);
    const finishedGameweekIds = gameweeks
      .filter((gameweek) => finishedSeasonIds.has(gameweek.season_id))
      .map((gameweek) => gameweek.id);

    const transferAuditRows: TransferAuditRow[] = [];
    const transferPageSize = 1000;
    for (let offset = 0; ; offset += transferPageSize) {
      const { data, error } = await db.from('audit_log')
        .select('record_id, new_values')
        .eq('changed_by', userId)
        .eq('action', 'TRANSFER')
        .eq('table_name', 'squad_players')
        .in('record_id', finishedFantasySeasonIds)
        .order('created_at', { ascending: true })
        .range(offset, offset + transferPageSize - 1);
      if (error) throw new Error(`Failed to fetch season transfer history: ${error.message}`);
      const page = (data ?? []) as TransferAuditRow[];
      transferAuditRows.push(...page);
      if (page.length < transferPageSize) break;
    }

    const scoreRows: PlayerScoreRow[] = [];
    if (finishedGameweekIds.length > 0) {
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await db.from('gameweek_scores')
          .select('fantasy_season_id, gameweek_id, player_id, points_with_multiplier')
          .in('fantasy_season_id', finishedFantasySeasonIds)
          .in('gameweek_id', finishedGameweekIds)
          .order('gameweek_id', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw new Error(`Failed to fetch season player scores: ${error.message}`);
        const page = (data ?? []) as Array<PlayerScoreRow & {
          fantasy_season_id: number;
          gameweek_id: number;
        }>;
        scoreRows.push(...page);
        if (page.length < pageSize) break;
      }
    }

    const scoreBySeasonAndPlayer = new Map<string, number>();
    for (const score of scoreRows as Array<PlayerScoreRow & { fantasy_season_id: number }>) {
      const key = `${score.fantasy_season_id}:${score.player_id}`;
      scoreBySeasonAndPlayer.set(
        key,
        (scoreBySeasonAndPlayer.get(key) ?? 0) + Number(score.points_with_multiplier ?? 0),
      );
    }
    const playerIds = [...new Set(scoreRows.map((score) => score.player_id))];
    const playersResult = playerIds.length
      ? await db.from('professional_players').select('id, name, in_game_name').in('id', playerIds)
      : { data: [], error: null };
    if (playersResult.error) {
      throw new Error(`Failed to fetch top-scoring players: ${playersResult.error.message}`);
    }
    const playersById = new Map<number, PlayerRow>(
      ((playersResult.data ?? []) as PlayerRow[]).map((player) => [player.id, player]),
    );

    const transferCounts = new Map<number, number>();
    for (const transfer of transferAuditRows) {
      const fantasySeasonId = Number(transfer.record_id);
      if (!finishedFantasySeasonIds.includes(fantasySeasonId)) continue;
      const moves = Math.max(
        countTransferMoves(transfer.new_values?.transfers_in),
        countTransferMoves(transfer.new_values?.transfers_out),
      );
      transferCounts.set(fantasySeasonId, (transferCounts.get(fantasySeasonId) ?? 0) + moves);
    }

    const recaps = finishedFantasySeasons.map((fantasySeason) => {
      const season = seasons.find((item) => item.id === fantasySeason.season_id);
      const seasonGameweeks = gameweeks
        .filter((gameweek) => gameweek.season_id === fantasySeason.season_id)
        .sort((a, b) => a.gameweek_number - b.gameweek_number);
      const closedGameweekIds = new Set(seasonGameweeks
        .filter((gameweek) => gameweek.status === 'closed' || gameweek.status === 'locked')
        .map((gameweek) => gameweek.id));
      const userLineups = lineups
        .filter((lineup) => lineup.fantasy_season_id === fantasySeason.id && closedGameweekIds.has(lineup.gameweek_id))
        .map((lineup) => ({
          gameweek: gameweekById.get(lineup.gameweek_id)?.gameweek_number ?? 0,
          points: Number(lineup.total_points ?? 0),
        }))
        .sort((a, b) => a.gameweek - b.gameweek);
      const userStandings = standings
        .filter((standing) => standing.fantasy_season_id === fantasySeason.id
          && standing.league_id == null
          && closedGameweekIds.has(standing.gameweek_id))
        .map((standing) => ({
          gameweek: gameweekById.get(standing.gameweek_id)?.gameweek_number ?? 0,
          rank: standing.rank,
        }))
        .sort((a, b) => a.gameweek - b.gameweek);
      const topScorer = [...scoreBySeasonAndPlayer.entries()]
        .filter(([key]) => key.startsWith(`${fantasySeason.id}:`))
        .sort((a, b) => b[1] - a[1])[0];
      const bestGameweek = [...userLineups].sort((a, b) => b.points - a.points)[0] ?? null;
      const userLeagueRanks = leagueStandings
        .filter((standing) => standing.fantasy_season_id === fantasySeason.id)
        .map((standing) => standing.rank)
        .filter((rank): rank is number => rank != null && rank > 0);
      const bestLeagueRank = userLeagueRanks.length ? Math.min(...userLeagueRanks) : null;
      const [, topPlayerIdString] = topScorer?.[0].split(':') ?? [];
      const topPlayerPoints = topScorer?.[1] ?? 0;
      const topPlayerId = Number(topPlayerIdString);
      const topPlayer = Number.isInteger(topPlayerId) ? playersById.get(topPlayerId) : null;

      return {
        seasonId: fantasySeason.season_id,
        fantasySeasonId: fantasySeason.id,
        seasonName: season?.name ?? 'Fantasy season',
        startDate: season?.start_date ?? null,
        endDate: season?.end_date ?? null,
        totalPoints: Number(fantasySeason.total_points ?? 0),
        finalGlobalRank: fantasySeason.global_rank,
        bestGameweek,
        rankProgression: userStandings.length > 1
          ? {
              startingRank: userStandings[0].rank,
              finalRank: userStandings[userStandings.length - 1].rank,
            }
          : null,
        topPlayer: topPlayer
          ? {
              name: topPlayer.in_game_name || topPlayer.name || 'Player',
              points: Number(Number(topPlayerPoints).toFixed(1)),
            }
          : null,
        transferCount: transferCounts.get(fantasySeason.id) ?? 0,
        bestLeagueRank,
      };
    }).sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''));

    return NextResponse.json({ recaps });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: number }).status)
      : 500;
    const message = error instanceof Error ? error.message : 'Unable to load season recap.';
    return errorResponse(message, Number.isInteger(status) ? status : 500);
  }
}

export const GET = withApiTelemetry('GET', '/api/season-recap', getHandler);
