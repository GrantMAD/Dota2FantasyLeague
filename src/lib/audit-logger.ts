import { supabaseServer } from '@/lib/supabase';

export interface AuditActionParams {
  tableName: string;
  recordId?: number | string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'CORRECTION' | 'CHIP_ACTIVATED' | 'TRANSFER' | 'LINEUP_CHANGE';
  changedBy?: string; // user UUID
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
}

/**
 * Writes an audit log entry for significant mutations.
 * Uses application-level logging for rich context over DB triggers.
 * This function is fire-and-forget — it logs a warning on failure but
 * never throws, so an audit failure never blocks the main operation.
 */
export async function logAuditAction(params: AuditActionParams): Promise<void> {
  try {
    const supabase = supabaseServer();
    const { error } = await (supabase.from('audit_log') as any).insert({
      table_name: params.tableName,
      record_id: params.recordId ?? null,
      action: params.action,
      changed_by: params.changedBy ?? null,
      old_values: params.oldValues ?? null,
      new_values: params.newValues ?? null,
      reason: params.reason ?? null,
    });

    if (error) {
      console.warn('[AuditLogger] Failed to write audit log entry:', error.message);
    }
  } catch (err) {
    console.warn('[AuditLogger] Unexpected error writing audit log:', err);
  }
}
