/**
 * Auto-Resolve Conflicts Job
 *
 * Processes all unresolved data_conflicts rows and automatically resolves
 * those where one provider has significantly higher confidence than the other.
 * Applies the resolved value directly to the entity table (professional_players
 * or professional_teams) and marks the conflict row as resolved.
 *
 * Safe to run repeatedly — only touches rows with status = 'unresolved'.
 *
 * Run schedule: After each sync-teams / sync-players job (scheduled every hour).
 * Can also be triggered manually from Admin > Data Jobs.
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import {
  resolveConflict,
  PROVIDER_PRECEDENCE,
  FIELD_CONFIDENCE,
  type DataProvider,
} from '@/lib/data-reconciliation/conflict-resolution';

export interface AutoResolveResult {
  resolved: number;
  skipped: number;
  errors: string[];
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

/**
 * Map a raw provider string from data_conflicts to a valid DataProvider.
 * The sync jobs write 'database' as provider_1 — we treat this as the lowest-
 * precedence source (below opendota and stratz), so the external provider wins.
 */
function toDataProvider(raw: string): DataProvider {
  if (raw === 'opendota' || raw === 'stratz' || raw === 'manual_override') return raw;
  // 'database' or anything unknown → treat as stratz (lowest external precedence)
  // so the other provider side always wins in a head-to-head comparison.
  return 'stratz';
}

/**
 * Fields that are safe to auto-resolve without admin sign-off.
 * High-confidence fields where one provider is reliably more accurate.
 */
const AUTO_RESOLVABLE_FIELDS = new Set([
  'profile_image_url',
  'name',
  'in_game_name',
  'country',
  'team_id',
  'logo_url',
  'region',
]);

/**
 * Minimum confidence delta required to auto-resolve.
 * If both providers have similar confidence we leave it for manual review.
 */
const MIN_CONFIDENCE_DELTA = 0.03;

/**
 * Apply the resolved value to the correct entity table row.
 */
async function applyResolution(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  entityType: string,
  entityId: string,
  fieldName: string,
  resolvedValue: unknown,
): Promise<void> {
  const table =
    entityType === 'player' ? 'professional_players' :
    entityType === 'team'   ? 'professional_teams'   :
    null;

  if (!table) return; // tournaments / matches — skip for now

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from(table) as any)
    .update({ [fieldName]: resolvedValue, last_synced_at: new Date().toISOString() })
    .eq('id', Number(entityId));

  if (error) throw new Error(`Failed to apply resolution to ${table}:${entityId}: ${error.message}`);
}

