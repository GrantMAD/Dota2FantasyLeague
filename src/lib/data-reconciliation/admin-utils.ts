/**
 * Admin Data Correction API Routes
 * 
 * POST /api/admin/data/correct - Override/correct data
 * GET /api/admin/data/conflicts - List unresolved conflicts
 * GET /api/admin/data/version-history - View version history
 * GET /api/admin/data/quality - Get data quality metrics
 * GET /api/admin/data/duplicates - List potential duplicates
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import { verifyAdminAuth as verifyAdminAuthCentral } from '@/lib/auth-utils';
import { logAuditAction } from '@/lib/audit-logger';

const ENTITY_TABLE_MAP = {
  player: 'professional_players',
  team: 'professional_teams',
  tournament: 'tournaments',
  match: 'matches',
  player_stats: 'player_performances',
} as const;

type VersionedEntityType = keyof typeof ENTITY_TABLE_MAP;

const NON_UPDATABLE_FIELDS = new Set(['id', 'created_at', 'updated_at']);

const SAFE_CONFLICT_AUDIT_FIELDS = new Set([
  'name', 'country', 'tier', 'status', 'team_id', 'season_id', 'gameweek_id',
  'series_id', 'tournament_id', 'winner_id', 'score', 'scheduled_time',
  'is_enabled', 'value', 'starting_budget', 'max_players_per_team', 'squad_size',
  'starters_required', 'bench_size', 'is_international_break',
]);

function safeConflictAuditValue(fieldName: string, value: unknown): unknown {
  if (!SAFE_CONFLICT_AUDIT_FIELDS.has(fieldName)) return undefined;
  if (typeof value === 'string') return value.length <= 100 ? value : value.slice(0, 100);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  return undefined;
}

export async function verifyAdminAuth(request: Request): Promise<string | null> {
  try {
    const userId = await verifyAdminAuthCentral(request);
    return userId;
  } catch {
    return null;
  }
}

export async function getDataConflicts(
  entityType?: 'player' | 'team' | 'tournament' | 'match',
  status: 'unresolved' | 'resolved' | 'ignored' | 'all' = 'all',
  limit: number = 50
): Promise<Record<string, unknown>[]> {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from('data_conflicts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query;

  if (error) {
    console.warn(`Failed to fetch conflicts: ${error.message}`);
    return [];
  }

  const conflicts = data || [];
  if (conflicts.length === 0) return [];

  // Group entity IDs by entity_type to batch-fetch names
  const teamIds = new Set<string>();
  const playerIds = new Set<string>();

  for (const c of conflicts) {
    if (c.entity_type === 'team' && c.entity_id) teamIds.add(String(c.entity_id));
    if (c.entity_type === 'player' && c.entity_id) playerIds.add(String(c.entity_id));
  }

  const teamNameMap = new Map<string, string>();
  const playerNameMap = new Map<string, string>();

  if (teamIds.size > 0) {
    try {
      const { data: teams } = await supabase
        .from('professional_teams')
        .select('id, name')
        .in('id', Array.from(teamIds));
      if (teams) {
        for (const t of teams) {
          teamNameMap.set(String(t.id), t.name);
        }
      }
    } catch (e) {
      console.warn('Failed to load team names for conflicts:', e);
    }
  }

  if (playerIds.size > 0) {
    try {
      const { data: players } = await supabase
        .from('professional_players')
        .select('id, name')
        .in('id', Array.from(playerIds));
      if (players) {
        for (const p of players) {
          playerNameMap.set(String(p.id), p.name);
        }
      }
    } catch (e) {
      console.warn('Failed to load player names for conflicts:', e);
    }
  }

  return conflicts.map((c: Record<string, unknown>) => ({
    ...c,
    entity_name:
      c.entity_type === 'team'
        ? teamNameMap.get(String(c.entity_id))
        : c.entity_type === 'player'
        ? playerNameMap.get(String(c.entity_id))
        : undefined,
  }));
}

export async function resolveConflict(
  conflictId: string,
  resolvedValue: unknown,
  resolvedProvider: string,
  adminUserId: string,
  notes?: string,
  status: 'resolved' | 'ignored' = 'resolved',
  applyToEntity: boolean = true
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();

  // Fetch the conflict record to get entity type, id, and field
  const { data: conflict, error: fetchError } = await supabase
    .from('data_conflicts')
    .select('*')
    .eq('id', conflictId)
    .single();

  if (fetchError || !conflict) {
    return { success: false, error: fetchError?.message || 'Conflict not found' };
  }

  const updatePayload: Record<string, unknown> = {
    status,
    resolved_at: new Date().toISOString(),
    resolved_by: adminUserId,
    notes: notes !== undefined ? notes : conflict.notes,
  };

  if (status === 'resolved') {
    updatePayload.resolved_value = resolvedValue;
    updatePayload.resolved_provider = resolvedProvider;
  }

  const { error } = await supabase
    .from('data_conflicts')
    .update(updatePayload)
    .eq('id', conflictId);

  if (error) {
    return { success: false, error: error.message };
  }

  let appliedEntityValues: { oldValue?: unknown; newValue?: unknown } | null = null;
  let entityWasApplied = false;
  // If requested and status is resolved, also update the entity table directly
  if (applyToEntity && status === 'resolved' && conflict.entity_type && conflict.entity_id && conflict.field_name) {
    const tableName = ENTITY_TABLE_MAP[conflict.entity_type as VersionedEntityType];
    if (tableName) {
      try {
        let oldValue: unknown;
        if (SAFE_CONFLICT_AUDIT_FIELDS.has(conflict.field_name)) {
          const { data: entity } = await supabase
            .from(tableName)
            .select(conflict.field_name)
            .eq('id', conflict.entity_id)
            .maybeSingle();
          oldValue = entity?.[conflict.field_name];
        }

        const { data: updatedEntity, error: applyError } = await supabase
          .from(tableName)
          .update({
            [conflict.field_name]: resolvedValue,
            updated_at: new Date().toISOString(),
          })
          .eq('id', conflict.entity_id)
          .select(conflict.field_name)
          .maybeSingle();
        if (applyError) throw applyError;
        if (updatedEntity) {
          entityWasApplied = true;
          appliedEntityValues = {
            oldValue: safeConflictAuditValue(conflict.field_name, oldValue),
            newValue: safeConflictAuditValue(conflict.field_name, updatedEntity[conflict.field_name] ?? resolvedValue),
          };
        }
      } catch (applyErr) {
        console.warn(`[resolveConflict] Failed to apply resolution to ${tableName}.${conflict.field_name}:`, applyErr);
      }
    }
  }

  const conflictRecordId = Number.isInteger(Number(conflictId)) ? Number(conflictId) : undefined;
  const safeResolvedValue = status === 'resolved'
    ? safeConflictAuditValue(conflict.field_name, resolvedValue)
    : undefined;
  const safeOldResolvedValue = safeConflictAuditValue(conflict.field_name, conflict.resolved_value);
  await logAuditAction({
    tableName: 'data_conflicts',
    recordId: conflictRecordId,
    action: status === 'resolved' ? 'CORRECTION' : 'UPDATE',
    changedBy: adminUserId,
    oldValues: {
      conflict_id: conflictId,
      status: conflict.status,
      resolved_provider: conflict.resolved_provider,
      ...(safeOldResolvedValue !== undefined ? { resolved_value: safeOldResolvedValue } : {}),
    },
    newValues: {
      conflict_id: conflictId,
      entity_type: conflict.entity_type,
      entity_id: conflict.entity_id,
      field_name: conflict.field_name,
      status,
      resolved_provider: status === 'resolved' ? resolvedProvider : conflict.resolved_provider,
      apply_to_entity: entityWasApplied,
      ...(safeResolvedValue !== undefined ? { resolved_value: safeResolvedValue } : {}),
    },
    reason: status === 'resolved' ? 'Admin resolved a data conflict' : 'Admin ignored a data conflict',
  });

  if (appliedEntityValues) {
    const entityId = String(conflict.entity_id);
    const numericEntityId = Number(entityId);
    await logAuditAction({
      tableName: ENTITY_TABLE_MAP[conflict.entity_type as VersionedEntityType] ?? 'matches',
      recordId: Number.isInteger(numericEntityId) ? numericEntityId : undefined,
      action: 'CORRECTION',
      changedBy: adminUserId,
      oldValues: {
        ...(appliedEntityValues.oldValue !== undefined ? { [conflict.field_name]: appliedEntityValues.oldValue } : {}),
        ...(Number.isInteger(numericEntityId) ? {} : { entity_id: entityId }),
      },
      newValues: {
        ...(appliedEntityValues.newValue !== undefined ? { [conflict.field_name]: appliedEntityValues.newValue } : {}),
        ...(Number.isInteger(numericEntityId) ? {} : { entity_id: entityId }),
        conflict_id: conflictId,
      },
      reason: 'Admin applied a data conflict resolution to its entity',
    });
  }

  return { success: true };
}

export async function ignoreAllConflicts(
  adminUserId: string,
  entityType?: 'player' | 'team' | 'tournament' | 'match',
  notes: string = 'Bulk ignored by admin'
): Promise<{ success: boolean; count?: number; error?: string }> {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from('data_conflicts')
    .update({
      status: 'ignored',
      resolved_at: new Date().toISOString(),
      resolved_by: adminUserId,
      notes,
    })
    .eq('status', 'unresolved');

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query.select('id');

  if (error) {
    return { success: false, error: error.message };
  }

  await logAuditAction({
    tableName: 'data_conflicts',
    action: 'UPDATE',
    changedBy: adminUserId,
    oldValues: { status: 'unresolved', entity_type: entityType ?? 'all' },
    newValues: { status: 'ignored', entity_type: entityType ?? 'all', count: data?.length ?? 0 },
    reason: 'Admin ignored unresolved data conflicts in bulk',
  });

  return { success: true, count: data?.length ?? 0 };
}

export async function getVersionHistory(
  entityType: 'player' | 'team' | 'tournament' | 'match' | 'player_stats',
  entityId: string,
  limit: number = 20
): Promise<Record<string, unknown>[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('data_version_history')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('version_number', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(`Failed to fetch version history: ${error.message}`);
    return [];
  }

  return data || [];
}

async function getNextVersionNumber(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  entityType: VersionedEntityType,
  entityId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('data_version_history')
    .select('version_number')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch latest version number: ${error.message}`);
  }

  return (Number(data?.version_number) || 0) + 1;
}

/**
 * Applies a field-level update to an entity table and records the previous/new
 * values as an incremented version entry plus audit log record.
 */
