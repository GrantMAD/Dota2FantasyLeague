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
import { getTeamsSafeToDelete } from './team-purge-safety';

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

interface InactivePlayerRow {
  id: number;
  name: string;
  current_price: number | null;
  availability_status: string;
  last_synced_at: string | null;
  team_id: number | null;
}

interface SquadMemberRow {
  id: number;
  squad_id: number;
  player_id: number;
  fantasy_squads: {
    fantasy_season_id: number;
    fantasy_seasons: { user_id: string | null; budget: number | null } | { user_id: string | null; budget: number | null }[] | null;
  } | {
    fantasy_season_id: number;
    fantasy_seasons: { user_id: string | null; budget: number | null } | { user_id: string | null; budget: number | null }[] | null;
  }[] | null;
}

interface LineupRow {
  id: number;
  locked: boolean;
  [column: string]: unknown;
}

interface PlayerPerformanceRow {
  player_id: number;
}

interface TeamRow {
  id: number;
  name: string;
}

interface PlayerTeamRow {
  team_id: number | null;
}

interface MatchTeamIdsRow {
  team_a_id: number | null;
  team_b_id: number | null;
}

interface RosterHistoryTeamIdsRow {
  team_id: number;
  previous_team_id: number | null;
}

interface PlayerRemovedNotification {
  user_id: string;
  type: 'player_removed';
  title: string;
  message: string;
  metadata: {
    player_id: number;
    player_name: string;
    refund_amount: number;
    squad_id: number;
  };
}

