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

export async function verifyAdminAuth(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  // In production, verify the JWT and check admin role
  // For now, return user ID if token exists
  try {
    // Basic validation - in production use proper JWT verification
    if (token.length > 10) {
      return 'admin-' + token.substring(0, 8);
    }
  } catch {
    return null;
  }

  return null;
}

export async function getDataConflicts(
  entityType?: 'player' | 'team' | 'tournament' | 'match',
  status: 'unresolved' | 'resolved' | 'ignored' = 'unresolved',
  limit: number = 50
): Promise<Record<string, unknown>[]> {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from('data_conflicts')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  const { data, error } = await query;

  if (error) {
    console.warn(`Failed to fetch conflicts: ${error.message}`);
    return [];
  }

  return data || [];
}

export async function resolveConflict(
  conflictId: string,
  resolvedValue: unknown,
  resolvedProvider: string,
  adminUserId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from('data_conflicts')
    .update({
      resolved_value: resolvedValue,
      resolved_provider: resolvedProvider,
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: adminUserId,
      notes,
    })
    .eq('id', conflictId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
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

export async function rollbackToVersion(
  entityType: 'player' | 'team' | 'tournament' | 'match' | 'player_stats',
  entityId: string,
  targetVersionNumber: number,
  adminUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
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

  // Create new version record for the rollback
  const { error: createError } = await supabase
    .from('data_version_history')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      version_number: targetVersionNumber + 1,
      previous_values: {}, // Current values
      new_values: versionData.previous_values, // Rolling back to these
      changed_fields: Object.keys(versionData.previous_values),
      change_reason: `Rollback to version ${targetVersionNumber}: ${reason}`,
      changed_by_user: adminUserId,
      change_source: 'manual_override',
      is_approved: true,
      approved_by: adminUserId,
      approved_at: new Date().toISOString(),
    });

  if (createError) {
    return { success: false, error: createError.message };
  }

  return { success: true };
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
): Promise<{ entities: Record<string, unknown>[]; summary: { total: number; quality_distribution: Record<string, number>; average_score: number } | null }> {
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

  // Calculate summary
  const scores = data || [];
  const qualityCounts = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
    critical: 0,
  };

  for (const score of scores) {
    if (score.overall_score > 0.9) qualityCounts.excellent++;
    else if (score.overall_score > 0.8) qualityCounts.good++;
    else if (score.overall_score > 0.7) qualityCounts.fair++;
    else if (score.overall_score > 0.5) qualityCounts.poor++;
    else qualityCounts.critical++;
  }

  return {
    entities: scores,
    summary: {
      total: scores.length,
      quality_distribution: qualityCounts,
      average_score:
        scores.reduce((sum: number, s: Record<string, unknown>) => sum + (s.overall_score as number), 0) / scores.length || 0,
    },
  };
}

export async function overrideEntityData(
  entityType: 'player' | 'team' | 'tournament' | 'match',
  entityId: string,
  overrideData: Record<string, unknown>,
  adminUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();

  // Create version record for audit trail
  const { error: versionError } = await supabase
    .from('data_version_history')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      version_number: 999, // Placeholder, should be incremented
      previous_values: {}, // Should fetch current values
      new_values: overrideData,
      changed_fields: Object.keys(overrideData),
      change_reason: reason,
      changed_by_user: adminUserId,
      change_source: 'manual_override',
      is_approved: true,
      approved_by: adminUserId,
      approved_at: new Date().toISOString(),
    });

  if (versionError) {
    return { success: false, error: versionError.message };
  }

  // Log the override
  console.log(
    `[Admin Override] ${entityType} ${entityId} by ${adminUserId}: ${reason}`
  );

  return { success: true };
}
