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
import { randomUUID } from 'node:crypto';

import { syncPlayers } from './sync-players';
import { syncTeams } from './sync-teams';
import { discoverTournaments } from './discover-tournaments';
import { fetchMatches } from './fetch-matches';
import { fetchMatchDetails } from './fetch-match-details';
import { trackRosterChanges } from './track-roster-changes';
import { processCompletedMatches } from './process-completed-matches';
import { calculateFantasyScores } from './calculate-fantasy-scores';
import { recalculateGameweeks } from './recalculate-gameweeks';
import { recalculateLeagues } from './recalculate-leagues';
import { calculateGlobalRankings } from './calculate-global-rankings';
import { updatePlayerPrices } from './update-player-prices';
import { sendDeadlineNotifications } from './send-deadline-notifications';
import { sendPriceChangeNotifications } from './send-price-change-notifications';
import { sendRankNotifications } from './send-rank-notifications';
import { sendUnavailablePlayerNotifications } from './send-unavailable-player-notifications';
import { processPushReceipts } from './process-push-receipts';
import { transitionGameweeks } from './transition-gameweeks';
import { backfillPlaceholderPlayers } from './backfill-placeholder-players';
import { backfillTeamLogos } from './backfill-team-logos';
import { purgeInactiveData } from './purge-inactive-data';
import { autoResolveConflicts } from './auto-resolve-conflicts';
import { purgeInteractionTelemetry } from './purge-interaction-telemetry';
import { matchesCronSchedule } from './job-schedule';
import { getHandlerFailure } from './job-result';
import {
  acquireDistributedJobLock,
  releaseDistributedJobLock,
  renewDistributedJobLock,
} from './job-lock';

type JobName =
  | 'sync-players'
  | 'sync-teams'
  | 'discover-tournaments'
  | 'fetch-matches'
  | 'fetch-match-details'
  | 'track-roster-changes'
  | 'process-completed-matches'
  | 'calculate-fantasy-scores'
  | 'recalculate-gameweeks'
  | 'recalculate-leagues'
  | 'calculate-global-rankings'
  | 'update-player-prices'
  | 'send-deadline-notifications'
  | 'send-price-change-notifications'
  | 'send-rank-notifications'
  | 'send-unavailable-player-notifications'
  | 'process-push-receipts'
  | 'transition-gameweeks'
  | 'backfill-placeholder-players'
  | 'backfill-team-logos'
  | 'purge-inactive-data'
  | 'purge-interaction-telemetry'
  | 'auto-resolve-conflicts';

interface JobDefinition {
  name: JobName;
  schedule: string; // Cron-like format
  handler: (options?: JobRunOptions) => Promise<unknown>;
  enabled: boolean;
  timeout: number; // milliseconds
}

export interface JobRunOptions {
  matchId?: number;
}