export async function autoResolveConflicts(): Promise<AutoResolveResult> {
  const startedAt = new Date();
  const result: AutoResolveResult = {
    resolved: 0,
    skipped: 0,
    errors: [],
    duration: 0,
    startedAt,
    completedAt: new Date(),
  };

  const supabase = getSupabaseServerClient();
  console.log('[autoResolveConflicts] Starting conflict auto-resolution...');

  const jobExecutionId = await logJobExecution('auto-resolve-conflicts', 'started');

  try {
    // Fetch all unresolved conflicts in one query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conflicts, error: fetchErr } = await (supabase.from('data_conflicts') as any)
      .select('*')
      .eq('status', 'unresolved')
      .order('created_at', { ascending: true });

    if (fetchErr) throw new Error(`Failed to fetch conflicts: ${fetchErr.message}`);

    const rows = (conflicts ?? []) as Array<{
      id: string;
      entity_type: string;
      entity_id: string;
      field_name: string;
      value_1: unknown;
      value_2: unknown;
      provider_1: string;
      provider_2: string;
    }>;

    console.log(`[autoResolveConflicts] Found ${rows.length} unresolved conflicts`);

    const nowIso = new Date().toISOString();

    for (const conflict of rows) {
      try {
        // Skip fields we don't auto-resolve
        if (!AUTO_RESOLVABLE_FIELDS.has(conflict.field_name)) {
          result.skipped++;
          continue;
        }

        const p1 = toDataProvider(conflict.provider_1);
        const p2 = toDataProvider(conflict.provider_2);

        // Get confidence for each side
        const fieldConf = FIELD_CONFIDENCE[conflict.field_name];
        const conf1 = fieldConf?.[p1] ?? (((PROVIDER_PRECEDENCE[p1] ?? 0) / 3) * 0.9);
        const conf2 = fieldConf?.[p2] ?? (((PROVIDER_PRECEDENCE[p2] ?? 0) / 3) * 0.9);

        // When provider_1 is 'database' (written by sync jobs), we treat it as
        // lowest precedence so the external provider value always wins, which is
        // correct — the sync job is bringing in fresher authoritative data.
        const isDatabaseVsProvider =
          conflict.provider_1 === 'database' &&
          (conflict.provider_2 === 'opendota' || conflict.provider_2 === 'stratz');

        const delta = Math.abs(conf1 - conf2);
        const canAutoResolve = isDatabaseVsProvider || delta >= MIN_CONFIDENCE_DELTA;

        if (!canAutoResolve) {
          result.skipped++;
          continue;
        }

        // Determine the winner
        const { resolvedValue, resolvedProvider } = resolveConflict(
          conflict.value_1,
          p1,
          conflict.value_2,
          p2,
          conflict.field_name,
        );

        // For 'database' vs provider: provider always wins (the whole point of syncing)
        const finalValue = isDatabaseVsProvider ? conflict.value_2 : resolvedValue;
        const finalProvider = isDatabaseVsProvider ? p2 : resolvedProvider;

        // Apply to entity table
        await applyResolution(supabase, conflict.entity_type, conflict.entity_id, conflict.field_name, finalValue);

        // Mark conflict as resolved
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('data_conflicts') as any)
          .update({
            status: 'resolved',
            resolved_value: finalValue,
            resolved_provider: finalProvider,
            resolved_at: nowIso,
            notes: 'Auto-resolved: provider_precedence',
          })
          .eq('id', conflict.id);

        result.resolved++;
        console.log(
          `[autoResolveConflicts] Resolved ${conflict.entity_type}:${conflict.entity_id} ` +
          `field=${conflict.field_name} → provider=${finalProvider}`,
        );
      } catch (conflictErr) {
        const msg = `Conflict ${conflict.id} (${conflict.entity_type}:${conflict.field_name}): ${(conflictErr as Error).message}`;
        result.errors.push(msg);
        console.warn(`[autoResolveConflicts] ${msg}`);
      }
    }

    await logJobExecution('auto-resolve-conflicts', 'completed', {
      resolved: result.resolved,
      skipped: result.skipped,
      errors: result.errors.length,
    }, jobExecutionId);

    console.log(
      `[autoResolveConflicts] Done: ${result.resolved} resolved, ${result.skipped} skipped, ${result.errors.length} errors`,
    );
  } catch (err) {
    const msg = (err as Error).message;
    console.error('[autoResolveConflicts] Fatal error:', msg);
    result.errors.push(msg);
    await logJobExecution('auto-resolve-conflicts', 'failed', { error: msg }, jobExecutionId);
  }

  result.completedAt = new Date();
  result.duration = result.completedAt.getTime() - result.startedAt.getTime();
  return result;
}

async function logJobExecution(
  jobName: string,
  status: 'started' | 'completed' | 'failed',
  metadata?: Record<string, unknown>,
  executionId?: string,
): Promise<string> {
  const supabase = getSupabaseServerClient();
  const isUuid = executionId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(executionId);

  if (isUuid) {
    await supabase.from('job_execution_log').update({ status, completed_at: new Date().toISOString(), metadata }).eq('id', executionId);
    return executionId;
  }

  const { data } = await supabase
    .from('job_execution_log')
    .insert({ job_name: jobName, status, started_at: new Date().toISOString(), metadata })
    .select('id')
    .single();

  return data?.id || `job-${Date.now()}`;
}
