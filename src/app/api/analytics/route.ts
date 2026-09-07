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

        const { data: scoreRows } = await supabase.from('gameweek_scores')
          .select('player_id, total_points')
          .in('player_id', lineupIds)
          .eq('gameweek_id', recentGameweekId);

        const totals = new Map<string, number>();
        for (const row of scoreRows ?? []) {
          const role = roleMap.get(Number(row.player_id)) ?? 'Support';
          totals.set(role, (totals.get(role) ?? 0) + Number(row.total_points ?? 0));
        }

        roleBreakdown = Array.from(totals.entries()).map(([role, points]) => ({ role, points: Number(points.toFixed(1)) }));
      }
    }

    let captainEfficiency = { captainPoints: 0, idealCapPoints: 0, efficiency: 0 };
    if (recentLineup && recentLineup.captain_player_id) {
      const { data: captainScores } = await supabase.from('gameweek_scores')
        .select('total_points')
        .eq('player_id', recentLineup.captain_player_id)
        .eq('gameweek_id', recentGameweekId);

      const captainPoints = (captainScores ?? []).reduce((sum, row) => sum + Number(row.total_points ?? 0), 0);
      const { data: recentScores } = await supabase.from('gameweek_scores')
        .select('player_id, total_points')
        .in('gameweek_id', recentGameweekId ? [recentGameweekId] : [0]);

      const idealCapPoints = (recentScores ?? []).reduce((max, row) => Math.max(max, Number(row.total_points ?? 0)), 0);
      const efficiency = idealCapPoints ? Number(((captainPoints / idealCapPoints) * 100).toFixed(1)) : 0;
      captainEfficiency = { captainPoints: Number(captainPoints.toFixed(1)), idealCapPoints: Number(idealCapPoints.toFixed(1)), efficiency };
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
    const { data: marketRows } = await supabase.from('player_prices')
      .select('player_id, price, ownership_percentage, created_at, professional_players(id, name, primary_role, professional_teams(name))')
      .eq('season_id', season.season_id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (marketRows) {
      const deduped = new Map<number, (typeof marketRows)[number]>();
      for (const row of marketRows) {
        if (!deduped.has(Number(row.player_id))) deduped.set(Number(row.player_id), row);
      }

      const uniqueRows = Array.from(deduped.values());
      const { data: playerScoreRows } = await supabase.from('gameweek_scores')
        .select('player_id, total_points')
        .in('player_id', uniqueRows.map((row) => Number(row.player_id)))
        .order('gameweek_id', { ascending: false })
        .limit(1000);

      const totalScores = new Map<number, number>();
      for (const row of playerScoreRows ?? []) {
        totalScores.set(Number(row.player_id), (totalScores.get(Number(row.player_id)) ?? 0) + Number(row.total_points ?? 0));
      }

      for (const row of uniqueRows) {
        const player = Array.isArray(row.professional_players) ? row.professional_players[0] : row.professional_players;
        const team = (Array.isArray(player?.professional_teams) ? player.professional_teams[0] : player?.professional_teams) as { name?: string } | undefined;
        const playerId = Number(row.player_id);
        const price = Number(row.price ?? 0);
        const ownership = Number(row.ownership_percentage ?? 0);
        const totalPoints = totalScores.get(playerId) ?? 0;
        market.push({
          playerName: player?.name || 'Unknown',
          team: team?.name || 'Free Agent',
          role: player?.primary_role || 'Support',
          ownership,
          price,
          roi: price ? Number(((totalPoints / price) * 10).toFixed(2)) : 0,
        });
      }
    }

    market.sort((a, b) => b.roi - a.roi);

    const { data: dreamRows } = await supabase.from('gameweek_scores')
      .select('player_id, total_points, professional_players(id, name, primary_role, professional_teams(name))')
      .order('total_points', { ascending: false })
      .limit(20);

    const dreamTeam = (dreamRows ?? [])
      .slice(0, 8)
      .map((row) => {
        const player = Array.isArray(row.professional_players) ? row.professional_players[0] : row.professional_players;
        const team = (player && (Array.isArray(player.professional_teams) ? player.professional_teams[0] : player.professional_teams)) as { name?: string } | undefined;
        return {
        playerName: player?.name || 'Unknown',
        team: team?.name || 'Free Agent',
        role: player?.primary_role || 'Support',
        points: Number(row.total_points ?? 0),
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
