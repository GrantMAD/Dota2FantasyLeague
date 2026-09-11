/**
 * GET /api/admin/jobs/status
 * 
 * Get status of all background jobs
 * Requires admin authentication
 * 
 * Headers:
 * {
 *   "Authorization": "Bearer <JWT_TOKEN>"
 * }
 */

import { getJobs, getAllJobStatuses, healthCheck } from '@/lib/jobs/scheduler';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';
import { getSupabaseServerClient } from '@/lib/db/supabase-server';
import { getNextCronDate } from '@/lib/jobs/cron-utils';

export async function GET(request: Request) {
  try {
    // Check authentication and admin role
    await verifyAdminAuth(request);

    const jobs = getJobs();
    const memoryStatuses = getAllJobStatuses();
    const health = await healthCheck();

    // Query latest database executions for historical runs
    let dbLogs: any[] = [];
    try {
      const supabase = getSupabaseServerClient();
      const { data } = await supabase
        .from('job_execution_log')
        .select('job_name, status, started_at, completed_at, metadata, error_message')
        .order('started_at', { ascending: false })
        .limit(100);
      dbLogs = data || [];
    } catch (err) {
      console.warn('[Jobs Status] Could not fetch job_execution_log:', err);
    }

    const now = new Date();

    const enrichedJobs = jobs.map((j) => {
      const inMemory = memoryStatuses.find((s) => s.jobName === j.name);
      const latestDbRun = dbLogs.find((l) => l.job_name === j.name);

      const nextRunDate = getNextCronDate(j.schedule, now);

      const status = inMemory?.status || latestDbRun?.status || 'idle';
      const lastRun = inMemory?.startedAt
        ? inMemory.startedAt.toISOString()
        : (latestDbRun?.started_at || null);

      let duration = inMemory?.duration ?? null;
      if (duration === null && latestDbRun?.started_at && latestDbRun?.completed_at) {
        duration = Math.max(
          0,
          new Date(latestDbRun.completed_at).getTime() - new Date(latestDbRun.started_at).getTime()
        );
      }

      const metadata = inMemory?.result || latestDbRun?.metadata || null;

      return {
        name: j.name,
        schedule: j.schedule,
        enabled: j.enabled,
        timeout: j.timeout,
        status: {
          status,
          startedAt: lastRun,
          duration,
          result: metadata,
        },
        last_run: lastRun,
        last_duration_ms: duration,
        next_run: nextRunDate.toISOString(),
      };
    });

    return Response.json({
      success: true,
      health,
      jobs: enrichedJobs,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}

