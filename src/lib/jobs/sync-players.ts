/**
 * Player Sync Job
 * 
 * Fetches all active professional players from data provider
 * and syncs them to the database
 * 
 * Run schedule: Daily at 3 AM UTC
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import type { PlayerData } from '@/lib/data-providers/provider-interface';
import type { ProfessionalPlayer } from '@/types/database';
import { hasConflict } from '@/lib/data-reconciliation/conflict-resolution';
import { createVersionRecord, detectFieldChanges } from '@/lib/data-reconciliation/data-versioning';
import { calculateCompletenessScore, calculateFreshnessScore, calculateReliabilityScore } from '@/lib/data-reconciliation/data-quality';

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

/**
 * Sync players from data provider to database
 * Idempotent: Can be safely retried without duplication
 */
export async function syncPlayers(): Promise<SyncResult> {
  const startedAt = new Date();
  const result: SyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    duration: 0,
    startedAt,
    completedAt: new Date(),
  };

  try {
    // Import here to avoid circular dependencies
    const { getDataProvider } = await import('../data-providers/provider-config');
    const { fetchRawOpenDotaProPlayers } = await import('../data-providers/opendota-provider');
    const provider = await getDataProvider();

    console.log('[syncPlayers] Starting player synchronization');

    // Log job execution for idempotency
    const jobExecutionId = await logJobExecution('sync-players', 'started');

    try {
      // 1. Pre-fetch raw OpenDota proPlayers ONCE — reused for both role lookup and
      //    fallback player mapping. Eliminates the duplicate HTTP call that previously
      //    fired on every sync run (once for role lookup, once on STRATZ failure).
      const rawOpenDotaPlayers = await fetchRawOpenDotaProPlayers();
      console.log(`[syncPlayers] OpenDota pre-fetch: ${rawOpenDotaPlayers.length} total players fetched`);

      // 2. Build role lookup from already-fetched data (no extra HTTP call)
      const roleLookup = buildRoleLookupFromRaw(rawOpenDotaPlayers);
      console.log(`[syncPlayers] Built role lookup for ${roleLookup.size} players`);

      // 3. Fetch players.
      //    - If the primary provider IS OpenDota: reuse the pre-fetched raw data directly
      //      (avoids a duplicate /proPlayers HTTP call — the data is already in memory).
      //    - If the primary provider is STRATZ: call it; on failure fall back to the
      //      pre-fetched OpenDota data (still no extra HTTP call on fallback).
      let players: import('@/lib/data-providers/provider-interface').PlayerData[];
      if (provider.name === 'OpenDota') {
        players = mapRawOpenDotaPlayersToPlayerData(rawOpenDotaPlayers);
        console.log(`[syncPlayers] Using pre-fetched OpenDota data: ${players.length} active players`);
      } else {
        players = await provider.fetchPlayers({ activeOnly: true }).catch(async (err) => {
          console.warn(`[syncPlayers] Primary provider failed (${err.message}), using pre-fetched OpenDota data`);
          return mapRawOpenDotaPlayersToPlayerData(rawOpenDotaPlayers);
        });
      }
      console.log(`[syncPlayers] Fetched ${players.length} players from provider`);

      // Get existing players for deduplication
      const existingPlayers = await getExistingPlayers();
      console.log(`[syncPlayers] Found ${existingPlayers.size} existing players in database`);

      // Get existing teams to resolve provider team ID to internal database ID
      const existingTeams = await getExistingTeams();
      console.log(`[syncPlayers] Found ${existingTeams.size} existing teams in database`);

      // Process players in batches
      const providerName = (provider.name || 'opendota').toLowerCase();
      const batchSize = 100;
      for (let i = 0; i < players.length; i += batchSize) {
        const batch = players.slice(i, i + batchSize);
        const batchResults = await processSyncBatch(batch, existingPlayers, existingTeams, roleLookup, providerName);

        result.created += batchResults.created;
        result.updated += batchResults.updated;
        result.skipped += batchResults.skipped;
        result.errors.push(...batchResults.errors);

        console.log(
          `[syncPlayers] Batch ${Math.floor(i / batchSize) + 1} processed: ` +
          `+${batchResults.created} created, +${batchResults.updated} updated, ` +
          `${batchResults.skipped} skipped`
        );
      }

      // Log successful completion
      await logJobExecution('sync-players', 'completed', {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
      }, jobExecutionId);

      console.log('[syncPlayers] Completed successfully');
    } catch (error) {
      // Log failed job
      await logJobExecution('sync-players', 'failed', {
        error: (error as Error).message,
      }, jobExecutionId);

      throw error;
    }
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error('[syncPlayers] Failed:', errorMsg);
    result.errors.push(errorMsg);
  }

  result.completedAt = new Date();
  result.duration = result.completedAt.getTime() - result.startedAt.getTime();

  return result;
}

