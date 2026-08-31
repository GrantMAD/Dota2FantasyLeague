/**
 * Job Scheduler
 * 
 * Manages scheduling and execution of all background jobs
 * Can be triggered via:
 * - Vercel Cron functions (production)
 * - API endpoints (manual/testing)
 * - External job runner (scalable deployment)
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';

import { syncPlayers } from './sync-players';
import { syncTeams } from './sync-teams';
import { discoverTournaments } from './discover-tournaments';
import { fetchMatches } from './fetch-matches';
import { fetchMatchDetails } from './fetch-match-details';
import { trackRosterChanges } from './track-roster-changes';

type JobName =
  | 'sync-players'
  | 'sync-teams'
  | 'discover-tournaments'
  | 'fetch-matches'
  | 'fetch-match-details'
  | 'track-roster-changes';

interface JobDefinition {
  name: JobName;
  schedule: string; // Cron-like format
  handler: () => Promise<unknown>;
  enabled: boolean;
  timeout: number; // milliseconds
}

interface JobResult {
  jobName: JobName;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  result?: unknown;
  error?: string;
  duration?: number;
}

const JOBS: JobDefinition[] = [
  {
    name: 'sync-players',
    schedule: '0 3 * * *', // Daily at 3 AM UTC
    handler: syncPlayers,
    enabled: process.env.ENABLE_PLAYER_SYNC !== 'false',
    timeout: 10 * 60 * 1000, // 10 minutes
  },
  {
    name: 'sync-teams',
    schedule: '15 3 * * *', // Daily at 3:15 AM UTC
    handler: syncTeams,
    enabled: process.env.ENABLE_TEAM_SYNC !== 'false',
    timeout: 10 * 60 * 1000,
  },
  {
    name: 'discover-tournaments',
    schedule: '0 */6 * * *', // Every 6 hours
    handler: discoverTournaments,
    enabled: process.env.ENABLE_TOURNAMENT_DISCOVERY !== 'false',
    timeout: 5 * 60 * 1000,
  },
  {
    name: 'fetch-matches',
    schedule: '0 * * * *', // Every hour
    handler: fetchMatches,
    enabled: process.env.ENABLE_MATCH_FETCH !== 'false',
    timeout: 10 * 60 * 1000,
  },
  {
    name: 'fetch-match-details',
    schedule: '*/30 * * * *', // Every 30 minutes
    handler: fetchMatchDetails,
    enabled: process.env.ENABLE_MATCH_DETAILS !== 'false',
    timeout: 15 * 60 * 1000,
  },
  {
    name: 'track-roster-changes',
    schedule: '0 2 * * *', // Daily at 2 AM UTC
    handler: trackRosterChanges,
    enabled: process.env.ENABLE_ROSTER_TRACKING !== 'false',
    timeout: 5 * 60 * 1000,
  },
];

const runningJobs = new Map<JobName, JobResult>();
const jobHistory: JobResult[] = [];
const MAX_JOB_HISTORY = 50;
const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000;

async function persistJobExecution(result: JobResult): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const jobExecutionTable = supabase.from('job_execution_log') as unknown as {
      insert: (row: Record<string, unknown>) => Promise<{ error: unknown | null }>;
    };

    const { error } = await jobExecutionTable.insert({
      job_name: result.jobName,
      status: result.status,
      started_at: result.startedAt.toISOString(),
      completed_at: result.completedAt ? result.completedAt.toISOString() : null,
      metadata: {
        duration_ms: result.duration ?? null,
        result: result.result ?? null,
      },
      error_message: result.error ?? null,
    });

    if (error) {
      console.warn(`[Scheduler] Failed to persist job history for ${result.jobName}:`, error);
    }
  } catch (error) {
    console.warn(`[Scheduler] Job history persistence unavailable for ${result.jobName}:`, error);
  }
}

async function maybeDispatchAlert(result: JobResult): Promise<void> {
  if (result.status !== 'failed') {
    return;
  }

  const webhookUrl = process.env.JOB_ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        event: 'job_failed',
        jobName: result.jobName,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
        duration: result.duration,
        error: result.error,
      }),
    });
  } catch (error) {
    console.warn(`[Scheduler] Failed to dispatch alert for ${result.jobName}:`, error);
  }
}

function recordJobHistory(result: JobResult): void {
  jobHistory.unshift(result);

  if (jobHistory.length > MAX_JOB_HISTORY) {
    jobHistory.length = MAX_JOB_HISTORY;
  }
}

/**
 * Get all job definitions
 */
export function getJobs(): JobDefinition[] {
  return JOBS;
}

/**
 * Get enabled jobs only
 */
export function getEnabledJobs(): JobDefinition[] {
  return JOBS.filter(job => job.enabled);
}

/**
 * Get job status
 */
export function getJobStatus(jobName: JobName): JobResult | undefined {
  return runningJobs.get(jobName);
}

/**
 * Get all job statuses
 */
export function getAllJobStatuses(): JobResult[] {
  return Array.from(runningJobs.values());
}

/**
 * Run a specific job by name
 * Returns a promise that resolves when job completes
 */
