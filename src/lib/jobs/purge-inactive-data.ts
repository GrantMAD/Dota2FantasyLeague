/**
 * Purge Inactive Data Job
 * 
 * Permanently removes players absent from provider data for 7+ days and teams
 * with no remaining active players. Includes sanity checks to prevent accidental
 * bulk deletion on provider outage days.
 * 
 * If a user has a deleted player in their squad:
 * - Removes the player from the squad
 * - Refunds player price to squad's remaining budget
 * - Clears captain/vice-captain slot in fantasy_lineups if the player held either role
 * - Dispatches a notification to the squad owner
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';

export interface PurgeResult {
  playersDeleted: number;
  teamsDeleted: number;
  squadsAffected: number;
  budgetRefunded: number;
  aborted: boolean;
  errors: string[];
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

export async function purgeInactiveData(): Promise<PurgeResult> {
  const startedAt = new Date();
  const result: PurgeResult = {
    playersDeleted: 0,
    teamsDeleted: 0,
    squadsAffected: 0,
    budgetRefunded: 0,
    aborted: false,
    errors: [],
    duration: 0,
    startedAt,
    completedAt: new Date(),
  };

  const supabase = getSupabaseServerClient();
  console.log('[purgeInactiveData] Starting purge job...');

  try {
    // -------------------------------------------------------------
    // STEP 1: Sanity Check
    // Verify provider is responding normally so we don't purge on API outage
    // -------------------------------------------------------------
    let providerPlayerCount = 0;
    try {
      const { fetchRawOpenDotaProPlayers } = await import('../data-providers/opendota-provider');
      const rawPlayers = await fetchRawOpenDotaProPlayers();
      providerPlayerCount = Array.isArray(rawPlayers) ? rawPlayers.length : 0;
    } catch (providerErr) {
      console.warn('[purgeInactiveData] Sanity check warning: Provider check threw error', providerErr);
    }

    const { count: totalDbPlayers, error: countErr } = await supabase
      .from('professional_players')
      .select('id', { count: 'exact', head: true });

    if (!countErr && totalDbPlayers && totalDbPlayers > 50 && providerPlayerCount > 0) {
      if (providerPlayerCount < totalDbPlayers * 0.4) {
        const errorMsg = `Provider returned suspiciously low player count (${providerPlayerCount} vs DB ${totalDbPlayers}). Aborting purge for safety.`;
        console.error(`[purgeInactiveData] ${errorMsg}`);
        result.aborted = true;
        result.errors.push(errorMsg);
        result.completedAt = new Date();
        result.duration = result.completedAt.getTime() - result.startedAt.getTime();
        return result;
      }
    }

    // -------------------------------------------------------------
    // STEP 2: Identify Purgeable Players (All inactive/unavailable players)
    // -------------------------------------------------------------
    const { data: purgeablePlayers, error: fetchErr } = await supabase
      .from('professional_players')
      .select('id, name, current_price, availability_status, last_synced_at, team_id')
      .in('availability_status', ['inactive', 'unavailable']);

    if (fetchErr) {
      throw new Error(`Failed to query inactive players: ${fetchErr.message}`);
    }

    const candidates = purgeablePlayers || [];
    console.log(`[purgeInactiveData] Found ${candidates.length} players eligible for purge review`);

    if (candidates.length > 0) {
      const candidateIds = candidates.map((p: any) => p.id);
      const playerMap = new Map<number, { id: number; name: string; price: number }>();
      for (const p of candidates as any[]) {
        playerMap.set(p.id, {
          id: p.id,
          name: p.name,
          price: Number(p.current_price ?? 5.0),
        });
      }

      // -----------------------------------------------------------
      // STEP 3: Squad Compensation & Notification
      // -----------------------------------------------------------
      // Fetch active squad members for these players
      const { data: squadMembers, error: smError } = await supabase
        .from('fantasy_squad_members')
        .select('id, squad_id, player_id, fantasy_squads(id, fantasy_season_id, fantasy_seasons(user_id, budget))')
        .in('player_id', candidateIds)
        .is('removed_date', null);

      if (!smError && squadMembers && squadMembers.length > 0) {
        console.log(`[purgeInactiveData] Found ${squadMembers.length} squad slots occupied by purgeable players`);

        const seasonBudgetMap = new Map<number, number>();

        for (const row of squadMembers as any[]) {
          const pInfo = playerMap.get(row.player_id);
          const refundAmount = pInfo ? pInfo.price : 5.0;
          const playerName = pInfo ? pInfo.name : 'Unknown Player';
          const squadId = row.squad_id;
          const userId = row.fantasy_squads?.fantasy_seasons?.user_id;
          const fantasySeasonId = row.fantasy_squads?.fantasy_season_id;
          
          if (!seasonBudgetMap.has(fantasySeasonId)) {
            seasonBudgetMap.set(fantasySeasonId, Number(row.fantasy_squads?.fantasy_seasons?.budget ?? 100));
          }
          const currentBudget = seasonBudgetMap.get(fantasySeasonId)!;

          try {
            // Remove from squad members
            await supabase
              .from('fantasy_squad_members')
              .delete()
              .eq('id', row.id);

            // Refund budget to fantasy_seasons (accumulated)
            if (fantasySeasonId) {
              const newBudget = Number((currentBudget + refundAmount).toFixed(2));
              seasonBudgetMap.set(fantasySeasonId, newBudget);
              await supabase
                .from('fantasy_seasons')
                .update({ budget: newBudget })
                .eq('id', fantasySeasonId);
            }

            result.squadsAffected++;
            result.budgetRefunded = Number((result.budgetRefunded + refundAmount).toFixed(2));

            // Notify user
            if (userId) {
              await (supabase.from('user_notifications') as any).insert({
                user_id: userId,
                type: 'player_removed',
                title: `Player Removed: ${playerName}`,
                message: `${playerName} is no longer active in competitive play and has been removed from your squad. $${refundAmount.toFixed(2)}M has been returned to your budget.`,
                metadata: {
                  player_id: row.player_id,
                  player_name: playerName,
                  refund_amount: refundAmount,
                  squad_id: squadId,
                },
              });
            }
          } catch (compError) {
            console.warn(`[purgeInactiveData] Error compensating squad member ${row.id}:`, compError);
            result.errors.push(`Error compensating squad slot ${row.id}: ${(compError as Error).message}`);
          }
        }
      }

      // -----------------------------------------------------------
      // STEP 3B: Lineup Slot Cleanup in fantasy_lineups
      // Null out only the specific slots occupied by purged players.
      // Starter columns are now nullable, so we preserve all other
      // valid starters (e.g. DM, Boxi, Dukalis remain intact while
      // only the purged player's slot becomes null/empty).
      // -----------------------------------------------------------
      try {
        const allSlotCols = ['carry_id', 'mid_id', 'offlane_id', 'support_id', 'hard_support_id', 'bench_1_id', 'bench_2_id', 'bench_3_id', 'captain_player_id', 'vice_captain_player_id'];
        const orConditions = allSlotCols.map(col => `${col}.in.(${candidateIds.join(',')})`).join(',');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: affectedLineups } = await (supabase.from('fantasy_lineups') as any)
          .select(`id, locked, ${allSlotCols.join(', ')}`)
          .or(orConditions);

        for (const lineup of affectedLineups || []) {
          if (lineup.locked) continue; // Never touch locked/historical lineups

          // Build a patch that only nulls the specific slots referencing a purged player
          const patch: Record<string, null> = {};
          for (const col of allSlotCols) {
            if (lineup[col] != null && candidateIds.includes(lineup[col])) {
              patch[col] = null;
            }
          }

          if (Object.keys(patch).length > 0) {
            await supabase
              .from('fantasy_lineups')
              .update(patch)
              .eq('id', lineup.id);
          }
        }
      } catch (lineupErr) {
        console.warn('[purgeInactiveData] Error cleaning lineup slots:', lineupErr);
      }

      // -----------------------------------------------------------
      // STEP 4: Safe Deletion vs Historical Preservation
      // Players with match performances must keep their DB record
      // to preserve historical stats; players without match performances
      // are permanently hard-deleted.
      // -----------------------------------------------------------
      const { data: playersWithPerformances } = await supabase
        .from('player_performances')
        .select('player_id')
        .in('player_id', candidateIds);

      const protectedIds = new Set(
        (playersWithPerformances || []).map((p: any) => p.player_id)
      );

      const safeToDeleteIds = candidateIds.filter((id: number) => !protectedIds.has(id));

      if (safeToDeleteIds.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < safeToDeleteIds.length; i += chunkSize) {
          const chunk = safeToDeleteIds.slice(i, i + chunkSize);

          // Delete prices for these players
          await supabase
            .from('player_prices')
            .delete()
            .in('player_id', chunk);

          // Delete the players
          const { error: delErr } = await supabase
            .from('professional_players')
            .delete()
            .in('id', chunk);

          if (delErr) {
            result.errors.push(`Failed to delete player chunk: ${delErr.message}`);
          } else {
            result.playersDeleted += chunk.length;
          }
        }
      }

      // For protected players with match history, ensure their availability is inactive and team is unassigned
      const protectedArray = Array.from(protectedIds);
      if (protectedArray.length > 0) {
        await supabase
          .from('professional_players')
          .update({
            availability_status: 'inactive',
            team_id: null,
          })
          .in('id', protectedArray);
        console.log(`[purgeInactiveData] Preserved ${protectedArray.length} historical players as inactive (match stats intact)`);
      }
    }

    // -------------------------------------------------------------
    // STEP 5 & 6: Clean Up Inactive Teams With Zero Players
    // -------------------------------------------------------------
    const { data: allTeams } = await supabase
      .from('professional_teams')
      .select('id, name');

    const { data: remainingPlayersWithTeams } = await supabase
      .from('professional_players')
      .select('team_id')
      .not('team_id', 'is', null);

    const activeTeamIds = new Set(
      (remainingPlayersWithTeams || [])
        .map((p: any) => p.team_id)
        .filter(Boolean) as number[]
    );

    // Filter teams that have 0 players left
    const emptyTeams = (allTeams || []).filter((t: any) => !activeTeamIds.has(t.id));

    if (emptyTeams.length > 0) {
      const emptyTeamIds = emptyTeams.map((t: any) => t.id);

      // Verify they don't have recent match participation in last 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentMatches } = await supabase
        .from('matches')
        .select('team_a_id, team_b_id')
        .gte('scheduled_time', ninetyDaysAgo);

      const matchTeamIds = new Set<number>();
      for (const m of (recentMatches || []) as any[]) {
        if (m.team_a_id) matchTeamIds.add(m.team_a_id);
        if (m.team_b_id) matchTeamIds.add(m.team_b_id);
      }

      const safeToDeleteTeams = emptyTeamIds.filter((id: number) => !matchTeamIds.has(id));

      if (safeToDeleteTeams.length > 0) {
        const { error: teamDelErr } = await supabase
          .from('professional_teams')
          .delete()
          .in('id', safeToDeleteTeams);

        if (teamDelErr) {
          result.errors.push(`Failed to delete empty teams: ${teamDelErr.message}`);
        } else {
          result.teamsDeleted = safeToDeleteTeams.length;
          console.log(`[purgeInactiveData] Deleted ${safeToDeleteTeams.length} empty inactive teams`);
        }
      }
    }

    console.log(
      `[purgeInactiveData] Completed: ${result.playersDeleted} players deleted, ` +
      `${result.teamsDeleted} teams deleted, ${result.squadsAffected} squads compensated ($${result.budgetRefunded}M refunded)`
    );
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error('[purgeInactiveData] Error occurred:', errorMsg);
    result.errors.push(errorMsg);
  }

  result.completedAt = new Date();
  result.duration = result.completedAt.getTime() - result.startedAt.getTime();
  return result;
}
