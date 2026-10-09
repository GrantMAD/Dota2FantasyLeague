import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';
import { withApiTelemetry } from '@/lib/api-telemetry';


const slots = ['carry', 'mid', 'offlane', 'support', 'hard_support', 'bench_1', 'bench_2', 'bench_3'] as const;
type Slot = (typeof slots)[number];

interface AdminPlayerRecord {
  id: number;
  name: string;
  in_game_name: string | null;
  primary_role: string;
  profile_image_url: string | null;
  country?: string | null;
  availability_status?: string | null;
  professional_teams?: { id: number; name: string; slug: string; logo_url: string | null } | null;
}

interface SquadMemberRecord {
  id: number;
  player_id: number;
  cost: number;
  acquired_date: string | null;
  removed_date: string | null;
  professional_players: AdminPlayerRecord | null;
}

interface SquadRecord {
  id: number;
  name: string;
  created_at: string;
  fantasy_squad_members: SquadMemberRecord[];
}

interface LineupRecord extends Record<string, unknown> {
  id: number;
  fantasy_season_id: number;
  gameweek_id: number;
  total_points: number | null;
  locked: boolean;
  locked_at: string | null;
  captain_player_id: number | null;
  vice_captain_player_id: number | null;
  gameweeks: { gameweek_number: number; status: string } | null;
}

interface TransferRecord {
  id: number;
  gameweek_id: number;
  player_id_out: number | null;
  player_id_in: number | null;
  transfer_fee: number | null;
  created_at: string;
  gameweeks: { gameweek_number: number } | null;
}

interface LeagueParticipationRecord {
  id: number;
  points: number | null;
  rank: number | null;
  joined_at: string | null;
  leagues: {
    id: number;
    name: string;
    league_type: string;
    privacy_level: string;
    current_participants: number;
    max_participants: number;
  } | null;
}

interface AdminFantasySeasonRecord {
  id: number;
  user_id: string;
  season_id: number;
  budget: number | null;
  total_points: number | null;
  global_rank: number | null;
  free_transfers: number | null;
  triple_captain_gameweek_id: number | null;
  bench_boost_gameweek_id: number | null;
  wildcard_used_gameweek_id: number | null;
  created_at: string;
  users: { id: string; username: string; display_name: string | null; avatar_url: string | null; created_at: string } | null;
  seasons: { id: number; name: string; status: string } | null;
}

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
async function getHandler(
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
    const { data: rawFantasySeason, error: seasonError } = await supabase.from('fantasy_seasons')
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
    const fantasySeason = rawFantasySeason as AdminFantasySeasonRecord | null;

    if (seasonError || !fantasySeason) {
      return NextResponse.json(
        { error: 'Fantasy team not found.', details: seasonError?.message },
        { status: 404 }
      );
    }

    // 2. Fetch Squad and Active Squad Members
    const { data: rawSquads } = await supabase.from('fantasy_squads')
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

    const squads = (rawSquads ?? []) as unknown as SquadRecord[];
    const squad = squads?.[0] || null;
    const allMembers = squad?.fantasy_squad_members || [];
    const activeMembers = allMembers.filter((member) => !member.removed_date);

    // 3. Fetch Gameweek Lineups
    const { data: rawLineupData } = await supabase.from('fantasy_lineups')
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
    const rawLineups = (rawLineupData ?? []) as LineupRecord[];

    // Collect all player IDs from lineups to resolve player details if needed
    const lineupPlayerIds = new Set<number>();
    rawLineups.forEach((row) => {
      slots.forEach((s) => {
        const pid = getSlotId(row, s);
        if (pid) lineupPlayerIds.add(pid);
      });
    });

    // Also include active squad player IDs
    activeMembers.forEach((member) => {
      if (member.player_id) lineupPlayerIds.add(member.player_id);
    });

    // Fetch players metadata for all lineup players
    const playerMap: Record<number, AdminPlayerRecord> = {};
    if (lineupPlayerIds.size > 0) {
      const { data: rawPlayersData } = await supabase.from('professional_players')
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
      const playersData = (rawPlayersData ?? []) as unknown as AdminPlayerRecord[];

      playersData.forEach((player) => {
        playerMap[player.id] = player;
      });
    }

    const formattedLineups = rawLineups.map((row) => {
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
    const { data: rawTransferData } = await supabase.from('player_transfers')
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
    const rawTransfers = (rawTransferData ?? []) as unknown as TransferRecord[];

    // Collect transfer player IDs
    const transferPlayerIds = new Set<number>();
    rawTransfers.forEach((transfer) => {
      if (transfer.player_id_out) transferPlayerIds.add(transfer.player_id_out);
      if (transfer.player_id_in) transferPlayerIds.add(transfer.player_id_in);
    });

    if (transferPlayerIds.size > 0) {
      const missingIds = Array.from(transferPlayerIds).filter((id) => !playerMap[id]);
      if (missingIds.length > 0) {
        const { data: rawAdditionalPlayers } = await supabase.from('professional_players')
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
        const additionalPlayers = (rawAdditionalPlayers ?? []) as unknown as AdminPlayerRecord[];

        additionalPlayers.forEach((player) => {
          playerMap[player.id] = player;
        });
      }
    }

    const formattedTransfers = rawTransfers.map((t) => ({
      id: t.id,
      gameweek_id: t.gameweek_id,
      gameweek_number: t.gameweeks?.gameweek_number || null,
      transfer_fee: Number(t.transfer_fee || 0),
      created_at: t.created_at,
      player_out: t.player_id_out ? playerMap[t.player_id_out] || null : null,
      player_in: t.player_id_in ? playerMap[t.player_id_in] || null : null,
    }));

    // 5. Fetch Leagues
    const { data: rawLeagueData } = await supabase.from('league_participants')
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
    const rawLeagues = (rawLeagueData ?? []) as unknown as LeagueParticipationRecord[];

    const formattedLeagues = rawLeagues.map((lp) => ({
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
        members: activeMembers.map((m) => ({
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
  } catch (error: unknown) {
    return createErrorResponse(error instanceof Error ? error : new Error(String(error)));
  }
}

export const GET = withApiTelemetry('GET', '/api/admin/fantasy-teams/:id', getHandler);
