import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth-utils';
import { getAllJobStatuses, getJobs, healthCheck } from '@/lib/jobs/scheduler';
import { getCacheStats } from '@/lib/response-cache';
import { supabaseServer } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    await verifyAdminAuth(request);
    const supabase = supabaseServer();
    const [{ data: recentRuns, error: runError }, health] = await Promise.all([
      (supabase.from('job_execution_log') as any)
        .select('job_name, status, started_at, completed_at, error_message, metadata')
        .order('started_at', { ascending: false })
        .limit(100),
      healthCheck(),
    ]);

    if (runError) return NextResponse.json({ error: 'Failed to load observability data.' }, { status: 500 });
    const runs = recentRuns ?? [];
    const durations: number[] = runs
      .map((run: { metadata?: { duration_ms?: number } }) => Number(run.metadata?.duration_ms ?? 0))
      .filter((duration: number) => duration > 0);
    const failures = runs.filter((run: { status: string }) => run.status === 'failed').length;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      health,
      summary: {
        configuredJobs: getJobs().length,
        runningJobs: getAllJobStatuses().filter((job) => job.status === 'running').length,
        recentRuns: runs.length,
        recentFailures: failures,
        averageDurationMs: durations.length ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length) : 0,
      },
      recentRuns: runs,
      cache: getCacheStats(),
    });
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status: number }).status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load observability data.' }, { status });
  }
}
