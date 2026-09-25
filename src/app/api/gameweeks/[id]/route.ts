import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getRoleByHeroName } from '@/lib/constants/dota-heroes';

interface RouteContext {
  params: Promise<{ id: string }>;
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
    const { data: gameweek, error: gwError } = await (supabase
      .from('gameweeks') as any)
      .select('*')
      .eq('id', gameweekId)
      .maybeSingle();

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
    const { data: rawMatches } = await (supabase
      .from('matches') as any)
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

    // Fetch double/blank team flags for this gameweek
    const { data: flags } = await (supabase
      .from('gameweek_team_flags') as any)
      .select(`
        id,
        flag,
        team_id,
        professional_teams(id, name, tag, logo_url)
      `)
      .eq('gameweek_id', gameweekId);

    // Fetch teams and tournament series for these matches
    const teamIds = [...new Set((rawMatches ?? []).flatMap((m: any) => [m.team_a_id, m.team_b_id]).filter(Boolean))];
    const seriesIds = [...new Set((rawMatches ?? []).map((m: any) => m.series_id).filter(Boolean))];

    const [{ data: teamsData }, { data: seriesRows }] = await Promise.all([
      teamIds.length > 0
        ? (supabase.from('professional_teams') as any).select('id, name, logo_url, region').in('id', teamIds)
        : Promise.resolve({ data: [] }),
      seriesIds.length > 0
        ? (supabase.from('tournament_series') as any).select('id, tournaments(id, name, slug)').in('id', seriesIds)
        : Promise.resolve({ data: [] }),
    ]);

    const teamById = new Map<number, any>(
      (teamsData ?? []).map((t: any) => [
        t.id,
        {
          id: t.id,
          name: t.name,
          tag: t.name ? t.name.slice(0, 4).toUpperCase() : 'TEAM',
          logo_url: t.logo_url || null,
          region: t.region || null,
        },
      ])
    );

    const tournaments: Array<{ id: number; name: string; slug?: string | null }> = [];
    const seenT = new Set<number>();
    for (const s of seriesRows ?? []) {
      if (s.tournaments && !seenT.has(s.tournaments.id)) {
        seenT.add(s.tournaments.id);
        tournaments.push(s.tournaments);
      }
    }

    const matches = (rawMatches ?? []).map((m: any) => {
      const radiantTeam = teamById.get(m.team_a_id) || null;
      const direTeam = teamById.get(m.team_b_id) || null;
      return {
        id: m.id,
        status: m.status,
        scheduled_at: m.scheduled_time,
        radiant_team_id: m.team_a_id,
        dire_team_id: m.team_b_id,
        winner_team_id: m.winner_team_id,
        duration_seconds: m.duration_minutes ? m.duration_minutes * 60 : null,
        radiant_score: null,
        dire_score: null,
        radiant_team: radiantTeam,
        professional_teams: radiantTeam,
        dire_team: direTeam,
      };
    });

    // Fetch player performances for this gameweek to calculate top scorers
    const { data: scoreRows } = await (supabase.from('player_performances') as any)
      .select(`
        player_id,
        professional_players!player_performances_player_id_fkey (id, name, in_game_name, primary_role, profile_image_url),
        fantasy_points_breakdown (total_points)
      `)
      .eq('gameweek_id', gameweekId)
      .not('fantasy_points_breakdown', 'is', null);

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
      const pts = Number(row.fantasy_points_breakdown?.total_points ?? 0);
      const player = row.professional_players;
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
          const { data: seasonRows } = await (supabase.from('fantasy_seasons') as any)
            .select('id')
            .eq('user_id', auth.userId)
            .limit(10);
          const seasonIds = (seasonRows ?? []).map((s: any) => s.id);
          if (seasonIds.length) {
            const { data: lineupRows } = await (supabase.from('fantasy_lineups') as any)
              .select('total_points')
              .in('fantasy_season_id', seasonIds)
              .eq('gameweek_id', gameweekId);
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
  } catch (error: unknown) {
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

    const { data, error } = await (supabase.from('gameweeks') as any)
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
  } catch (error: unknown) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
