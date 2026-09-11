import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';

const slots = ['carry', 'mid', 'offlane', 'support', 'hard_support', 'bench_1', 'bench_2', 'bench_3'] as const;
type Slot = (typeof slots)[number];

function getSlotId(row: Record<string, unknown>, slot: Slot): number | null {
  const value = row[`${slot}_id`];
  return typeof value === 'number' ? value : value ? Number(value) : null;
}

/**
 * GET /api/admin/fantasy-teams/[id]
 * Returns comprehensive team details for administrative inspection:
 * - Team & manager profile
 * - Active squad roster (Starters + Bench) with pro team and costs
 * - Gameweek lineup history with captaincy & points
 * - Transfer history (in/out, fees, timestamps)
 * - Joined leagues & standings
 * - Chip usage status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdminAuth(request);
    const { id } = await params;
    const fantasySeasonId = parseInt(id, 10);

    if (isNaN(fantasySeasonId)) {
      return NextResponse.json({ error: 'Invalid fantasy team ID.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // 1. Fetch fantasy season & manager profile
    const { data: fantasySeason, error: seasonError } = await (supabase.from('fantasy_seasons') as any)
      .select(`
        id,
        user_id,
        season_id,
        budget,
        total_points,
        global_rank,
        free_transfers,
        triple_captain_gameweek_id,
        bench_boost_gameweek_id,
        wildcard_used_gameweek_id,
        created_at,
        users (
          id,
          username,
          display_name,
          avatar_url,
          created_at
        ),
        seasons (
          id,
          name,
          status
        )
      `)
      .eq('id', fantasySeasonId)
      .maybeSingle();

    if (seasonError || !fantasySeason) {
      return NextResponse.json(
        { error: 'Fantasy team not found.', details: seasonError?.message },
        { status: 404 }
      );
    }

    // 2. Fetch Squad and Active Squad Members
    const { data: squads } = await (supabase.from('fantasy_squads') as any)
      .select(`
        id,
        name,
        created_at,
        fantasy_squad_members (
          id,
          player_id,
          cost,
          acquired_date,
          removed_date,
          professional_players (
            id,
            name,
            in_game_name,
            primary_role,
            profile_image_url,
            country,
            availability_status,
            professional_teams (
              id,
              name,
              slug,
              logo_url
            )
          )
        )
      `)
      .eq('fantasy_season_id', fantasySeasonId);

    const squad = squads?.[0] || null;
    const allMembers = squad?.fantasy_squad_members || [];
    const activeMembers = allMembers.filter((m: any) => !m.removed_date);

    // 3. Fetch Gameweek Lineups
    const { data: rawLineups } = await (supabase.from('fantasy_lineups') as any)
      .select(`
        *,
        gameweeks (
          id,
          gameweek_number,
          status,
          start_date,
          end_date,
          deadline
        )
      `)
      .eq('fantasy_season_id', fantasySeasonId)
      .order('gameweek_id', { ascending: false });

    // Collect all player IDs from lineups to resolve player details if needed
    const lineupPlayerIds = new Set<number>();
    (rawLineups || []).forEach((row: any) => {
      slots.forEach((s) => {
        const pid = getSlotId(row, s);
        if (pid) lineupPlayerIds.add(pid);
      });
    });

    // Also include active squad player IDs
    activeMembers.forEach((m: any) => {
      if (m.player_id) lineupPlayerIds.add(m.player_id);
    });

    // Fetch players metadata for all lineup players
    let playerMap: Record<number, any> = {};
    if (lineupPlayerIds.size > 0) {
      const { data: playersData } = await (supabase.from('professional_players') as any)
        .select(`
          id,
          name,
          in_game_name,
          primary_role,
          profile_image_url,
          country,
          availability_status,
          professional_teams (
            id,
            name,
            slug,
            logo_url
          )
        `)
        .in('id', Array.from(lineupPlayerIds));

      (playersData || []).forEach((p: any) => {
        playerMap[p.id] = p;
      });
    }

    const formattedLineups = (rawLineups || []).map((row: any) => {
      const lineupSlots = slots.map((slot) => {
        const playerId = getSlotId(row, slot);
        return playerId
          ? {
              slot,
              player_id: playerId,
              is_starter: !slot.startsWith('bench'),
              is_captain: row.captain_player_id === playerId,
              is_vice_captain: row.vice_captain_player_id === playerId,
              player: playerMap[playerId] || null,
            }
          : null;
      }).filter(Boolean);

      return {
        id: row.id,
        gameweek_id: row.gameweek_id,
        gameweek_number: row.gameweeks?.gameweek_number || null,
        gameweek_status: row.gameweeks?.status || null,
        total_points: Number(row.total_points || 0),
        locked: row.locked,
        locked_at: row.locked_at,
        captain_player_id: row.captain_player_id,
        vice_captain_player_id: row.vice_captain_player_id,
        slots: lineupSlots,
      };
    });

    // 4. Fetch Transfers
    const { data: rawTransfers } = await (supabase.from('player_transfers') as any)
      .select(`
        id,
        gameweek_id,
        player_id_out,
        player_id_in,
        transfer_fee,
        created_at,
        gameweeks (
          id,
          gameweek_number
        )
      `)
      .eq('fantasy_season_id', fantasySeasonId)
      .order('created_at', { ascending: false });

    // Collect transfer player IDs
    const transferPlayerIds = new Set<number>();
    (rawTransfers || []).forEach((t: any) => {
      if (t.player_id_out) transferPlayerIds.add(t.player_id_out);
      if (t.player_id_in) transferPlayerIds.add(t.player_id_in);
    });

    if (transferPlayerIds.size > 0) {
      const missingIds = Array.from(transferPlayerIds).filter((id) => !playerMap[id]);
      if (missingIds.length > 0) {
        const { data: additionalPlayers } = await (supabase.from('professional_players') as any)
          .select(`
            id,
            name,
            in_game_name,
            primary_role,
            profile_image_url,
            professional_teams (
              id,
              name,
              slug,
              logo_url
            )
          `)
          .in('id', missingIds);

        (additionalPlayers || []).forEach((p: any) => {
          playerMap[p.id] = p;
        });
      }
    }

    const formattedTransfers = (rawTransfers || []).map((t: any) => ({
      id: t.id,
      gameweek_id: t.gameweek_id,
      gameweek_number: t.gameweeks?.gameweek_number || null,
      transfer_fee: Number(t.transfer_fee || 0),
      created_at: t.created_at,
      player_out: t.player_id_out ? playerMap[t.player_id_out] || null : null,
      player_in: t.player_id_in ? playerMap[t.player_id_in] || null : null,
    }));

    // 5. Fetch Leagues
    const { data: rawLeagues } = await (supabase.from('league_participants') as any)
      .select(`
        id,
        points,
        rank,
        joined_at,
        leagues (
          id,
          name,
          league_type,
          privacy_level,
          current_participants,
          max_participants
        )
      `)
      .eq('fantasy_season_id', fantasySeasonId);

    const formattedLeagues = (rawLeagues || []).map((lp: any) => ({
      id: lp.id,
      points: Number(lp.points || 0),
      rank: lp.rank,
      joined_at: lp.joined_at,
      league: lp.leagues || null,
    }));

    // Response structure
    return NextResponse.json({
      team: {
        id: fantasySeason.id,
        name: squad?.name || 'Fantasy Squad',
        budget: Number(fantasySeason.budget || 0),
        total_points: Number(fantasySeason.total_points || 0),
        global_rank: fantasySeason.global_rank || null,
        free_transfers: fantasySeason.free_transfers ?? 1,
        created_at: fantasySeason.created_at,
        chips: {
          triple_captain_gameweek_id: fantasySeason.triple_captain_gameweek_id,
          bench_boost_gameweek_id: fantasySeason.bench_boost_gameweek_id,
          wildcard_used_gameweek_id: fantasySeason.wildcard_used_gameweek_id,
        },
      },
      manager: fantasySeason.users || {
        id: fantasySeason.user_id,
        username: 'Unknown Manager',
        display_name: 'Unknown Manager',
        avatar_url: null,
        email: null,
      },
      season: fantasySeason.seasons || null,
      squad: {
        id: squad?.id || null,
        name: squad?.name || 'Fantasy Squad',
        members: activeMembers.map((m: any) => ({
          id: m.id,
          player_id: m.player_id,
          cost: Number(m.cost || 0),
          acquired_date: m.acquired_date,
          player: m.professional_players || playerMap[m.player_id] || null,
        })),
      },
      lineups: formattedLineups,
      transfers: formattedTransfers,
      leagues: formattedLeagues,
    });
  } catch (error: any) {
    return createErrorResponse(error);
  }
}