/**
 * Process a batch of players for sync with reconciliation
 */
async function processSyncBatch(
  players: PlayerData[],
  existingPlayers: Map<string, ProfessionalPlayer>,
  existingTeams: Map<string, { id: number; name: string }> = new Map(),
  roleLookup: Map<string, string> = new Map(),
  providerName: string = 'opendota'
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const supabase = getSupabaseServerClient();

  // Process in sub-chunks of 5 concurrently to drastically speed up network round-trips
  const concurrency = 5;
  for (let i = 0; i < players.length; i += concurrency) {
    const chunk = players.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (player) => {
        try {
          const existing = existingPlayers.get(player.steamId);

          // Resolve database team_id from provider team info
          let resolvedTeamId: number | null = null;
          if (player.team?.id) {
            const teamMatch = existingTeams.get(player.team.id.toString()) || 
              (player.team.name ? existingTeams.get(player.team.name.toLowerCase().trim()) : undefined);
            if (teamMatch) {
              resolvedTeamId = teamMatch.id;
            } else if (player.team.name && player.team.name.trim()) {
              // If team is not yet in DB, auto-create it so the player is not orphaned as a Free Agent
              try {
                const teamName = player.team.name.trim();
                const { data: newTeam, error: teamErr } = await supabase
                  .from('professional_teams')
                  .insert({
                    name: teamName,
                    slug: player.team.id.toString(),
                    data_provider_id: player.team.id.toString(),
                    last_synced_at: new Date().toISOString(),
                  })
                  .select('id, name')
                  .single();

                if (newTeam && !teamErr) {
                  resolvedTeamId = newTeam.id;
                  existingTeams.set(player.team.id.toString(), { id: newTeam.id, name: newTeam.name });
                  existingTeams.set(teamName.toLowerCase(), { id: newTeam.id, name: newTeam.name });
                } else if (teamErr?.code === '23505') {
                  // If duplicate name, fetch existing team ID
                  const { data: dupTeam } = await supabase
                    .from('professional_teams')
                    .select('id, name')
                    .ilike('name', teamName)
                    .single();
                  if (dupTeam) {
                    resolvedTeamId = dupTeam.id;
                    existingTeams.set(player.team.id.toString(), { id: dupTeam.id, name: dupTeam.name });
                    existingTeams.set(teamName.toLowerCase(), { id: dupTeam.id, name: dupTeam.name });
                  }
                }
              } catch (teamCreateErr) {
                console.warn(`Failed to auto-create team ${player.team.name}:`, teamCreateErr);
              }
            }
          }

          // Map any role format to the DB player_role ENUM values:
          // Stratz returns integers (1-5) or strings like POSITION_1, CORE, SOFT_SUPPORT, HARD_SUPPORT
          // OpenDota returns strings already mapped to our enum (handled in the provider)
          // The sync job must validate these before writing to the DB.
          function normaliseRole(raw: string | number | null | undefined): string | null {
            if (!raw && raw !== 0) return null;
            const s = String(raw).trim().toUpperCase();
            // Position integers (Stratz style)
            if (s === '1' || s === 'POSITION_1' || s === 'SAFELANE') return 'Carry';
            if (s === '2' || s === 'POSITION_2' || s === 'MIDLANE' || s === 'MID') return 'Mid';
            if (s === '3' || s === 'POSITION_3' || s === 'OFFLANE') return 'Offlane';
            if (s === '4' || s === 'POSITION_4' || s === 'SOFT_SUPPORT' || s === 'SUPPORT') return 'Support';
            if (s === '5' || s === 'POSITION_5' || s === 'HARD_SUPPORT') return 'Hard Support';
            // Already-valid enum values (case-insensitive)
            if (s === 'CARRY') return 'Carry';
            if (s === 'MID') return 'Mid';
            if (s === 'OFFLANE') return 'Offlane';
            if (s === 'SUPPORT') return 'Support';
            if (s === 'HARD SUPPORT' || s === 'HARD_SUPPORT') return 'Hard Support';
            if (s === 'CORE') return 'Carry';
            return null;
          }

          // 1. Try provider role
          let resolvedRole = normaliseRole(player.roles && player.roles[0]);

          // 2. If provider has no role, lookup in OpenDota proPlayers role authority
          if (!resolvedRole) {
            resolvedRole = roleLookup.get(player.steamId) || 
              (player.id ? roleLookup.get(player.id) : null) ||
              (player.name ? roleLookup.get(player.name.toLowerCase().trim()) : null) || null;
          }

          // 3. Fallback to Carry if still unresolved
          const finalRole = resolvedRole || 'Carry';

          if (existing) {
            // Determine role to write:
            // - Keep existing role if already set
            // - Otherwise use newly resolved role (from provider or OpenDota lookup)
            // - Never leave it null if we have any signal
            const effectiveRole = existing.primary_role || resolvedRole || finalRole;

            // Prepare update data
            const updateData: Record<string, unknown> = {
              name: player.name,
              in_game_name: player.name,
              country: player.country,
              profile_image_url: player.imageUrl,
              last_synced_at: new Date().toISOString(),
              primary_role: effectiveRole,
            };

            // Only overwrite team_id if we resolved a valid team or player explicitly has no team
            if (resolvedTeamId !== null) {
              updateData.team_id = resolvedTeamId;
            }

            // Check for conflicts between existing and new data
            const existingObj = {
              name: existing.name,
              country: existing.country,
              team_id: existing.team_id,
              profile_image_url: existing.profile_image_url,
            };

            if (hasConflict(existingObj, updateData)) {
              // Store conflict records for admin review
              const changedFields = detectFieldChanges(existingObj, updateData);
              for (const fieldName of Object.keys(changedFields.changed)) {
                const val1 = existingObj[fieldName as keyof typeof existingObj];
                const val2 = updateData[fieldName as keyof typeof updateData];

                if (hasConflict(val1, val2)) {
                  try {
                    await supabase.from('data_conflicts').insert({
                      entity_type: 'player',
                      entity_id: existing.id.toString(),
                      field_name: fieldName,
                      value_1: val1,
                      value_2: val2,
                      provider_1: 'database',
                      provider_2: providerName,
                      status: 'unresolved',
                    });
                  } catch (conflictError) {
                    console.warn(`Failed to log conflict for field ${fieldName}: ${conflictError}`);
                  }
                }
              }
            }

            // Update player
            const { error } = await supabase
              .from('professional_players')
              .update(updateData)
              .eq('id', existing.id);

            if (error) {
              throw error;
            }

            // Create version record for audit trail
            const changedFields = detectFieldChanges(existingObj, updateData);
            if (Object.keys(changedFields.changed).length > 0) {
              try {
                const versionRecord = createVersionRecord(
                  'player',
                  existing.id.toString(),
                  1,
                  existingObj,
                  updateData,
                  'sync',
                  `Player data updated from ${providerName.toUpperCase()} provider`,
                  providerName as any,
                  undefined,
                  0.9
                );

                await supabase.from('data_version_history').insert({
                  entity_type: versionRecord.entity_type,
                  entity_id: versionRecord.entity_id,
                  version_number: versionRecord.version_number,
                  previous_values: versionRecord.previous_values,
                  new_values: versionRecord.new_values,
                  changed_fields: versionRecord.changed_fields,
                  change_reason: versionRecord.change_reason,
                  changed_by_provider: versionRecord.changed_by_provider,
                  change_source: 'sync',
                  confidence_score: versionRecord.confidence_score,
                  is_approved: versionRecord.is_approved,
                  created_at: versionRecord.created_at,
                });
              } catch (versionError) {
                console.warn(`Failed to create version record: ${versionError}`);
              }
            }

            results.updated++;
          } else {
            // Create new player
            const newPlayerData: Record<string, unknown> = {
              name: player.name,
              in_game_name: player.name,
              slug: player.steamId.toString(),
              country: player.country,
              primary_role: finalRole,
              team_id: resolvedTeamId,
              profile_image_url: player.imageUrl,
              data_provider_id: player.steamId.toString(),
              last_synced_at: new Date().toISOString(),
              availability_status: 'available',
            };

            const { data: insertedPlayer, error } = await supabase
              .from('professional_players')
              .insert(newPlayerData)
              .select('id')
              .single();

            if (error) {
              throw error;
            }

            // Create initial version record
            if (insertedPlayer) {
              try {
                const versionRecord = createVersionRecord(
                  'player',
                  insertedPlayer.id.toString(),
                  1,
                  {},
                  newPlayerData,
                  'sync',
                  `New player created from ${providerName.toUpperCase()} provider`,
                  providerName as any,
                  undefined,
                  0.9
                );

                await supabase.from('data_version_history').insert({
                  entity_type: versionRecord.entity_type,
                  entity_id: versionRecord.entity_id,
                  version_number: versionRecord.version_number,
                  previous_values: versionRecord.previous_values,
                  new_values: versionRecord.new_values,
                  changed_fields: versionRecord.changed_fields,
                  change_reason: versionRecord.change_reason,
                  changed_by_provider: versionRecord.changed_by_provider,
                  change_source: 'sync',
                  confidence_score: versionRecord.confidence_score,
                  is_approved: versionRecord.is_approved,
                  created_at: versionRecord.created_at,
                });
              } catch (versionError) {
                console.warn(`Failed to create version record: ${versionError}`);
              }

              // Calculate initial quality score
              try {
                const completeness = calculateCompletenessScore(newPlayerData, [
                  'name',
                  'country',
                  'profile_image_url',
                  'team_id',
                ]);
                const freshness = calculateFreshnessScore(new Date());
                const reliability = calculateReliabilityScore({ [providerName]: 0.95 });
                const consistency = 1.0; // New player has no conflicts

                const overallScore = (completeness * 0.3 + consistency * 0.25 + freshness * 0.2 + reliability * 0.25);

                await supabase.from('data_quality_scores').insert({
                  entity_type: 'player',
                  entity_id: insertedPlayer.id.toString(),
                  overall_score: overallScore,
                  completeness_score: completeness,
                  consistency_score: consistency,
                  freshness_score: freshness,
                  reliability_score: reliability,
                  issues: [],
                  flagged_for_review: overallScore < 0.7,
                });
              } catch (qualityError) {
                console.warn(`Failed to create quality score: ${qualityError}`);
              }
            }

            results.created++;
          }
        } catch (error) {
          results.errors.push(
            `Failed to sync player ${player.steamId}: ${(error as Error).message}`
          );
        }
      })
    );
  }

  return results;
}

