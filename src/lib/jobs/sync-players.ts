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
    const provider = await getDataProvider();

    console.log('[syncPlayers] Starting player synchronization');

    // Log job execution for idempotency
    const jobExecutionId = await logJobExecution('sync-players', 'started');

    try {
      // Fetch all players from data provider
      const players = await provider.fetchPlayers({ activeOnly: true });
      console.log(`[syncPlayers] Fetched ${players.length} players from provider`);

      // Get existing players for deduplication
      const existingPlayers = await getExistingPlayers();
      console.log(`[syncPlayers] Found ${existingPlayers.size} existing players in database`);

      // Process players in batches
      const batchSize = 100;
      for (let i = 0; i < players.length; i += batchSize) {
        const batch = players.slice(i, i + batchSize);
        const batchResults = await processSyncBatch(batch, existingPlayers);

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
  existingPlayers: Map<string, ProfessionalPlayer>
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const supabase = getSupabaseServerClient();

  for (const player of players) {
    try {
      const existing = existingPlayers.get(player.steamId);

      if (existing) {
        // Prepare update data
        const updateData = {
          name: player.name,
          country: player.country,
          team_id: player.team?.id,
          profile_image_url: player.imageUrl,
          last_synced_at: new Date().toISOString(),
        };

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
            try {
              await supabase.from('data_conflicts').insert({
                entity_type: 'player',
                entity_id: existing.id.toString(),
                field_name: fieldName,
                value_1: existingObj[fieldName as keyof typeof existingObj],
                value_2: updateData[fieldName as keyof typeof updateData],
                provider_1: existing.data_provider_id || 'unknown',
                provider_2: 'stratz',
                status: 'unresolved',
              });
            } catch (conflictError) {
              console.warn(`Failed to log conflict for field ${fieldName}: ${conflictError}`);
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
              'automated_sync',
              'Player data updated from STRATZ provider',
              'stratz',
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
              change_source: versionRecord.change_source,
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
        const newPlayerData = {
          name: player.name,
          slug: player.steamId.toString(),
          country: player.country,
          team_id: player.team?.id,
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
              'automated_sync',
              'New player created from STRATZ provider',
              'stratz',
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
              change_source: versionRecord.change_source,
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
            const reliability = calculateReliabilityScore({ stratz: 0.9 });
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
 * Log job execution for tracking and idempotency
 */
async function logJobExecution(
  jobName: string,
  status: 'started' | 'completed' | 'failed',
  metadata?: Record<string, unknown>,
  executionId?: string
): Promise<string> {
  const supabase = getSupabaseServerClient();
  
  if (executionId) {
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
