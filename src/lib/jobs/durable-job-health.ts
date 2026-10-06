export interface DurableJobDefinition {
  name: string;
  schedule: string;
  enabled: boolean;
}

export interface DurableJobRun {
  job_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const RUNNING_STALE_AFTER_MS = 30 * MINUTE;

export function getExpectedJobIntervalMs(schedule: string): number {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = schedule.trim().split(/\s+/);
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) {
    throw new Error(`Invalid five-field cron schedule: ${schedule}`);
  }

  const minuteStep = /^\*\/(\d+)$/.exec(minute);
  if (minuteStep && hour === '*') return Number(minuteStep[1]) * MINUTE;
  if (minute === '*' && hour === '*') return MINUTE;
  if (hour === '*') return HOUR;

  const hourStep = /^\*\/(\d+)$/.exec(hour);
  if (hourStep) return Number(hourStep[1]) * HOUR;
  if (dayOfWeek !== '*') return 7 * DAY;
  if (dayOfMonth !== '*' || month !== '*') return 30 * DAY;
  return DAY;
}

export function buildDurableJobHealth(
  jobs: DurableJobDefinition[],
  latestRuns: DurableJobRun[],
  now = Date.now(),
) {
  const latestByName = new Map(latestRuns.map((run) => [run.job_name, run]));
  const failedJobs: string[] = [];
  const runningJobs: string[] = [];
  const staleJobs: string[] = [];
  const unknownJobs: string[] = [];

  for (const job of jobs.filter((candidate) => candidate.enabled)) {
    const latest = latestByName.get(job.name);
    if (!latest) {
      unknownJobs.push(job.name);
      continue;
    }

    const startedAt = Date.parse(latest.started_at);
    const lastActivity = Date.parse(latest.completed_at ?? latest.started_at);
    if (latest.status === 'failed') {
      failedJobs.push(job.name);
      continue;
    }
    if (latest.status === 'running' || latest.status === 'started') {
      runningJobs.push(job.name);
      if (now - startedAt > RUNNING_STALE_AFTER_MS) staleJobs.push(job.name);
      continue;
    }
    if (latest.status !== 'completed') {
      unknownJobs.push(job.name);
      continue;
    }

    const expectedInterval = getExpectedJobIntervalMs(job.schedule);
    const allowedDelay = Math.max(15 * MINUTE, Math.floor(expectedInterval * 1.5));
    if (!Number.isFinite(lastActivity) || now - lastActivity > allowedDelay) {
      staleJobs.push(job.name);
    }
  }

  const status = failedJobs.length > 0 || staleJobs.length > 0
    ? 'degraded'
    : unknownJobs.length > 0
      ? 'unknown'
      : 'healthy';

  return {
    status,
    healthy: status === 'healthy' ? true : status === 'unknown' ? null : false,
    source: 'job_execution_log',
    thresholds: {
      runningJobStaleAfterMs: RUNNING_STALE_AFTER_MS,
      completedJobStaleAfterExpectedIntervals: 1.5,
      minimumCompletedJobGraceMs: 15 * MINUTE,
    },
    failedJobs,
    runningJobs,
    staleJobs,
    unknownJobs,
  };
}
