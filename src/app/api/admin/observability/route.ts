import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth-utils';
import { getJobs } from '@/lib/jobs/scheduler';
import { buildDurableJobHealth, type DurableJobRun } from '@/lib/jobs/durable-job-health';
import { getCacheStats } from '@/lib/response-cache';
import { supabaseServer } from '@/lib/supabase';

interface JobRunRow {
  job_name: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metadata: { duration_ms?: number } | null;
}

export async function GET(request: NextRequest) {
  try {
    await verifyAdminAuth(request);
    const supabase = supabaseServer();
    const jobs = getJobs();
    const [recentResult, latestResults] = await Promise.all([
      supabase.from('job_execution_log')
        .select('job_name, status, started_at, completed_at, error_message, metadata')
        .order('started_at', { ascending: false })
        .limit(100),
      Promise.all(jobs.map((job) => supabase.from('job_execution_log')
        .select('job_name, status, started_at, completed_at, error_message')
        .eq('job_name', job.name)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle())),
    ]);

    const failedLatestQuery = latestResults.find((result) => result.error);
    if (recentResult.error || failedLatestQuery?.error) {
      return NextResponse.json({ error: 'Failed to load durable observability data.' }, { status: 500 });
    }
    const runs = (recentResult.data ?? []) as JobRunRow[];
    const latestRuns = latestResults
      .map((result) => result.data)
      .filter((run): run is NonNullable<typeof run> => run !== null) as DurableJobRun[];
    const health = buildDurableJobHealth(
      jobs.map(({ name, schedule, enabled }) => ({ name, schedule, enabled })),
      latestRuns,
    );
    const durations: number[] = runs
      .map((run) => Number(run.metadata?.duration_ms ?? 0))
      .filter((duration: number) => duration > 0);
    const failures = runs.filter((run) => run.status === 'failed').length;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      health,
      summary: {
        configuredJobs: jobs.length,
        enabledJobs: jobs.filter((job) => job.enabled).length,
        runningJobs: health.runningJobs.length,
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
