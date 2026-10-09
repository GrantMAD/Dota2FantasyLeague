import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { logAuditAction } from '@/lib/audit-logger';
import { withApiTelemetry } from '@/lib/api-telemetry';


async function postHandler(request: NextRequest) {
  try {
    const adminId = await verifyAdminAuth(request);
    const body = await request.json().catch(() => ({}));
    const retentionDays = Math.min(3650, Math.max(1, Number(body.retentionDays ?? process.env.JOB_LOG_RETENTION_DAYS ?? 90)));
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    const supabase = supabaseServer();
    const jobExecutionLog = supabase.from('job_execution_log') as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const { count, error } = await jobExecutionLog
      .delete({ count: 'exact' })
      .lt('started_at', cutoff)
      .select('id');
    if (error) return NextResponse.json({ error: 'Failed to apply job log retention.' }, { status: 500 });
    await logAuditAction({
      tableName: 'job_execution_log',
      action: 'DELETE',
      changedBy: adminId,
      oldValues: { started_before: cutoff },
      newValues: { retention_days: retentionDays, deleted_count: count ?? null },
      reason: 'Admin applied background-job log retention',
    });
    return NextResponse.json({ success: true, retentionDays, deletedBefore: cutoff });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to apply job log retention.' }, { status });
  }
}

export const POST = withApiTelemetry('POST', '/api/admin/jobs/retention', postHandler);
