import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createErrorResponse, verifyAdminAuth } from '@/lib/auth-utils';

interface FailedJobRecord {
  id: number;
  job_name: string;
  error_message: string | null;
  retry_count: number;
  next_retry_at: string | null;
  is_dead_letter: boolean;
  started_at: string;
}

interface LatestJobExecution {
  id: number;
  status: string;
}

/**
 * GET /api/admin/jobs/failed
 * Returns only jobs whose latest execution is still failed. Older failures
 * remain in job_execution_log as history but are no longer active alerts.
 */
export async function GET(request: Request) {
  try {
    await verifyAdminAuth(request);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { data, error } = await supabase
      .from('job_execution_log')
      .select('id, job_name, error_message, retry_count, next_retry_at, is_dead_letter, started_at')
      .eq('status', 'failed')
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching failed jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch failed jobs.' }, { status: 500 });
    }

    const failedJobs = (data || []) as FailedJobRecord[];
    const jobNames = [...new Set(failedJobs.map((job) => job.job_name))];
    const latestExecutions = await Promise.all(jobNames.map(async (jobName) => {
      const { data: latestExecution, error: latestExecutionError } = await supabase
        .from('job_execution_log')
        .select('id, status')
        .eq('job_name', jobName)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestExecutionError) {
        console.error(`Error fetching latest execution for ${jobName}:`, latestExecutionError);
      }

      return {
        jobName,
        execution: latestExecution as LatestJobExecution | null,
        error: latestExecutionError,
      };
    }));

    if (latestExecutions.some(({ error }) => error)) {
      return NextResponse.json({ error: 'Failed to check the latest job execution status.' }, { status: 500 });
    }

    const latestFailedIds = new Set(
      latestExecutions
        .map(({ execution }) => execution?.status === 'failed' ? execution.id : null)
        .filter((id): id is number => id !== null)
    );
    const activeFailures = failedJobs.filter((job) => latestFailedIds.has(job.id));

    return NextResponse.json({ failedJobs: activeFailures });
  } catch (error: unknown) {
    return createErrorResponse(error as Error);
  }
}
