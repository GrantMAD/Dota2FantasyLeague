import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';

export async function GET(request: NextRequest) {
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

    let roleBreakdown: Array<{ role: string; points: number }> = [];
    if (recentLineup) {
      const lineupIds = [
        recentLineup.carry_id,
        recentLineup.mid_id,
        recentLineup.offlane_id,
        recentLineup.support_id,
        recentLineup.hard_support_id,
      ].filter(Boolean);

      if (lineupIds.length) {
        const { data: players } = await supabase.from('professional_players')
          .select('id, primary_role')
          .in('id', lineupIds);

        const roleMap = new Map<number, string>();
        for (const player of players ?? []) {
          roleMap.set(Number(player.id), player.primary_role || 'Support');
        }

        const { data: scoreRows } = await (supabase.from('player_performances') as any)
          .select('player_id, fantasy_points_breakdown(total_points)')
          .in('player_id', lineupIds)
          .eq('gameweek_id', recentGameweekId);

        const totals = new Map<string, number>();
        ['Carry', 'Mid', 'Offlane', 'Support', 'Hard Support'].forEach((r) => totals.set(r, 0));

        for (const row of scoreRows ?? []) {
          const role = roleMap.get(Number(row.player_id)) ?? 'Support';
          const pts = Number(row.fantasy_points_breakdown?.total_points ?? 0);
          totals.set(role, (totals.get(role) ?? 0) + pts);
        }

        roleBreakdown = Array.from(totals.entries()).map(([role, points]) => ({ role, points: Number(points.toFixed(1)) }));
      }
    }

    let captainEfficiency = { captainPoints: 0, idealCapPoints: 0, efficiency: 0 };
    if (recentLineup && recentLineup.captain_player_id) {
      const { data: captainScores } = await (supabase.from('player_performances') as any)
        .select('fantasy_points_breakdown(total_points)')
        .eq('player_id', recentLineup.captain_player_id)
        .eq('gameweek_id', recentGameweekId);

      const rawCapPoints = (captainScores ?? []).reduce((sum: number, row: any) => sum + Number(row.fantasy_points_breakdown?.total_points ?? 0), 0);
      const captainPoints = rawCapPoints * 2;

      const starterIds = [
        recentLineup.carry_id,
        recentLineup.mid_id,
        recentLineup.offlane_id,
        recentLineup.support_id,
        recentLineup.hard_support_id,
      ].filter(Boolean);

      const { data: lineupPlayerScores } = await (supabase.from('player_performances') as any)
        .select('player_id, fantasy_points_breakdown(total_points)')
        .in('player_id', starterIds)
        .eq('gameweek_id', recentGameweekId);

      const lineupPlayerTotals = new Map<number, number>();
      for (const row of lineupPlayerScores ?? []) {
        const pId = Number(row.player_id);
        const pts = Number(row.fantasy_points_breakdown?.total_points ?? 0);
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
    const { data: recentPerfRows } = await (supabase.from('player_performances') as any)
      .select('player_id, fantasy_points_breakdown(total_points), professional_players(id, name, in_game_name, primary_role, professional_teams(name))')
      .eq('gameweek_id', recentGameweekId ?? 2)
      .not('fantasy_points_breakdown', 'is', null)
      .limit(200);

    const perfTotalsByPlayer = new Map<number, { player: any; points: number }>();
    for (const row of recentPerfRows ?? []) {
      const pId = Number(row.player_id);
      const pts = Number(row.fantasy_points_breakdown?.total_points ?? 0);
      const existing = perfTotalsByPlayer.get(pId);
      if (existing) {
        existing.points += pts;
      } else {
        perfTotalsByPlayer.set(pId, { player: row.professional_players, points: pts });
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

    for (const [pId, { player, points }] of perfTotalsByPlayer.entries()) {
      const p = Array.isArray(player) ? player[0] : player;
      const team = (p && (Array.isArray(p.professional_teams) ? p.professional_teams[0] : p.professional_teams)) as { name?: string } | undefined;
      const priceInfo = priceMap.get(pId) ?? { price: 5.0, ownership: 0 };
      const price = priceInfo.price || 5.0;
      const ownership = priceInfo.ownership;
      const roi = Number(((points / price) * 10).toFixed(2));
      const displayName = (p?.in_game_name && p.in_game_name !== 'Player (Unknown)')
        ? p.in_game_name
        : (p?.name && p.name !== 'Player (Unknown)' ? p.name : `Player #${pId}`);

      market.push({
        playerName: displayName,
        team: team?.name || 'Free Agent',
        role: p?.primary_role || 'Support',
        ownership,
        price,
        roi,
      });
    }

    market.sort((a, b) => b.roi - a.roi);

    const { data: dreamRows } = await (supabase.from('player_performances') as any)
      .select('player_id, fantasy_points_breakdown(total_points), professional_players(id, name, in_game_name, primary_role, professional_teams(name))')
      .eq('gameweek_id', recentGameweekId ?? 2)
      .not('fantasy_points_breakdown', 'is', null)
      .limit(50);

    const dreamTotals = new Map<number, { player: any; points: number }>();
    for (const row of dreamRows ?? []) {
      const pId = Number(row.player_id);
      const pts = Number(row.fantasy_points_breakdown?.total_points ?? 0);
      const existing = dreamTotals.get(pId);
      if (existing) {
        existing.points += pts;
      } else {
        dreamTotals.set(pId, { player: row.professional_players, points: pts });
      }
    }

    const dreamTeam = Array.from(dreamTotals.values())
      .sort((a, b) => b.points - a.points)
      .slice(0, 8)
      .map(({ player, points }) => {
        const p = Array.isArray(player) ? player[0] : player;
        const team = (p && (Array.isArray(p.professional_teams) ? p.professional_teams[0] : p.professional_teams)) as { name?: string } | undefined;
        const displayName = (p?.in_game_name && p.in_game_name !== 'Player (Unknown)')
          ? p.in_game_name
          : (p?.name && p.name !== 'Player (Unknown)' ? p.name : `Player #${p?.id || '?'}`);
        return {
          playerName: displayName,
          team: team?.name || 'Free Agent',
          role: p?.primary_role || 'Support',
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