async function applyVersionedEntityUpdate(params: {
  entityType: VersionedEntityType;
  entityId: string;
  updates: Record<string, unknown>;
  adminUserId: string;
  versionReason: string;
  auditReason: string;
  emptyUpdatesError: string;
}): Promise<{ success: boolean; versionNumber?: number; error?: string }> {
  const {
    entityType,
    entityId,
    updates,
    adminUserId,
    versionReason,
    auditReason,
    emptyUpdatesError,
  } = params;
  const tableName = ENTITY_TABLE_MAP[entityType];
  if (!tableName) {
    return { success: false, error: `Unsupported entity type: ${entityType}` };
  }

  const fields = Object.keys(updates).filter(
    (field) => !NON_UPDATABLE_FIELDS.has(field) && updates[field] !== undefined
  );
  if (fields.length === 0) {
    return { success: false, error: emptyUpdatesError };
  }

  const supabase = getSupabaseServerClient();
  const { data: currentEntity, error: fetchError } = await supabase
    .from(tableName)
    .select(fields.join(', '))
    .eq('id', entityId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }
  if (!currentEntity) {
    return { success: false, error: `${entityType} ${entityId} not found` };
  }

  const currentRow = currentEntity as Record<string, unknown>;
  const previousValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  const changedFields: string[] = [];

  for (const field of fields) {
    const oldVal = currentRow[field] ?? null;
    const newVal = updates[field];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      previousValues[field] = oldVal;
      newValues[field] = newVal;
      changedFields.push(field);
    }
  }

  if (changedFields.length === 0) {
    return { success: true };
  }

  let nextVersion: number;
  try {
    nextVersion = await getNextVersionNumber(supabase, entityType, entityId);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to determine next version number',
    };
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from(tableName)
    .update({
      ...newValues,
      updated_at: nowIso,
    })
    .eq('id', entityId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  const { error: versionError } = await supabase
    .from('data_version_history')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      version_number: nextVersion,
      previous_values: previousValues,
      new_values: newValues,
      changed_fields: changedFields,
      change_reason: versionReason,
      changed_by_user: adminUserId,
      change_source: 'manual_override',
      is_approved: true,
      approved_by: adminUserId,
      approved_at: nowIso,
    });

  if (versionError) {
    return { success: false, error: versionError.message };
  }

  const numericEntityId = Number(entityId);
  await logAuditAction({
    tableName,
    recordId: Number.isInteger(numericEntityId) ? numericEntityId : undefined,
    action: 'CORRECTION',
    changedBy: adminUserId,
    oldValues: previousValues,
    newValues,
    reason: auditReason,
  });

  return { success: true, versionNumber: nextVersion };
}

