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
      .select('id, season_id, budget, total_points, global_rank, free_transfers')
      .eq('user_id', user.userId)
      .maybeSingle();

    if (!fantasySeason) {
       return NextResponse.json({
         fantasySeasonId: null,
          gameweek: null,
          totalPoints: 0,
          globalRank: null,
          bankBalance: 0,
          squadValue: 0,
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
      .select('id, gameweek_number, deadline, status')
      .in('status', ['upcoming', 'active'])
      .order('start_date', { ascending: true })
      .limit(1);

    const gameweek = gameweeks && gameweeks.length > 0 ? gameweeks[0] : null;
    
    const freeTransfers = fantasySeason.free_transfers || 0;
    
    // Get active squad count
    const { count: activeSquadCount } = await supabase
      .from('fantasy_squads')
      .select('*', { count: 'exact' })
      .eq('fantasy_season_id', fantasySeason.id);

    const { data: squad } = await supabase
      .from('fantasy_squads')
      .select('id, fantasy_squad_members(player_id, removed_date)')
      .eq('fantasy_season_id', fantasySeason.id)
      .maybeSingle();

    const playerIds = (squad?.fantasy_squad_members ?? [])
      .filter((member) => !member.removed_date)
      .map((member) => member.player_id);
    let squadValue = 0;

    if (playerIds.length > 0) {
      const { data: prices } = await supabase
        .from('player_prices')
        .select('player_id, price, gameweek_id')
        .eq('season_id', fantasySeason.season_id)
        .in('player_id', playerIds)
        .order('gameweek_id', { ascending: false });

      const latestPrices = new Map<number, number>();
      for (const price of prices ?? []) {
        if (!latestPrices.has(price.player_id)) latestPrices.set(price.player_id, Number(price.price ?? 0));
      }
      squadValue = playerIds.reduce((total, playerId) => total + (latestPrices.get(playerId) ?? 0), 0);
    }

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

    let starters: Array<{
      id: number;
      slot: string;
      name: string;
      in_game_name?: string | null;
      primary_role: string;
      current_price?: number | null;
      is_captain?: boolean;
      is_vice_captain?: boolean;
      team_name?: string | null;
    }> = [];

    if (gameweek) {
      const { data: row } = (await supabase
        .from('fantasy_lineups')
        .select('*')
        .eq('fantasy_season_id', fantasySeason.id)
        .eq('gameweek_id', gameweek.id)
        .maybeSingle()) as { data: Record<string, unknown> | null };

      if (row) {
        const slots = ['carry', 'mid', 'offlane', 'support', 'hard_support'] as const;
        const starterIds = slots
          .map((s) => (typeof row[`${s}_id`] === 'number' ? (row[`${s}_id`] as number) : row[`${s}_id`] ? Number(row[`${s}_id`]) : null))
          .filter((id): id is number => id !== null);

        if (starterIds.length > 0) {
          type StarterQueryPlayer = {
            id: number;
            name: string;
            in_game_name: string | null;
            primary_role: string;
            current_price: number | null;
            professional_teams: { name: string } | null;
          };

          const { data: starterPlayers } = (await supabase
            .from('professional_players')
            .select('id, name, in_game_name, primary_role, current_price, professional_teams(name)')
            .in('id', starterIds)) as { data: StarterQueryPlayer[] | null };

          const playerMap = new Map((starterPlayers ?? []).map((p) => [p.id, p]));
          starters = slots
            .map((slot) => {
              const pid = row[`${slot}_id`];
              const p = pid ? playerMap.get(Number(pid)) : null;
              if (!p) return null;
              return {
                id: p.id,
                slot,
                name: p.name,
                in_game_name: p.in_game_name,
                primary_role: p.primary_role,
                current_price: p.current_price,
                is_captain: row.captain_player_id === p.id,
                is_vice_captain: row.vice_captain_player_id === p.id,
                team_name: p.professional_teams?.name || null,
              };
            })
            .filter(Boolean) as typeof starters;
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
      bankBalance: Number(fantasySeason.budget || 0),
      squadValue,
      freeTransfers,
      activeSquadCount: activeSquadCount || 0,
      squadName: (squad && 'name' in squad && typeof squad.name === 'string') ? squad.name : 'My Fantasy Squad',
      captain,
      viceCaptain,
      starters,
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
