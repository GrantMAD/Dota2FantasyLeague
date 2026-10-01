import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getRoleByHeroName } from '@/lib/constants/dota-heroes';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface TeamRecord {
  id: number;
  name: string;
  logo_url: string | null;
  region: string | null;
  tag?: string | null;
}

interface MatchRecord {
  id: number;
  status: string;
  scheduled_time: string;
  duration_minutes: number | null;
  series_id: number | null;
  team_a_id: number | null;
  team_b_id: number | null;
  winner_team_id: number | null;
}

interface TournamentSummary {
  id: number;
  name: string;
  slug: string;
}

interface SeriesRecord {
  id: number;
  tournaments: TournamentSummary | TournamentSummary[] | null;
}

interface TeamFlagRecord {
  id: number;
  flag: string;
  team_id: number;
  professional_teams: TeamRecord | TeamRecord[] | null;
}

interface ScoringPlayer {
  id: number;
  name: string;
  in_game_name: string | null;
  primary_role: string | null;
  profile_image_url: string | null;
}

interface ScoreRow {
  player_id: number;
  professional_players: ScoringPlayer | ScoringPlayer[] | null;
  fantasy_points_breakdown: { total_points: number | null } | { total_points: number | null }[] | null;
}

interface SeasonIdRow {
  id: number;
}

interface LineupPointsRow {
  total_points: number | null;
}