/**
 * Get existing players from database for deduplication
 */
async function getExistingPlayers(): Promise<Map<string, ProfessionalPlayer>> {
  const supabase = getSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('professional_players')
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch existing players: ${error.message}`);
  }

  // Map by data_provider_id for deduplication
  const playerMap = new Map<string, ProfessionalPlayer>();
  for (const player of data || []) {
    if (player.data_provider_id) {
      playerMap.set(player.data_provider_id, player);
    }
  }

  return playerMap;
}

/**
 * Get existing teams from database to map provider team IDs to database team IDs
 */
async function getExistingTeams(): Promise<Map<string, { id: number; name: string }>> {
  const supabase = getSupabaseServerClient();
  
  const { data, error } = await supabase
    .from('professional_teams')
    .select('id, name, data_provider_id');

  if (error) {
    console.warn(`Failed to fetch existing teams for player mapping: ${error.message}`);
    return new Map();
  }

  const teamMap = new Map<string, { id: number; name: string }>();
  for (const team of data || []) {
    if (team.data_provider_id) {
      teamMap.set(team.data_provider_id.toString(), { id: team.id, name: team.name });
    }
    // Also map by name in case data_provider_id wasn't set or differs
    if (team.name) {
      teamMap.set(team.name.toLowerCase().trim(), { id: team.id, name: team.name });
    }
  }

  return teamMap;
}

/**
 * Log job execution for tracking and idempotency
 */
async function logJobExecution(
  jobName: string,
  status: 'started' | 'completed' | 'failed',
  metadata?: Record<string, unknown>,
  executionId?: string
): Promise<string> {
  const supabase = getSupabaseServerClient();
  const isUuid = executionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(executionId);

  if (isUuid) {
    // Update existing execution log
    const { error } = await supabase
      .from('job_execution_log')
      .update({
        status,
        completed_at: new Date().toISOString(),
        metadata,
      })
      .eq('id', executionId);

    if (error) {
      console.warn(`Failed to update job execution log: ${error.message}`);
    }

    return executionId;
  } else {
    // Create new execution log
    const { data, error } = await supabase
      .from('job_execution_log')
      .insert({
        job_name: jobName,
        status,
        started_at: new Date().toISOString(),
        metadata,
      })
      .select('id')
      .single();

    if (error) {
      console.warn(`Failed to create job execution log: ${error.message}`);
      return `job-${Date.now()}`;
    }

    return data?.id || `job-${Date.now()}`;
  }
}

/**
 * Build a role lookup map from an already-fetched raw OpenDota proPlayers array.
 *
 * Replaces getOpenDotaRoleLookup() — accepts pre-fetched data instead of firing
 * its own HTTP call, so the sync job only ever hits /proPlayers once per run.
 *
 * Keys by steamid AND account_id only — name-based keys cause collisions
 * when multiple players share a display name (e.g. "Satanic", "Support").
 */
function buildRoleLookupFromRaw(rawPlayers: any[]): Map<string, string> {
  const roleMap: Record<number, string> = {
    1: 'Carry',
    2: 'Support',
    3: 'Offlane',
    4: 'Mid',
  };
  const lookup = new Map<string, string>();
  for (const player of rawPlayers) {
    const roleName = player.fantasy_role ? roleMap[player.fantasy_role] : null;
    if (!roleName) continue;
    if (player.steamid) lookup.set(String(player.steamid), roleName);
    if (player.account_id) lookup.set(String(player.account_id), roleName);
  }
  return lookup;
}

/**
 * Map pre-fetched raw OpenDota proPlayers data to the PlayerData shape.
 *
 * Used as the STRATZ fallback: when STRATZ fails, sync-players reuses the
 * data that was already pre-fetched for role-lookup — no second HTTP call.
 * Applies the same active-player filter as OpenDotaProvider.fetchPlayers().
 */
function mapRawOpenDotaPlayersToPlayerData(rawPlayers: any[]): import('@/lib/data-providers/provider-interface').PlayerData[] {
  const roleMap: Record<number, string> = {
    1: 'Carry',
    2: 'Support',
    3: 'Offlane',
    4: 'Mid',
  };

  const activePlayers = rawPlayers.filter(
    (p: any) => p.name && p.is_pro && p.team_id && p.team_id !== 0
  );

  console.log(
    `[syncPlayers] OpenDota: ${rawPlayers.length} total, ${activePlayers.length} active ` +
    `(filtered out ${rawPlayers.length - activePlayers.length} inactive)`
  );

  return activePlayers.map((p: any) => ({
    id: String(p.account_id),
    steamId: p.steamid ? String(p.steamid) : String(p.account_id),
    name: p.name || p.personaname,
    tag: p.team_tag || undefined,
    country: p.country_code || p.loccountrycode || undefined,
    roles: [roleMap[p.fantasy_role] || 'Carry'],
    team: p.team_id
      ? { id: String(p.team_id), name: p.team_name || 'Independent' }
      : undefined,
    isActive: true,
    profileUrl: p.profileurl || `https://opendota.com/players/${p.account_id}`,
    imageUrl: p.avatarfull || p.avatarmedium || p.avatar,
    lastUpdated: new Date(),
  }));
}
