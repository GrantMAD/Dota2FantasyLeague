import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';


interface FantasyBreakdownRow {
  total_points: number | null;
}

interface AnalyticsPlayer {
  id: number;
  name: string | null;
  in_game_name: string | null;
  primary_role: string | null;
  team_id?: number | null;
  professional_teams: { name: string | null } | { name: string | null }[] | null;
}

interface PerformanceAnalyticsRow {
  player_id: number;
  fantasy_points_breakdown: FantasyBreakdownRow | FantasyBreakdownRow[] | null;
  professional_players?: AnalyticsPlayer | AnalyticsPlayer[] | null;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

async function getHandler(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const supabase = supabaseServer();

    const { data: season } = await supabase.from('fantasy_seasons')
      .select('id, season_id, budget, total_points, global_rank, free_transfers')
      .eq('user_id', user.userId)
      .maybeSingle();

    if (!season) {
      return NextResponse.json({
        user: {
          totalPoints: 0,
          globalRank: null,
          budget: 0,
          squadValue: 0,
          freeTransfers: 0,
        },
        trend: [],
        roleBreakdown: [],
        captainEfficiency: { captainPoints: 0, idealCapPoints: 0, efficiency: 0 },
        market: [],
        dreamTeam: [],
        valueForMoney: [],
      });
    }

    const { data: lineups } = await supabase.from('fantasy_lineups')
      .select('gameweek_id, total_points, captain_player_id, vice_captain_player_id, carry_id, mid_id, offlane_id, support_id, hard_support_id')
      .eq('fantasy_season_id', season.id)
      .order('gameweek_id', { ascending: true });

    const recentLineup = (lineups ?? []).at(-1) ?? null;
    const recentGameweekId = recentLineup ? Number(recentLineup.gameweek_id) : null;
    const allGameweekIds = (lineups ?? []).map((row) => Number(row.gameweek_id));

    const { data: allSeasonLineups } = await supabase.from('fantasy_lineups')
      .select('gameweek_id, total_points')
      .in('gameweek_id', allGameweekIds.length ? allGameweekIds : [0]);

    const globalAverageByGameweek = new Map<number, number>();
    const globalTotals = new Map<number, { count: number; total: number }>();
    for (const row of allSeasonLineups ?? []) {
      const gwId = Number(row.gameweek_id);
      const current = globalTotals.get(gwId) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += Number(row.total_points ?? 0);
      globalTotals.set(gwId, current);
    }
    for (const [gwId, values] of globalTotals.entries()) {
      globalAverageByGameweek.set(gwId, Number((values.total / values.count).toFixed(1)));
    }

    const trend = (lineups ?? []).map((row) => ({
      gameweekId: Number(row.gameweek_id),
      userScore: Number(row.total_points ?? 0),
      globalAverage: globalAverageByGameweek.get(Number(row.gameweek_id)) ?? 0,
    }));

    // Role breakdown: use lineup slot as the authoritative role label and aggregate
    // points across ALL gameweeks so the chart is meaningful even early in the season.
    let roleBreakdown: Array<{ role: string; points: number }> = [];
    if ((lineups ?? []).length > 0) {
      // Map: slotLabel -> list of player IDs seen in that slot across all lineups
      const slotRoleMap: Record<string, Set<number>> = {
        Carry: new Set(),
        Mid: new Set(),
        Offlane: new Set(),
        Support: new Set(),
        'Hard Support': new Set(),
      };

      for (const lineup of lineups ?? []) {
        const row = lineup as Record<string, unknown>;
        if (row.carry_id) slotRoleMap['Carry'].add(Number(row.carry_id));
        if (row.mid_id) slotRoleMap['Mid'].add(Number(row.mid_id));
        if (row.offlane_id) slotRoleMap['Offlane'].add(Number(row.offlane_id));
        if (row.support_id) slotRoleMap['Support'].add(Number(row.support_id));
        if (row.hard_support_id) slotRoleMap['Hard Support'].add(Number(row.hard_support_id));
      }

      // Invert: player_id -> slot role (last slot seen wins if a player moved)
      const playerSlotRole = new Map<number, string>();
      for (const [role, ids] of Object.entries(slotRoleMap)) {
        for (const id of ids) playerSlotRole.set(id, role);
      }

      const allLineupPlayerIds = Array.from(playerSlotRole.keys());

      if (allLineupPlayerIds.length) {
        // Aggregate total fantasy points per player across ALL gameweeks
        const { data: allScoreData } = await supabase.from('player_performances')
          .select('player_id, fantasy_points_breakdown(total_points)')
          .in('player_id', allLineupPlayerIds)
          .in('gameweek_id', allGameweekIds.length ? allGameweekIds : [0]);
        const scoreRows = (allScoreData ?? []) as PerformanceAnalyticsRow[];

        const totals = new Map<string, number>();
        ['Carry', 'Mid', 'Offlane', 'Support', 'Hard Support'].forEach((r) => totals.set(r, 0));

        for (const row of scoreRows) {
          const role = playerSlotRole.get(Number(row.player_id)) ?? 'Support';
          const breakdown = firstRelation(row.fantasy_points_breakdown);
          const pts = Number(breakdown?.total_points ?? 0);
          totals.set(role, (totals.get(role) ?? 0) + pts);
        }

        roleBreakdown = Array.from(totals.entries()).map(([role, points]) => ({
          role,
          points: Number(points.toFixed(1)),
        }));
      }
    }

    let captainEfficiency = { captainPoints: 0, idealCapPoints: 0, efficiency: 0 };
    if (recentLineup && recentLineup.captain_player_id) {
      const { data: captainScoreData } = await supabase.from('player_performances')
        .select('fantasy_points_breakdown(total_points)')
        .eq('player_id', recentLineup.captain_player_id)
        .eq('gameweek_id', recentGameweekId);
      const captainScores = (captainScoreData ?? []) as Pick<PerformanceAnalyticsRow, 'fantasy_points_breakdown'>[];

      const rawCapPoints = captainScores.reduce((sum, row) => sum + Number(firstRelation(row.fantasy_points_breakdown)?.total_points ?? 0), 0);
      const captainPoints = rawCapPoints * 2;

      const starterIds = [
        recentLineup.carry_id,
        recentLineup.mid_id,
        recentLineup.offlane_id,
        recentLineup.support_id,
        recentLineup.hard_support_id,
      ].filter(Boolean);

      const { data: lineupPlayerScoreData } = await supabase.from('player_performances')
        .select('player_id, fantasy_points_breakdown(total_points)')
        .in('player_id', starterIds)
        .eq('gameweek_id', recentGameweekId);
      const lineupPlayerScores = (lineupPlayerScoreData ?? []) as PerformanceAnalyticsRow[];

      const lineupPlayerTotals = new Map<number, number>();
      for (const row of lineupPlayerScores ?? []) {
        const pId = Number(row.player_id);
        const pts = Number(firstRelation(row.fantasy_points_breakdown)?.total_points ?? 0);
        lineupPlayerTotals.set(pId, (lineupPlayerTotals.get(pId) ?? 0) + pts);
      }

      const bestStarterPoints = Array.from(lineupPlayerTotals.values()).reduce((max, pts) => Math.max(max, pts), 0);
      const idealCapPoints = bestStarterPoints * 2;
      const efficiency = idealCapPoints > 0 ? Number(((captainPoints / idealCapPoints) * 100).toFixed(1)) : (captainPoints > 0 ? 100 : 0);

      captainEfficiency = {
        captainPoints: Number(captainPoints.toFixed(1)),
        idealCapPoints: Number(idealCapPoints.toFixed(1)),
        efficiency,
      };
    }

    const { data: squadMembers } = await supabase.from('fantasy_squads')
      .select('id, fantasy_squad_members(player_id, removed_date)')
      .eq('fantasy_season_id', season.id)
      .maybeSingle();

    const activePlayerIds = (squadMembers?.fantasy_squad_members ?? [])
      .filter((member) => !member.removed_date)
      .map((member) => Number(member.player_id));

    let squadValue = 0;
    if (activePlayerIds.length) {
      const { data: latestPrices } = await supabase.from('player_prices')
        .select('player_id, price, gameweek_id')
        .eq('season_id', season.season_id)
        .in('player_id', activePlayerIds)
        .order('gameweek_id', { ascending: false });

      const latestByPlayer = new Map<number, number>();
      for (const row of latestPrices ?? []) {
        if (!latestByPlayer.has(Number(row.player_id))) {
          latestByPlayer.set(Number(row.player_id), Number(row.price ?? 0));
        }
      }
      squadValue = activePlayerIds.reduce((sum, playerId) => sum + (latestByPlayer.get(playerId) ?? 0), 0);
    }

    const market = [] as Array<{ playerName: string; team: string; role: string; ownership: number; price: number; roi: number; }>; 
    
    // Fetch scoring players from player_performances in recent gameweek to compute real ROI
    const { data: recentPerformanceData } = await supabase.from('player_performances')
      .select('player_id, fantasy_points_breakdown(total_points), professional_players(id, name, in_game_name, team_id, primary_role, professional_teams(name))')
      .eq('gameweek_id', recentGameweekId ?? 2)
      .not('fantasy_points_breakdown', 'is', null)
      .limit(300);
    const recentPerfRows = (recentPerformanceData ?? []) as PerformanceAnalyticsRow[];

    const perfTotalsByPlayer = new Map<number, { player: AnalyticsPlayer; points: number }>();
    for (const row of recentPerfRows) {
      const p = firstRelation(row.professional_players);
      const team = firstRelation(p?.professional_teams);
      // Filter out players who do not have an active team or are free agents
      if (!p || !p.team_id || !team?.name) continue;

      const pId = Number(row.player_id);
      const pts = Number(firstRelation(row.fantasy_points_breakdown)?.total_points ?? 0);
      const existing = perfTotalsByPlayer.get(pId);
      if (existing) {
        existing.points += pts;
      } else {
        perfTotalsByPlayer.set(pId, { player: p, points: pts });
      }
    }

    // Fetch prices and ownership for these scoring players
    const scoringPlayerIds = Array.from(perfTotalsByPlayer.keys());
    const { data: scoringPlayerPrices } = await supabase.from('player_prices')
      .select('player_id, price, ownership_percentage')
      .in('player_id', scoringPlayerIds.length ? scoringPlayerIds : [0]);

    const priceMap = new Map<number, { price: number; ownership: number }>();
    for (const p of scoringPlayerPrices ?? []) {
      priceMap.set(Number(p.player_id), {
        price: Number(p.price ?? 5.0),
        ownership: Number(p.ownership_percentage ?? 0),
      });
    }

    for (const [pId, { player: p, points }] of perfTotalsByPlayer.entries()) {
      const team = firstRelation(p.professional_teams);
      const priceInfo = priceMap.get(pId) ?? { price: 5.0, ownership: 0 };
      const price = priceInfo.price || 5.0;
      const ownership = priceInfo.ownership;
      const roi = Number(((points / price) * 10).toFixed(2));
      const displayName = (p.in_game_name && p.in_game_name !== 'Player (Unknown)')
        ? p.in_game_name
        : (p.name && p.name !== 'Player (Unknown)' ? p.name : `Player #${pId}`);

      market.push({
        playerName: displayName,
        team: team?.name || 'Unknown',
        role: p.primary_role || 'Support',
        ownership,
        price,
        roi,
      });
    }

    market.sort((a, b) => b.roi - a.roi);

    const { data: dreamRowData } = await supabase.from('player_performances')
      .select('player_id, fantasy_points_breakdown(total_points), professional_players(id, name, in_game_name, team_id, primary_role, professional_teams(name))')
      .eq('gameweek_id', recentGameweekId ?? 2)
      .not('fantasy_points_breakdown', 'is', null)
      .limit(300);
    const dreamRows = (dreamRowData ?? []) as PerformanceAnalyticsRow[];

    const dreamTotals = new Map<number, { player: AnalyticsPlayer; points: number }>();
    for (const row of dreamRows) {
      const p = firstRelation(row.professional_players);
      const team = firstRelation(p?.professional_teams);
      // Filter out players who do not have an active team or are free agents
      if (!p || !p.team_id || !team?.name) continue;

      const pId = Number(row.player_id);
      const pts = Number(firstRelation(row.fantasy_points_breakdown)?.total_points ?? 0);
      const existing = dreamTotals.get(pId);
      if (existing) {
        existing.points += pts;
      } else {
        dreamTotals.set(pId, { player: p, points: pts });
      }
    }

    const dreamTeam = Array.from(dreamTotals.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, 8)
      .map(({ player: p, points }) => {
        const team = firstRelation(p.professional_teams);
        const displayName = (p.in_game_name && p.in_game_name !== 'Player (Unknown)')
          ? p.in_game_name
          : (p.name && p.name !== 'Player (Unknown)' ? p.name : `Player #${p.id || '?'}`);
        return {
          playerName: displayName,
          team: team?.name || 'Unknown',
          role: p.primary_role || 'Support',
          points: Number(points.toFixed(1)),
        };
      });

    return NextResponse.json({
      user: {
        totalPoints: Number(season.total_points ?? 0),
        globalRank: season.global_rank ?? null,
        budget: Number(season.budget ?? 0),
        squadValue,
        freeTransfers: Number(season.free_transfers ?? 0),
      },
      trend,
      roleBreakdown,
      captainEfficiency,
      market: market.slice(0, 6),
      dreamTeam,
      valueForMoney: market.slice(0, 5),
    });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 401;
    return NextResponse.json({ error: 'Unable to load analytics.' }, { status });
  }
}

export const GET = withApiTelemetry('GET', '/api/analytics', getHandler);