/**
 * GET /api/gameweeks/[id]
 * Returns a single gameweek with its matches and double/blank team flags.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const gameweekId = parseInt(params.id, 10);
    if (isNaN(gameweekId)) {
      return NextResponse.json({ error: 'Invalid gameweek ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Fetch gameweek
    const { data: gameweekData, error: gwError } = await supabase
      .from('gameweeks')
      .select('*')
      .eq('id', gameweekId)
      .maybeSingle();
    const gameweek = gameweekData;

    if (gwError) {
      return NextResponse.json(
        { error: 'Failed to fetch gameweek.', details: gwError.message },
        { status: 500 }
      );
    }

    if (!gameweek) {
      return NextResponse.json({ error: 'Gameweek not found.' }, { status: 404 });
    }

    // Fetch matches in this gameweek using the actual database columns (team_a_id, team_b_id, scheduled_time, duration_minutes)
    const { data: matchData } = await supabase
      .from('matches')
      .select(`
        id,
        status,
        scheduled_time,
        duration_minutes,
        series_id,
        team_a_id,
        team_b_id,
        winner_team_id
      `)
      .eq('gameweek_id', gameweekId)
      .order('scheduled_time', { ascending: true });
    const rawMatches = (matchData ?? []) as MatchRecord[];

    // Fetch double/blank team flags for this gameweek
    const { data: flagData } = await supabase
      .from('gameweek_team_flags')
      .select(`
        id,
        flag,
        team_id,
        professional_teams(id, name, tag, logo_url)
      `)
      .eq('gameweek_id', gameweekId);
    const flags = (flagData ?? []) as TeamFlagRecord[];

    // Fetch teams and tournament series for these matches
    const teamIds = [...new Set(rawMatches.flatMap((match) => [match.team_a_id, match.team_b_id]).filter((id): id is number => id !== null))];
    const seriesIds = [...new Set(rawMatches.map((match) => match.series_id).filter((id): id is number => id !== null))];

    const [{ data: teamsData }, { data: seriesRows }] = await Promise.all([
      teamIds.length > 0
        ? supabase.from('professional_teams').select('id, name, logo_url, region').in('id', teamIds)
        : Promise.resolve({ data: [] }),
      seriesIds.length > 0
        ? supabase.from('tournament_series').select('id, tournaments(id, name, slug)').in('id', seriesIds)
        : Promise.resolve({ data: [] }),
    ]);

    const teamRows = (teamsData ?? []) as TeamRecord[];
    const seriesRowsTyped = (seriesRows ?? []) as SeriesRecord[];
    const teamById = new Map<number, TeamRecord>(teamRows.map((team) => [
      team.id,
      {
        id: team.id,
        name: team.name,
        tag: team.name ? team.name.slice(0, 4).toUpperCase() : 'TEAM',
        logo_url: team.logo_url || null,
        region: team.region || null,
      },
    ]));

    const tournaments: Array<{ id: number; name: string; slug?: string | null }> = [];
    const seenT = new Set<number>();
    for (const series of seriesRowsTyped) {
      const tournament = Array.isArray(series.tournaments) ? series.tournaments[0] : series.tournaments;
      if (tournament && !seenT.has(tournament.id)) {
        seenT.add(tournament.id);
        tournaments.push(tournament);
      }
    }

    const matches = rawMatches.map((match) => {
      const radiantTeam = match.team_a_id === null ? null : teamById.get(match.team_a_id) || null;
      const direTeam = match.team_b_id === null ? null : teamById.get(match.team_b_id) || null;
      return {
        id: match.id,
        status: match.status,
        scheduled_at: match.scheduled_time,
        radiant_team_id: match.team_a_id,
        dire_team_id: match.team_b_id,
        winner_team_id: match.winner_team_id,
        duration_seconds: match.duration_minutes ? match.duration_minutes * 60 : null,
        radiant_score: null,
        dire_score: null,
        radiant_team: radiantTeam,
        professional_teams: radiantTeam,
        dire_team: direTeam,
      };
    });

    // Fetch player performances for this gameweek to calculate top scorers
    const { data: scoreData } = await supabase.from('player_performances')
      .select(`
        player_id,
        professional_players!player_performances_player_id_fkey (id, name, in_game_name, primary_role, profile_image_url),
        fantasy_points_breakdown (total_points)
      `)
      .eq('gameweek_id', gameweekId)
      .not('fantasy_points_breakdown', 'is', null);
    const scoreRows = (scoreData ?? []) as ScoreRow[];

    const playerPointsMap = new Map<number, {
      player_id: number;
      name: string;
      in_game_name: string;
      primary_role: string | null;
      profile_image_url?: string | null;
      total_points: number;
      matches_played: number;
    }>();

    for (const row of scoreRows ?? []) {
      const playerId = Number(row.player_id);
      const breakdown = Array.isArray(row.fantasy_points_breakdown)
        ? row.fantasy_points_breakdown[0]
        : row.fantasy_points_breakdown;
      const pts = Number(breakdown?.total_points ?? 0);
      const player = Array.isArray(row.professional_players) ? row.professional_players[0] : row.professional_players;
      const rawName = player?.in_game_name || player?.name;
      const displayName = (!rawName || rawName === 'Unknown' || rawName === 'Player (Unknown)')
        ? `Player #${playerId}`
        : rawName;

      // Extract hero name if placeholder pattern 'Player (Hero Name)'
      const heroMatch = displayName.match(/\((.+)\)/);
      const heroName = heroMatch ? heroMatch[1] : null;
      const heroRole = getRoleByHeroName(heroName);

      // If player has a specific role or fallback to hero inferred role or DB role
      const effectiveRole = (player?.primary_role && player.primary_role !== 'Carry')
        ? player.primary_role
        : (heroRole || player?.primary_role || 'Carry');

      const existing = playerPointsMap.get(playerId);
      if (existing) {
        existing.total_points = Math.round((existing.total_points + pts) * 100) / 100;
        existing.matches_played += 1;
      } else {
        playerPointsMap.set(playerId, {
          player_id: playerId,
          name: displayName,
          in_game_name: displayName,
          primary_role: effectiveRole,
          profile_image_url: player?.profile_image_url ?? null,
          total_points: pts,
          matches_played: 1,
        });
      }
    }

    const topScorers = Array.from(playerPointsMap.values())
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, 10);

    // Fetch user score if authenticated
    let userScore: number | null = null;
    try {
      const authHeader = request.headers.get('authorization');
      const cookieHeader = request.headers.get('cookie');
      if (authHeader || cookieHeader) {
        const { verifyAuth } = await import('@/lib/auth-utils');
        const auth = await verifyAuth(request);
        if (auth?.userId) {
          const { data: seasonData } = await supabase.from('fantasy_seasons')
            .select('id')
            .eq('user_id', auth.userId)
            .limit(10);
          const seasonIds = ((seasonData ?? []) as SeasonIdRow[]).map((season) => season.id);
          if (seasonIds.length) {
            const { data: lineupData } = await supabase.from('fantasy_lineups')
              .select('total_points')
              .in('fantasy_season_id', seasonIds)
              .eq('gameweek_id', gameweekId);
            const lineupRows = (lineupData ?? []) as LineupPointsRow[];
            if (lineupRows && lineupRows.length > 0) {
              userScore = Number(lineupRows[0].total_points ?? 0);
            }
          }
        }
      }
    } catch {
      // Unauthenticated or auth check failed - proceed with userScore = null
    }

    return NextResponse.json({
      gameweek,
      matches: matches ?? [],
      teamFlags: flags ?? [],
      tournaments,
      topScorers,
      userScore,
    });
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}

/**
 * PATCH /api/gameweeks/[id]
 * Updates mutable fields on a gameweek (status, deadline, start_date, end_date).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const gameweekId = parseInt(params.id, 10);
    if (isNaN(gameweekId)) {
      return NextResponse.json({ error: 'Invalid gameweek ID.' }, { status: 400 });
    }

    const body = await request.json();

    const VALID_STATUSES = ['upcoming', 'active', 'locked'];
    const allowed = ['status', 'deadline', 'start_date', 'end_date'];
    const update: Record<string, unknown> = {};

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        if (key === 'status' && !VALID_STATUSES.includes(body[key])) {
          return NextResponse.json(
            { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
            { status: 400 }
          );
        }
        update[key] = body[key];
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    const { data, error } = await supabase.from('gameweeks')
      .update(update)
      .eq('id', gameweekId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update gameweek.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