function firstRelation<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
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

    const candidates = (purgeablePlayers ?? []) as InactivePlayerRow[];
    console.log(`[purgeInactiveData] Found ${candidates.length} players eligible for purge review`);

    if (candidates.length > 0) {
      const candidateIds = candidates.map((player) => player.id);
      const playerMap = new Map<number, { id: number; name: string; price: number }>();
      for (const player of candidates) {
        playerMap.set(player.id, {
          id: player.id,
          name: player.name,
          price: Number(player.current_price ?? 5.0),
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

        const seasonBudgetMap = new Map<number | undefined, number>();

        for (const row of squadMembers as unknown as SquadMemberRow[]) {
          const pInfo = playerMap.get(row.player_id);
          const refundAmount = pInfo ? pInfo.price : 5.0;
          const playerName = pInfo ? pInfo.name : 'Unknown Player';
          const squadId = row.squad_id;
          const squad = firstRelation(row.fantasy_squads);
          const fantasySeason = firstRelation(squad?.fantasy_seasons);
          const userId = fantasySeason?.user_id;
          const fantasySeasonId = squad?.fantasy_season_id;
          
          if (!seasonBudgetMap.has(fantasySeasonId)) {
            seasonBudgetMap.set(fantasySeasonId, Number(fantasySeason?.budget ?? 100));
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
              const notificationTable = supabase.from('user_notifications') as unknown as {
                insert(values: PlayerRemovedNotification): PromiseLike<unknown>;
              };
              await notificationTable.insert({
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

        for (const lineup of (affectedLineups ?? []) as LineupRow[]) {
          if (lineup.locked) continue; // Never touch locked/historical lineups

          // Build a patch that only nulls the specific slots referencing a purged player
          const patch: Record<string, null> = {};
          for (const col of allSlotCols) {
            const slotPlayerId = lineup[col];
            if (typeof slotPlayerId === 'number' && candidateIds.includes(slotPlayerId)) {
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
      // Supabase has a default 1000-row response cap. With 94 players × many
      // matches each the query could be silently truncated, causing players with
      // performances to be misclassified as safe-to-delete. A high explicit
      // limit ensures we see all player_id entries for the candidate set.
      const { data: playersWithPerformances } = await supabase
        .from('player_performances')
        .select('player_id')
        .in('player_id', candidateIds)
        .limit(50000);

      const protectedIds = new Set(
        ((playersWithPerformances ?? []) as PlayerPerformanceRow[]).map((player) => player.player_id)
      );

      const safeToDeleteIds = candidateIds.filter((id) => !protectedIds.has(id));

      if (safeToDeleteIds.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < safeToDeleteIds.length; i += chunkSize) {
          const chunk = safeToDeleteIds.slice(i, i + chunkSize);

          try {
            // Delete all FK-dependent rows first, in dependency order,
            // before touching professional_players.
            // None of these tables have ON DELETE CASCADE so we must clean
            // them manually or Postgres will reject the player DELETE.

            // 1. match_player_substitutions (references player via rostered_player_id / stand_in_player_id)
            await supabase.from('match_player_substitutions').delete().in('rostered_player_id', chunk);
            await supabase.from('match_player_substitutions').delete().in('stand_in_player_id', chunk);

            // 2. match_player_stats
            await supabase.from('match_player_stats').delete().in('player_id', chunk);

            // 3. team_roster_history
            await supabase.from('team_roster_history').delete().in('player_id', chunk);

            // 4. player_transfers (both in and out legs)
            await supabase.from('player_transfers').delete().in('player_id_out', chunk);
            await supabase.from('player_transfers').delete().in('player_id_in', chunk);

            // 5. gameweek_scores
            await supabase.from('gameweek_scores').delete().in('player_id', chunk);

            // 6. player_prices
            await supabase.from('player_prices').delete().in('player_id', chunk);

            // 7. player_performances (ON DELETE CASCADE propagates to fantasy_points_breakdown)
            // Safety net: safeToDeleteIds should have no performances, but if the
            // protectedIds query was still incomplete this prevents the FK violation.
            await supabase.from('player_performances').delete().in('player_id', chunk);

            // 8. Finally delete the players
            const { error: delErr } = await supabase
              .from('professional_players')
              .delete()
              .in('id', chunk);

            if (delErr) {
              result.errors.push(`Failed to delete player chunk: ${delErr.message}`);
            } else {
              result.playersDeleted += chunk.length;
            }
          } catch (chunkErr) {
            result.errors.push(`Failed to delete player chunk: ${(chunkErr as Error).message}`);
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
      ((remainingPlayersWithTeams ?? []) as PlayerTeamRow[])
        .map((player) => player.team_id)
        .filter((teamId): teamId is number => teamId !== null)
    );

    // Filter teams that have 0 players left
    const teamRows = (allTeams ?? []) as TeamRow[];
    const emptyTeams = teamRows.filter((team) => !activeTeamIds.has(team.id));

    if (emptyTeams.length > 0) {
      const emptyTeamIds = emptyTeams.map((team) => team.id);

      // Verify they don't have recent match participation in last 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentMatches, error: recentMatchesErr } = await supabase
        .from('matches')
        .select('team_a_id, team_b_id')
        .gte('scheduled_time', ninetyDaysAgo);

      if (recentMatchesErr) {
        result.errors.push(`Failed to check recent team matches: ${recentMatchesErr.message}`);
      }

      const [historyByCurrentTeam, historyByPreviousTeam] = await Promise.all([
        supabase
          .from('team_roster_history')
          .select('team_id')
          .in('team_id', emptyTeamIds),
        supabase
          .from('team_roster_history')
          .select('previous_team_id')
          .in('previous_team_id', emptyTeamIds),
      ]);

      if (historyByCurrentTeam.error || historyByPreviousTeam.error) {
        const historyError = historyByCurrentTeam.error ?? historyByPreviousTeam.error;
        result.errors.push(`Failed to check team roster history: ${historyError.message}`);
      }

      if (recentMatchesErr || historyByCurrentTeam.error || historyByPreviousTeam.error) {
        console.warn('[purgeInactiveData] Skipping empty-team deletion because safety checks failed');
      } else {
        const matchTeamIds = new Set<number>();
        for (const match of (recentMatches ?? []) as MatchTeamIdsRow[]) {
          if (match.team_a_id) matchTeamIds.add(match.team_a_id);
          if (match.team_b_id) matchTeamIds.add(match.team_b_id);
        }

        const rosterHistoryTeamIds = new Set<number>();
        for (const row of (historyByCurrentTeam.data ?? []) as Pick<RosterHistoryTeamIdsRow, 'team_id'>[]) {
          rosterHistoryTeamIds.add(row.team_id);
        }
        for (const row of (historyByPreviousTeam.data ?? []) as Pick<RosterHistoryTeamIdsRow, 'previous_team_id'>[]) {
          if (row.previous_team_id !== null) rosterHistoryTeamIds.add(row.previous_team_id);
        }

        const safeToDeleteTeams = getTeamsSafeToDelete(
          emptyTeamIds,
          matchTeamIds,
          rosterHistoryTeamIds
        );

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
