/**
 * Team Sync Job
 * 
 * Fetches all professional teams from data provider
 * and syncs them to the database
 * 
 * Run schedule: Daily at 3:15 AM UTC
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import type { TeamData } from '@/lib/data-providers/provider-interface';
import type { ProfessionalTeam } from '@/types/database';
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
 * Sync teams from data provider to database
 */
export async function syncTeams(): Promise<SyncResult> {
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
    const { getDataProvider } = await import('../data-providers/provider-config');
    const provider = await getDataProvider();

    console.log('[syncTeams] Starting team synchronization');

    const jobExecutionId = await logJobExecution('sync-teams', 'started');

    try {
      // Fetch all teams from data provider
      const teams = await provider.fetchTeams({ activeOnly: true });
      console.log(`[syncTeams] Fetched ${teams.length} teams from provider`);

      // Get existing teams for deduplication
      const existingTeams = await getExistingTeams();
      console.log(`[syncTeams] Found ${existingTeams.size} existing teams in database`);

      // Process teams in batches
      const batchSize = 50;
      for (let i = 0; i < teams.length; i += batchSize) {
        const batch = teams.slice(i, i + batchSize);
        const batchResults = await processSyncBatch(batch, existingTeams);

        result.created += batchResults.created;
        result.updated += batchResults.updated;
        result.skipped += batchResults.skipped;
        result.errors.push(...batchResults.errors);

        console.log(
          `[syncTeams] Batch processed: +${batchResults.created} created, ` +
          `+${batchResults.updated} updated`
        );
      }

      // Also sync team rosters
      console.log('[syncTeams] Syncing team rosters');
      const rosterResults = await syncTeamRosters(teams);
      result.created += rosterResults.created;
      result.updated += rosterResults.updated;

      await logJobExecution('sync-teams', 'completed', {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
      }, jobExecutionId);

      console.log('[syncTeams] Completed successfully');
    } catch (error) {
      await logJobExecution('sync-teams', 'failed', {
        error: (error as Error).message,
      }, jobExecutionId);
      throw error;
    }
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error('[syncTeams] Failed:', errorMsg);
    result.errors.push(errorMsg);
  }

  result.completedAt = new Date();
  result.duration = result.completedAt.getTime() - result.startedAt.getTime();

  return result;
}

/**
 * Process a batch of teams for sync with reconciliation
 */
async function processSyncBatch(
  teams: TeamData[],
  existingTeams: Map<string, ProfessionalTeam>
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };
  const supabase = getSupabaseServerClient();

  for (const team of teams) {
    try {
      const existing = existingTeams.get(team.id);

      if (existing) {
        // Prepare update data
        const updateData = {
          name: team.name,
          region: team.region,
          logo_url: team.logoUrl,
          last_synced_at: new Date().toISOString(),
        };

        // Check for conflicts
        const existingObj = {
          name: existing.name,
          region: existing.region,
          logo_url: existing.logo_url,
        };

        if (hasConflict(existingObj, updateData)) {
          const changedFields = detectFieldChanges(existingObj, updateData);
          for (const fieldName of Object.keys(changedFields.changed)) {
            try {
              await supabase.from('data_conflicts').insert({
                entity_type: 'team',
                entity_id: existing.id.toString(),
                field_name: fieldName,
                value_1: existingObj[fieldName as keyof typeof existingObj],
                value_2: updateData[fieldName as keyof typeof updateData],
                provider_1: 'unknown',
                provider_2: 'stratz',
                status: 'unresolved',
              });
            } catch (conflictError) {
              console.warn(`Failed to log conflict for field ${fieldName}: ${conflictError}`);
            }
          }
        }

        // Update team
        const { error } = await supabase
          .from('professional_teams')
          .update(updateData)
          .eq('id', existing.id);

        if (error) throw error;

        // Create version record
        const changedFields = detectFieldChanges(existingObj, updateData);
        if (Object.keys(changedFields.changed).length > 0) {
          try {
            const versionRecord = createVersionRecord(
              'team',
              existing.id.toString(),
              1,
              existingObj,
              updateData,
              'automated_sync',
              'Team data updated from STRATZ provider',
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
        // Create new team
        const newTeamData = {
          name: team.name,
          slug: team.id.toString(),
          region: team.region,
          logo_url: team.logoUrl,
          data_provider_id: team.id.toString(),
          last_synced_at: new Date().toISOString(),
        };

        const { data: insertedTeam, error } = await supabase
          .from('professional_teams')
          .insert(newTeamData)
          .select('id')
          .single();

        if (error) throw error;

        // Create version record
        if (insertedTeam) {
          try {
            const versionRecord = createVersionRecord(
              'team',
              insertedTeam.id.toString(),
              1,
              {},
              newTeamData,
              'automated_sync',
              'New team created from STRATZ provider',
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

          // Calculate quality score
          try {
            const completeness = calculateCompletenessScore(newTeamData, ['name', 'region', 'logo_url']);
            const freshness = calculateFreshnessScore(new Date());
            const reliability = calculateReliabilityScore({ stratz: 0.9 });
            const consistency = 1.0;

            const overallScore = (completeness * 0.3 + consistency * 0.25 + freshness * 0.2 + reliability * 0.25);

            await supabase.from('data_quality_scores').insert({
              entity_type: 'team',
              entity_id: insertedTeam.id.toString(),
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
      results.errors.push(`Failed to sync team ${team.id}: ${(error as Error).message}`);
    }
  }

  return results;
}

/**
 * Sync team rosters (which players are on which teams)
 */
async function syncTeamRosters(teams: TeamData[]): Promise<{ created: number; updated: number }> {
  const results = { created: 0, updated: 0 };
  const supabase = getSupabaseServerClient();

  for (const team of teams) {
    if (!team.roster || team.roster.length === 0) {
      continue;
    }

    // Update each player's team_id to associate with this team
    for (const player of team.roster) {
      try {
        // Get the team record
        const { data: teamRecord } = await supabase
          .from('professional_teams')
          .select('id')
          .eq('data_provider_id', team.id.toString())
          .single();

        if (!teamRecord) {
          continue;
        }

        // Update player's team association
        const { error } = await supabase
          .from('professional_players')
          .update({
            team_id: teamRecord.id,
            last_synced_at: new Date().toISOString(),
          })
          .eq('data_provider_id', player.playerId);

        if (!error) {
          results.updated++;
        }
      } catch (error) {
        // Non-critical error, continue with next player
        console.warn(`Failed to update team roster for player ${player.playerId}: ${error}`);
      }
    }
  }

  return results;
}

/**
 * Get existing teams from database
 */
async function getExistingTeams(): Promise<Map<string, ProfessionalTeam>> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('professional_teams')
    .select('*');

  if (error) {
    throw new Error(`Failed to fetch existing teams: ${error.message}`);
  }

  const teamMap = new Map<string, ProfessionalTeam>();
  for (const team of data || []) {
    if (team.data_provider_id) {
      teamMap.set(team.data_provider_id, team);
    }
  }

  return teamMap;
}

/**
 * Log job execution for tracking
 */
async function logJobExecution(
  jobName: string,
  status: 'started' | 'completed' | 'failed',
  metadata?: Record<string, unknown>,
  executionId?: string
): Promise<string> {
  const supabase = getSupabaseServerClient();

  if (executionId) {
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
