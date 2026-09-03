import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth, AuthError } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const supabase = supabaseServer();

    // Fetch user's fantasy season
    const { data: fantasySeason } = await supabase
      .from('fantasy_seasons')
      .select('id, total_points, global_rank')
      .eq('user_id', user.userId)
      .maybeSingle();

    if (!fantasySeason) {
       return NextResponse.json({
         fantasySeasonId: null,
          gameweek: null,
          totalPoints: 0,
          globalRank: null,
          freeTransfers: 0,
          activeSquadCount: 0,
          captain: null,
          viceCaptain: null,
          leagueStandings: []
       });
    }

    // Get active/upcoming gameweek
    const { data: gameweeks } = await supabase
      .from('gameweeks')
      .select('id, gameweek_number, deadline')
      .in('status', ['upcoming', 'active'])
      .order('start_date', { ascending: true })
      .limit(1);

    const gameweek = gameweeks && gameweeks.length > 0 ? gameweeks[0] : null;
    
    // Get free transfers count
    const { data: transferData } = await supabase
      .from('fantasy_squads')
      .select('free_transfers')
      .eq('fantasy_season_id', fantasySeason.id)
      .maybeSingle();

    const freeTransfers = transferData?.free_transfers || 0;
    
    // Get active squad count
    const { count: activeSquadCount } = await supabase
      .from('fantasy_squads')
      .select('*', { count: 'exact' })
      .eq('fantasy_season_id', fantasySeason.id);

    let captain = null;
    let viceCaptain = null;

    if (gameweek) {
      // Get lineup for this gameweek
      const { data: lineup } = await supabase
        .from('fantasy_lineups')
        .select('captain_player_id, vice_captain_player_id')
        .eq('fantasy_season_id', fantasySeason.id)
        .eq('gameweek_id', gameweek.id)
        .maybeSingle();

      if (lineup) {
         if (lineup.captain_player_id) {
           const { data: cap } = await supabase.from('professional_players').select('name, primary_role').eq('id', lineup.captain_player_id).maybeSingle();
           captain = cap;
         }
         if (lineup.vice_captain_player_id) {
           const { data: vcap } = await supabase.from('professional_players').select('name, primary_role').eq('id', lineup.vice_captain_player_id).maybeSingle();
           viceCaptain = vcap;
         }
      }
    }

    const { data: leagues } = await supabase
      .from('league_participants')
      .select(`
        rank,
        points,
        leagues(id, name)
      `)
      .eq('user_id', user.userId)
      .limit(3);

    return NextResponse.json({
      fantasySeasonId: fantasySeason.id,
      gameweek,
      totalPoints: fantasySeason.total_points || 0,
      globalRank: fantasySeason.global_rank,
      freeTransfers,
      activeSquadCount: activeSquadCount || 0,
      captain,
      viceCaptain,
      leagueStandings: leagues || []
    });

  } catch (error: unknown) {
    const authError = error as AuthError;
    if (authError.status) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
