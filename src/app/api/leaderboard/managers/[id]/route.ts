import { NextRequest, NextResponse } from 'next/server';
import { applyRefreshedTokens, AuthError, verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatCountry(countryCode: string | null | undefined): string | null {
  if (!countryCode) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode.toUpperCase()) ?? countryCode;
  } catch {
    return countryCode;
  }
}

async function getHandler(request: NextRequest, context: RouteContext) {
  try {
    const auth = await verifyAuth(request);
    const { id } = await context.params;
    const fantasySeasonId = Number.parseInt(id, 10);
    if (!Number.isSafeInteger(fantasySeasonId) || fantasySeasonId <= 0) {
      return NextResponse.json({ error: 'Invalid manager ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: season, error: seasonError } = await supabase
      .from('fantasy_seasons')
      .select(`
        id,
        season_id,
        total_points,
        global_rank,
        gameweek_points_latest,
        users(id, username, display_name, avatar_url, bio, country_code, created_at),
        fantasy_squads(name, fantasy_squad_members(
          player_id,
          removed_date,
          professional_players(id, name, in_game_name, primary_role, profile_image_url, professional_teams(name))
        ))
      `)
      .eq('id', fantasySeasonId)
      .maybeSingle();

    if (seasonError) {
      console.error('Unable to load leaderboard manager:', seasonError.message);
      return NextResponse.json({ error: 'Unable to load manager details.' }, { status: 500 });
    }
    if (!season) {
      return NextResponse.json({ error: 'Manager not found.' }, { status: 404 });
    }

    const { data: pastGameweeks, error: gameweeksError } = await supabase
      .from('gameweeks')
      .select('id, gameweek_number, status')
      .eq('season_id', season.season_id)
      .in('status', ['closed', 'locked'])
      .order('gameweek_number', { ascending: false })
      .limit(6);

    if (gameweeksError) {
      console.error('Unable to load manager gameweek history:', gameweeksError.message);
      return NextResponse.json({ error: 'Unable to load manager gameweek history.' }, { status: 500 });
    }

    const pastGameweekIds = (pastGameweeks ?? []).map((gameweek) => gameweek.id);
    const { data: lineups, error: lineupsError } = pastGameweekIds.length > 0
      ? await supabase
      .from('fantasy_lineups')
      .select('gameweek_id, total_points')
      .eq('fantasy_season_id', fantasySeasonId)
      .in('gameweek_id', pastGameweekIds)
      : { data: [], error: null };

    if (lineupsError) {
      console.error('Unable to load manager gameweek history:', lineupsError.message);
      return NextResponse.json({ error: 'Unable to load manager gameweek history.' }, { status: 500 });
    }

    const profile = firstRelation(season.users);
    const squad = firstRelation(season.fantasy_squads);
    const players = (squad?.fantasy_squad_members ?? [])
      .filter((member) => !member.removed_date)
      .map((member) => {
        const player = firstRelation(member.professional_players);
        const team = firstRelation(player?.professional_teams);
        if (!player) return null;
        return {
          id: player.id,
          name: player.in_game_name || player.name || `Player ${player.id}`,
          role: player.primary_role || 'Unassigned',
          team: team?.name ?? null,
          profileImageUrl: player.profile_image_url,
        };
      })
      .filter((player): player is NonNullable<typeof player> => player !== null)
      .sort((left, right) => left.role.localeCompare(right.role) || left.name.localeCompare(right.name));

    const response = NextResponse.json({
      manager: {
        username: profile?.username ?? null,
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        bio: profile?.bio ?? null,
        country: formatCountry(profile?.country_code),
        countryCode: profile?.country_code ?? null,
        memberSince: profile?.created_at ?? null,
        teamName: squad?.name ?? profile?.display_name ?? profile?.username ?? 'Fantasy Team',
        totalPoints: Number(season.total_points ?? 0),
        globalRank: season.global_rank ?? null,
        gameweekPoints: Number(season.gameweek_points_latest ?? 0),
      },
      squad: players,
      recentGameweeks: (pastGameweeks ?? []).map((gameweek) => ({
        gameweekNumber: gameweek.gameweek_number,
        status: gameweek.status,
        points: Number(
          lineups?.find((lineup) => lineup.gameweek_id === gameweek.id)?.total_points ?? 0,
        ),
      })),
    });
    applyRefreshedTokens(response, auth);
    return response;
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as AuthError).status)
      : 500;
    if (status >= 500) console.error('Leaderboard manager details request failed:', error);
    return NextResponse.json(
      { error: status === 401 ? 'Authentication required.' : 'Unable to load manager details.' },
      { status },
    );
  }
}

export const GET = withApiTelemetry('GET', '/api/leaderboard/managers/[id]', getHandler);