export async function runJob(jobName: JobName): Promise<JobResult> {
  const jobDef = JOBS.find(j => j.name === jobName);

  if (!jobDef) {
    throw new Error(`Unknown job: ${jobName}`);
  }

  // Check if already running
  const existing = runningJobs.get(jobName);
  if (existing && existing.status === 'running') {
    console.log(`[Scheduler] Job ${jobName} already running, skipping`);
    return existing;
  }

  const result: JobResult = {
    jobName,
    status: 'running',
    startedAt: new Date(),
  };

  runningJobs.set(jobName, result);
  console.log(`[Scheduler] Starting job: ${jobName}`);

  try {
    // Run job with timeout
    const jobPromise = jobDef.handler();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Job timeout after ${jobDef.timeout}ms`)),
        jobDef.timeout
      )
    );

    result.result = await Promise.race([jobPromise, timeoutPromise]);
    result.status = 'completed';

    console.log(`[Scheduler] Job ${jobName} completed successfully`);
  } catch (error) {
    result.status = 'failed';
    result.error = (error as Error).message;
    console.error(`[Scheduler] Job ${jobName} failed:`, error);
  }

  result.completedAt = new Date();
  result.duration =
    result.completedAt.getTime() - result.startedAt.getTime();

  runningJobs.set(jobName, result);
  recordJobHistory({ ...result });
  await persistJobExecution(result);
  await maybeDispatchAlert(result);

  return result;
}

/**
 * Run all enabled jobs in parallel
 * Useful for running the entire job suite
 */
export async function runAllJobs(): Promise<JobResult[]> {
  const enabledJobs = getEnabledJobs();
  console.log(
    `[Scheduler] Running ${enabledJobs.length} enabled jobs in parallel`
  );

  const promises = enabledJobs.map(job => runJob(job.name));
  const results = await Promise.allSettled(promises);

  return results
    .map((r, i) => {
      if (r.status === 'fulfilled') {
        return r.value;
      } else {
        return {
          jobName: enabledJobs[i].name,
          status: 'failed' as const,
          startedAt: new Date(),
          error: (r.reason as Error).message,
        };
      }
    })
    .filter(Boolean);
}

/**
 * Run jobs sequentially (one after another)
 * Useful for avoiding resource contention
 */
export async function runAllJobsSequential(): Promise<JobResult[]> {
  const enabledJobs = getEnabledJobs();
  console.log(
    `[Scheduler] Running ${enabledJobs.length} enabled jobs sequentially`
  );

  const results: JobResult[] = [];

  for (const job of enabledJobs) {
    try {
      const result = await runJob(job.name);
      results.push(result);

      // Wait a bit between jobs to avoid resource exhaustion
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      results.push({
        jobName: job.name,
        status: 'failed',
        startedAt: new Date(),
        completedAt: new Date(),
        error: (error as Error).message,
      });
    }
  }

  return results;
}

/**
 * Check if any jobs are currently running
 */
export function hasRunningJobs(): boolean {
  return Array.from(runningJobs.values()).some(r => r.status === 'running');
}

/**
 * Get job run history for monitoring
 * In production, this would query the job_execution_log table
 */
export function getJobHistory(
  jobName?: JobName,
  limit: number = 10
): JobResult[] {
  const entries = jobName
    ? jobHistory.filter(record => record.jobName === jobName)
    : jobHistory;

  return entries.slice(0, limit);
}

export function getMonitoringSummary(): {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageDurationMs: number;
  failedJobs: string[];
  staleJobs: string[];
  lastRun?: Date;
} {
  const history = jobHistory;

  const successfulRuns = history.filter(record => record.status === 'completed').length;
  const failedRuns = history.filter(record => record.status === 'failed').length;
  const averageDurationMs = history.length
    ? Math.round(
        history.reduce((sum, record) => sum + (record.duration ?? 0), 0) /
          history.length
      )
    : 0;

  const failedJobs = Array.from(
    new Set(history.filter(record => record.status === 'failed').map(record => record.jobName))
  );

  const staleJobs = Array.from(
    new Set(
      history
        .filter(
          record =>
            record.status === 'running' &&
            Date.now() - record.startedAt.getTime() > STALE_JOB_TIMEOUT_MS
        )
        .map(record => record.jobName)
    )
  );

  const lastRun = history.length > 0 ? history[0].completedAt ?? history[0].startedAt : undefined;

  return {
    totalRuns: history.length,
    successfulRuns,
    failedRuns,
    averageDurationMs,
    failedJobs,
    staleJobs,
    lastRun,
  };
}

/**
 * Health check for job system
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  lastRun?: Date;
  failedJobs: string[];
  runningJobs: string[];
  staleJobs: string[];
  summary: ReturnType<typeof getMonitoringSummary>;
}> {
  const statuses = getAllJobStatuses();
  const failedJobs = statuses
    .filter(s => s.status === 'failed')
    .map(s => s.jobName);

  const running = statuses
    .filter(s => s.status === 'running')
    .map(s => s.jobName);

  const staleJobs = statuses
    .filter(s => {
      const ageMs = Date.now() - s.startedAt.getTime();
      return s.status === 'running' && ageMs > STALE_JOB_TIMEOUT_MS;
    })
    .map(s => s.jobName);

  const summary = getMonitoringSummary();
  const lastRun = statuses.length
    ? new Date(Math.max(...statuses.map(s => s.startedAt.getTime())))
    : summary.lastRun;

  return {
    healthy: failedJobs.length === 0 && staleJobs.length === 0,
    lastRun,
    failedJobs,
    runningJobs: running,
    staleJobs,
    summary,
  };
}

const scheduler = {
  getJobs,
  getEnabledJobs,
  getJobStatus,
  getAllJobStatuses,
  runJob,
  runAllJobs,
  runAllJobsSequential,
  hasRunningJobs,
  getJobHistory,
  getMonitoringSummary,
  healthCheck,
};

export default scheduler;