export async function rollbackToVersion(
  entityType: 'player' | 'team' | 'tournament' | 'match' | 'player_stats',
  entityId: string,
  targetVersionNumber: number,
  adminUserId: string,
  reason: string
): Promise<{ success: boolean; versionNumber?: number; error?: string }> {
  const supabase = getSupabaseServerClient();

  // Get the target version
  const { data: versionData, error: versionError } = await supabase
    .from('data_version_history')
    .select('previous_values')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('version_number', targetVersionNumber)
    .single();

  if (versionError || !versionData) {
    return { success: false, error: 'Version not found' };
  }

  const previousValues = versionData.previous_values;
  if (!previousValues || typeof previousValues !== 'object' || Array.isArray(previousValues)) {
    return { success: false, error: 'Target version has no previous values to restore' };
  }

  return applyVersionedEntityUpdate({
    entityType,
    entityId,
    updates: previousValues as Record<string, unknown>,
    adminUserId,
    versionReason: `Rollback to version ${targetVersionNumber}: ${reason}`,
    auditReason: `Admin rolled back ${entityType} to version ${targetVersionNumber}`,
    emptyUpdatesError: 'Target version has no previous values to restore',
  });
}

export async function approveVersion(
  versionId: string,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from('data_version_history')
    .update({
      is_approved: true,
      approved_by: adminUserId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', versionId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getDeduplicationMatches(
  entityType?: 'player' | 'team' | 'tournament' | 'match',
  status: 'pending_review' | 'approved' | 'rejected' | 'merged' = 'pending_review',
  limit: number = 50
): Promise<Record<string, unknown>[]> {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from('deduplication_matches')
    .select('*')
    .eq('status', status)
    .order('match_confidence', { ascending: false })
    .limit(limit);

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query;

  if (error) {
    console.warn(`Failed to fetch deduplication matches: ${error.message}`);
    return [];
  }

  return data || [];
}

export async function resolveDuplication(
  matchId: string,
  decision: 'approve' | 'reject' | 'merge',
  adminUserId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();

  const status =
    decision === 'approve' ? 'merged' : decision === 'reject' ? 'rejected' : 'merged';

  const { error } = await supabase
    .from('deduplication_matches')
    .update({
      status,
      merged_by: adminUserId,
      merged_at: new Date().toISOString(),
      notes,
    })
    .eq('id', matchId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getDataQualityMetrics(
  entityType?: 'player' | 'team' | 'tournament' | 'match',
  limit: number = 100
): Promise<{
  entities: Record<string, unknown>[];
  overall_score?: number;
  completeness_score?: number;
  consistency_score?: number;
  freshness_score?: number;
  reliability_score?: number;
  issues?: string[];
  summary: { total: number; quality_distribution: Record<string, number>; average_score: number } | null;
}> {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from('data_quality_scores')
    .select('*')
    .order('overall_score', { ascending: true })
    .limit(limit);

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query;

  if (error) {
    console.warn(`Failed to fetch quality metrics: ${error.message}`);
    return { entities: [], summary: null };
  }

  // Calculate summary and overall dimensional averages
  const scores = (data || []) as Array<{
    overall_score?: number;
    completeness_score?: number;
    consistency_score?: number;
    freshness_score?: number;
    reliability_score?: number;
    issues?: string[];
    entity_type?: string;
    entity_id?: string;
  }>;

  const qualityCounts = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
    critical: 0,
  };

  const allIssues: string[] = [];

  for (const score of scores) {
    const oScore = Number(score.overall_score) || 0;
    if (oScore > 0.9) qualityCounts.excellent++;
    else if (oScore > 0.8) qualityCounts.good++;
    else if (oScore > 0.7) qualityCounts.fair++;
    else if (oScore > 0.5) qualityCounts.poor++;
    else qualityCounts.critical++;

    if (Array.isArray(score.issues)) {
      allIssues.push(...score.issues);
    }
  }

  // Check if there is an explicit global/system score row
  const systemRow = scores.find((s) => s.entity_type === 'system' && s.entity_id === 'global');

  const count = scores.length || 1;
  const avg = (key: 'overall_score' | 'completeness_score' | 'consistency_score' | 'freshness_score' | 'reliability_score') => {
    if (systemRow && systemRow[key] !== undefined && systemRow[key] !== null) {
      return Number(systemRow[key]);
    }
    const sum = scores.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);
    return Math.round((sum / count) * 100) / 100;
  };

  return {
    entities: scores,
    overall_score: avg('overall_score'),
    completeness_score: avg('completeness_score'),
    consistency_score: avg('consistency_score'),
    freshness_score: avg('freshness_score'),
    reliability_score: avg('reliability_score'),
    issues: allIssues,
    summary: {
      total: scores.length,
      quality_distribution: qualityCounts,
      average_score: avg('overall_score'),
    },
  };
}

export async function overrideEntityData(
  entityType: 'player' | 'team' | 'tournament' | 'match',
  entityId: string,
  overrideData: Record<string, unknown>,
  adminUserId: string,
  reason: string
): Promise<{ success: boolean; versionNumber?: number; error?: string }> {
  const result = await applyVersionedEntityUpdate({
    entityType,
    entityId,
    updates: overrideData,
    adminUserId,
    versionReason: reason,
    auditReason: 'Admin manually overrode entity data',
    emptyUpdatesError: 'No updatable override fields provided',
  });

  if (result.success) {
    console.log(
      `[Admin Override] ${entityType} ${entityId} by ${adminUserId}: ${reason}`
    );
  }

  return result;
}
