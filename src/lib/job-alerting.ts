export interface JobAlertPolicy {
  failureThreshold: number;
  windowMinutes: number;
  suppressionMinutes: number;
}

export function getJobAlertPolicy(): JobAlertPolicy {
  return {
    failureThreshold: Math.max(1, Number(process.env.JOB_ALERT_FAILURE_THRESHOLD ?? 3)),
    windowMinutes: Math.max(1, Number(process.env.JOB_ALERT_WINDOW_MINUTES ?? 30)),
    suppressionMinutes: Math.max(0, Number(process.env.JOB_ALERT_SUPPRESSION_MINUTES ?? 60)),
  };
}

export function shouldEscalateFailure(failures: Array<{ job_name: string; started_at: string }>, jobName: string, now = Date.now()): boolean {
  const policy = getJobAlertPolicy();
  const cutoff = now - policy.windowMinutes * 60_000;
  return failures.filter((failure) => failure.job_name === jobName && Date.parse(failure.started_at) >= cutoff).length >= policy.failureThreshold;
}
