import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    await verifyAdminAuth(request);
    const body = await request.json().catch(() => ({}));
    const retentionDays = Math.min(3650, Math.max(1, Number(body.retentionDays ?? process.env.JOB_LOG_RETENTION_DAYS ?? 90)));
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    const supabase = supabaseServer();
    const { error } = await (supabase.from('job_execution_log') as any).delete().lt('started_at', cutoff); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (error) return NextResponse.json({ error: 'Failed to apply job log retention.' }, { status: 500 });
    return NextResponse.json({ success: true, retentionDays, deletedBefore: cutoff });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to apply job log retention.' }, { status });
  }
}
