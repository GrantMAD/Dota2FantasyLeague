import { createClient } from '@supabase/supabase-js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5000; // 5 seconds base, doubles each retry

export interface JobRunResult {
  success: boolean;
  errors: string[];
  duration: number;
  [key: string]: unknown;
}

/**
 * Wraps a background job execution with:
 * - Automatic logging to job_execution_log
 * - Exponential backoff retry on failure
 * - Dead-letter state after MAX_RETRIES exhausted
 */
export async function runJobWithRetry(
  jobName: string,
  jobFn: () => Promise<JobRunResult>
): Promise<JobRunResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const startedAt = new Date();

  // Check if there is a failed job ready to retry
  const { data: existingJob } = await (supabase
    .from('job_execution_log') as any)
    .select('id, retry_count')
    .eq('job_name', jobName)
    .eq('status', 'failed')
    .eq('is_dead_letter', false)
    .lte('next_retry_at', new Date().toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const retryCount = existingJob?.retry_count ?? 0;

  // Create a new log entry for this execution
  const { data: logEntry } = await (supabase
    .from('job_execution_log') as any)
    .insert({
      job_name: jobName,
      status: 'running',
      started_at: startedAt.toISOString(),
      retry_count: retryCount,
    })
    .select('id')
    .single();

  const logId = logEntry?.id;

  try {
    const result = await jobFn();
    const completedAt = new Date();

    // Mark the job as completed
    if (logId) {
      await (supabase.from('job_execution_log') as any).update({
        status: result.success ? 'completed' : 'failed',
        completed_at: completedAt.toISOString(),
        metadata: { ...result },
        error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
      }).eq('id', logId);
    }

    return result;
  } catch (err: any) {
    const completedAt = new Date();
    const newRetryCount = retryCount + 1;
    const isDeadLetter = newRetryCount >= MAX_RETRIES;

    // Exponential backoff: 5s, 10s, 20s
    const backoffMs = BASE_DELAY_MS * Math.pow(2, newRetryCount - 1);
    const nextRetryAt = isDeadLetter
      ? null
      : new Date(completedAt.getTime() + backoffMs).toISOString();

    const errorMessage = err?.message || 'Unknown error';

    if (logId) {
      await (supabase.from('job_execution_log') as any).update({
        status: 'failed',
        completed_at: completedAt.toISOString(),
        error_message: errorMessage,
        error_details: { stack: err?.stack, name: err?.name },
        retry_count: newRetryCount,
        next_retry_at: nextRetryAt,
        is_dead_letter: isDeadLetter,
      }).eq('id', logId);
    }

    console.error(`[JobRunner] ${jobName} failed (attempt ${newRetryCount}/${MAX_RETRIES}): ${errorMessage}`);
    if (isDeadLetter) {
      console.error(`[JobRunner] ${jobName} moved to dead-letter after ${MAX_RETRIES} attempts.`);
    }

    return {
      success: false,
      errors: [errorMessage],
      duration: completedAt.getTime() - startedAt.getTime(),
    };
  }
}