interface JobResult {
  jobName: JobName;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
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
    timeout: 30 * 60 * 1000, // 30 minutes
  },
  {
    name: 'sync-teams',
    schedule: '15 3 * * *', // Daily at 3:15 AM UTC
    handler: syncTeams,
    enabled: process.env.ENABLE_TEAM_SYNC !== 'false',
    timeout: 15 * 60 * 1000,
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
  {
    name: 'process-completed-matches',
    schedule: '45 * * * *', // Hourly at :45, after match details fetch
    handler: processCompletedMatches,
    enabled: process.env.ENABLE_SCORE_CALCULATION !== 'false',
    timeout: 10 * 60 * 1000,
  },
  {
    name: 'calculate-fantasy-scores',
    schedule: '50 * * * *', // Hourly at :50, after processing matches
    handler: calculateFantasyScores,
    enabled: process.env.ENABLE_SCORE_CALCULATION !== 'false',
    timeout: 15 * 60 * 1000,
  },
  {
    name: 'recalculate-gameweeks',
    schedule: '55 * * * *', // Hourly at :55, after calculating scores
    handler: recalculateGameweeks,
    enabled: process.env.ENABLE_SCORE_CALCULATION !== 'false',
    timeout: 10 * 60 * 1000,
  },
  {
    name: 'recalculate-leagues',
    schedule: '0 * * * *', // Hourly at :00
    handler: recalculateLeagues,
    enabled: process.env.ENABLE_LEAGUE_RECALCULATION !== 'false',
    timeout: 15 * 60 * 1000,
  },
  {
    name: 'calculate-global-rankings',
    schedule: '5 * * * *', // Hourly at :05, after league recalculation
    handler: calculateGlobalRankings,
    enabled: process.env.ENABLE_GLOBAL_RANKINGS !== 'false',
    timeout: 15 * 60 * 1000,
  },
  {
    name: 'update-player-prices',
    schedule: '*/10 * * * *', // Every 10 minutes after the scoring sequence
    handler: updatePlayerPrices,
    enabled: process.env.ENABLE_PRICE_UPDATES !== 'false',
    timeout: 10 * 60 * 1000,
  },
  {
    name: 'send-deadline-notifications',
    schedule: '0 * * * *', // Every hour to catch approaching deadlines
    handler: sendDeadlineNotifications,
    enabled: process.env.ENABLE_NOTIFICATIONS !== 'false',
    timeout: 5 * 60 * 1000,
  },
  {
    name: 'send-price-change-notifications',
    schedule: '*/15 * * * *', // Shortly after price updates
    handler: sendPriceChangeNotifications,
    enabled: process.env.ENABLE_NOTIFICATIONS !== 'false',
    timeout: 5 * 60 * 1000,
  },
  {
    name: 'send-rank-notifications',
    schedule: '10 * * * *', // Hourly at :10, after global rankings calculation
    handler: sendRankNotifications,
    enabled: process.env.ENABLE_NOTIFICATIONS !== 'false',
    timeout: 5 * 60 * 1000,
  },
  {
    name: 'send-unavailable-player-notifications',
    schedule: '*/30 * * * *', // Check for unavailable players every 30 minutes
    handler: sendUnavailablePlayerNotifications,
    enabled: process.env.ENABLE_NOTIFICATIONS !== 'false',
    timeout: 5 * 60 * 1000,
  },
  {
    name: 'process-push-receipts',
    schedule: '*/15 * * * *', // Remove device tokens Expo reports as permanently invalid
    handler: processPushReceipts,
    enabled: process.env.ENABLE_NOTIFICATIONS !== 'false',
    timeout: 5 * 60 * 1000,
  },
  {
    name: 'transition-gameweeks',
    schedule: '*/5 * * * *', // Every 5 minutes to exactly enforce deadlines
    handler: transitionGameweeks,
    enabled: process.env.ENABLE_SCORE_CALCULATION !== 'false',
    timeout: 10 * 60 * 1000,
  },
  {
    name: 'backfill-placeholder-players',
    schedule: '0 6 * * *', // Daily at 6 AM UTC
    handler: backfillPlaceholderPlayers,
    enabled: true,
    timeout: 15 * 60 * 1000, // 15 minutes
  },
  {
    name: 'backfill-team-logos',
    schedule: '30 5 * * *', // Daily at 5:30 AM UTC (runs before player backfill at 6 AM UTC)
    handler: backfillTeamLogos,
    enabled: process.env.ENABLE_LOGO_BACKFILL !== 'false',
    timeout: 30 * 60 * 1000, // 30 minutes
  },
  {
    name: 'purge-inactive-data',
    schedule: '0 4 * * 0', // Weekly Sunday at 4:00 AM UTC
    handler: purgeInactiveData,
    enabled: process.env.ENABLE_DATA_PURGE !== 'false',
    timeout: 15 * 60 * 1000, // 15 minutes
  },
  {
    name: 'purge-interaction-telemetry',
    schedule: '15 4 * * 0', // Weekly Sunday at 4:15 AM UTC
    handler: purgeInteractionTelemetry,
    enabled: process.env.ENABLE_TELEMETRY !== 'false',
    timeout: 5 * 60 * 1000,
  },
  {
    name: 'auto-resolve-conflicts',
    schedule: '45 3 * * *', // Daily at 3:45 AM UTC — after sync-players (3:00) and sync-teams (3:15)
    handler: autoResolveConflicts,
    enabled: true,
    timeout: 5 * 60 * 1000, // 5 minutes
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
    const response = await fetch(webhookUrl, {
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
    if (!response.ok) {
      console.warn(`[Scheduler] Alert webhook returned HTTP ${response.status} for ${result.jobName}`);
    }
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
export async function runJob(jobName: JobName, options?: JobRunOptions): Promise<JobResult> {
  const jobDef = JOBS.find(j => j.name === jobName);

  if (!jobDef) {
    throw new Error(`Unknown job: ${jobName}`);
  }
  if (options && (
    jobName !== 'fetch-match-details' ||
    !Number.isSafeInteger(options.matchId) ||
    (options.matchId ?? 0) <= 0
  )) {
    throw new Error('Only fetch-match-details accepts a positive integer matchId option');
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

  const executionId = randomUUID();
  let lockAcquired = false;
  try {
    lockAcquired = await acquireDistributedJobLock(jobName, executionId);
    if (!lockAcquired) {
      result.status = 'skipped';
      result.error = 'Another scheduler instance owns the distributed job lock';
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - result.startedAt.getTime();
      console.log(`[Scheduler] Job ${jobName} already running on another instance, skipping`);
      runningJobs.set(jobName, result);
      recordJobHistory({ ...result });
      await persistJobExecution(result);
      return result;
    }
  } catch (error) {
    result.status = 'failed';
    result.error = (error as Error).message;
    console.error(`[Scheduler] Job ${jobName} could not acquire its distributed lock:`, error);
    result.completedAt = new Date();
    result.duration = result.completedAt.getTime() - result.startedAt.getTime();
    runningJobs.set(jobName, result);
    recordJobHistory({ ...result });
    await persistJobExecution(result);
    await maybeDispatchAlert(result);
    return result;
  }

  let lockHeartbeatInFlight = false;
  const lockHeartbeat = setInterval(async () => {
    if (lockHeartbeatInFlight) return;
    lockHeartbeatInFlight = true;
    try {
      const renewed = await renewDistributedJobLock(jobName, executionId);
      if (!renewed) {
        console.error(`[Scheduler] Lost distributed lock ownership for ${jobName}`);
      }
    } catch (error) {
      console.error(`[Scheduler] Failed to renew distributed lock for ${jobName}:`, error);
    } finally {
      lockHeartbeatInFlight = false;
    }
  }, 30_000);

  const stopLockHeartbeat = () => clearInterval(lockHeartbeat);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const handlerPromise = Promise.resolve().then(() => jobDef.handler(options));
  const settledHandler = handlerPromise.then(
    (value) => ({ status: 'completed' as const, value }),
    (error: unknown) => ({ status: 'failed' as const, error })
  );
  const timeoutPromise = new Promise<{ status: 'timed-out' }>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve({ status: 'timed-out' });
    }, jobDef.timeout);
  });
  const outcome = await Promise.race([settledHandler, timeoutPromise]);

  if (outcome.status === 'timed-out') {
    result.status = 'failed';
    result.error =
      `Job exceeded timeout after ${jobDef.timeout}ms; execution was not cancelled and its distributed lock remains held until it settles or expires.`;
    result.completedAt = new Date();
    result.duration = result.completedAt.getTime() - result.startedAt.getTime();
    console.error(`[Scheduler] Job ${jobName} timed out; underlying work was not cancelled`);
    runningJobs.set(jobName, result);
    recordJobHistory({ ...result });
    await persistJobExecution(result);
    await maybeDispatchAlert(result);

    void settledHandler.then(async (lateOutcome) => {
      console.warn(`[Scheduler] Timed-out job ${jobName} settled later with status ${lateOutcome.status}`);
      stopLockHeartbeat();
      try {
        await releaseDistributedJobLock(jobName, executionId);
      } catch (error) {
        console.error(`[Scheduler] Failed to release late-settled job lock for ${jobName}:`, error);
      }
    });
    return result;
  }

  if (timeoutHandle) clearTimeout(timeoutHandle);
  stopLockHeartbeat();
  if (outcome.status === 'failed') {
    result.status = 'failed';
    result.error = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
    console.error(`[Scheduler] Job ${jobName} failed:`, outcome.error);
  } else {
    result.result = outcome.value;
    const handlerFailure = getHandlerFailure(outcome.value);
    if (handlerFailure) {
      result.status = 'failed';
      result.error = handlerFailure;
      console.error(`[Scheduler] Job ${jobName} reported a failed result:`, handlerFailure);
    } else {
      result.status = 'completed';
      console.log(`[Scheduler] Job ${jobName} completed successfully`);
    }
  }

  result.completedAt = new Date();
  result.duration =
    result.completedAt.getTime() - result.startedAt.getTime();

  runningJobs.set(jobName, result);
  recordJobHistory({ ...result });
  await persistJobExecution(result);
  await maybeDispatchAlert(result);
  try {
    await releaseDistributedJobLock(jobName, executionId);
  } catch (error) {
    console.error(`[Scheduler] Failed to release distributed job lock for ${jobName}:`, error);
  }

  return result;
}

export async function runScheduledJobs(now: Date = new Date()): Promise<JobResult[]> {
  const dueJobs = getEnabledJobs().filter((job) => matchesCronSchedule(job.schedule, now));
  console.log(
    `[Scheduler] ${dueJobs.length} enabled jobs due at ${now.toISOString()}`
  );
  const results: JobResult[] = [];

  for (const job of dueJobs) {
    results.push(await runJob(job.name));
  }

  return results;
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
  runScheduledJobs,
  runAllJobs,
  runAllJobsSequential,
  hasRunningJobs,
  getJobHistory,
  getMonitoringSummary,
  healthCheck,
};

export default scheduler;
