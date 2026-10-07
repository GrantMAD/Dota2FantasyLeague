'use client';

import { useEffect, useState } from 'react';
import { Activity, CircleCheck, CircleHelp, Clock3, TriangleAlert, XCircle } from 'lucide-react';

type JobHealthStatus = 'healthy' | 'degraded' | 'unknown';

interface ObservabilityData {
  summary: { configuredJobs: number; runningJobs: number; recentRuns: number; recentFailures: number; averageDurationMs: number };
  health: {
    status: JobHealthStatus;
    healthy: boolean | null;
    failedJobs: string[];
    runningJobs: string[];
    staleJobs: string[];
    unknownJobs: string[];
  };
  recentRuns: Array<{ job_name: string; status: string; started_at: string; error_message?: string }>;
  cache: { entries: number };
}

export default function AdminObservabilityPage() {
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const response = await fetch('/api/admin/observability');
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Failed to load observability data');
      setData(body);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load observability data');
    }
  };

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    const interval = setInterval(load, 30000);
    return () => {
      window.clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, []);

  if (error) return <div className="rounded border border-red-700 bg-red-900/20 p-6 text-red-300">{error}</div>;
  if (!data) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading observability">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-9 w-64 animate-pulse rounded bg-gray-700/60" />
            <div className="h-4 w-80 max-w-full animate-pulse rounded bg-gray-700/40" />
          </div>
          <div className="h-10 w-24 animate-pulse rounded bg-gray-700/50" />
        </div>
        <div className="h-16 animate-pulse rounded border border-gray-700 bg-gray-800/50 p-4" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
              <div className="h-4 w-28 animate-pulse rounded bg-gray-700/60" />
              <div className="mt-3 h-7 w-20 animate-pulse rounded bg-gray-700/50" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
          <div className="mb-5 h-6 w-40 animate-pulse rounded bg-gray-700/60" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 py-3">
                <div className="h-4 w-40 animate-pulse rounded bg-gray-700/50" />
                <div className="h-4 w-48 max-w-full animate-pulse rounded bg-gray-700/40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const cards = [
    ['Configured Jobs', data.summary.configuredJobs],
    ['Running Jobs', data.summary.runningJobs],
    ['Recent Failures', data.summary.recentFailures],
    ['Average Duration', `${data.summary.averageDurationMs} ms`],
    ['Cached Responses', data.cache.entries],
  ];
  const healthPresentation = {
    healthy: {
      label: 'Healthy',
      description: 'All enabled scheduled jobs are within their expected health windows.',
      className: 'border-emerald-700 bg-emerald-900/20 text-emerald-300',
      Icon: CircleCheck,
    },
    degraded: {
      label: 'Degraded',
      description: 'One or more enabled jobs failed or fell outside their expected schedule window.',
      className: 'border-red-700 bg-red-900/20 text-red-300',
      Icon: TriangleAlert,
    },
    unknown: {
      label: 'Unknown',
      description: 'Health cannot be confirmed because one or more enabled jobs lack a recognized durable run record.',
      className: 'border-amber-700 bg-amber-900/20 text-amber-200',
      Icon: CircleHelp,
    },
  } satisfies Record<JobHealthStatus, {
    label: string;
    description: string;
    className: string;
    Icon: typeof CircleCheck;
  }>;
  const health = healthPresentation[data.health.status];
  const staleJobs = new Set(data.health.staleJobs);
  const healthGroups = [
    {
      label: 'Failed latest runs',
      jobs: data.health.failedJobs,
      description: 'The latest recorded execution failed.',
      Icon: XCircle,
    },
    {
      label: 'Overdue jobs',
      jobs: data.health.staleJobs,
      description: 'No recent successful completion was recorded within the expected schedule window.',
      Icon: Clock3,
    },
    {
      label: 'Unconfirmed jobs',
      jobs: data.health.unknownJobs,
      description: 'No latest execution record with a recognized status is available.',
      Icon: CircleHelp,
    },
  ].filter((group) => group.jobs.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div><h1 className="flex items-center gap-3 text-3xl font-bold text-white"><Activity className="h-8 w-8 text-amber-400" />Live Observability</h1><p className="mt-1 text-gray-400">Background job health, failures, latency, and response cache status.</p></div>
        <button onClick={load} className="rounded bg-amber-500/20 px-4 py-2 text-amber-400 hover:bg-amber-500/30">Refresh</button>
      </div>
      <div className={`rounded border p-4 transition-colors ${health.className}`} aria-live="polite">
        <div className="flex items-center gap-2 font-medium">
          <health.Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p><span className="font-semibold">System health:</span> {health.label}</p>
        </div>
        <p className="mt-2 text-sm opacity-90">{health.description}</p>
        {healthGroups.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {healthGroups.map(({ label, jobs, description, Icon }) => (
              <section key={label} className="rounded border border-current/20 bg-black/10 p-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label} ({jobs.length})
                </h2>
                <ul className="mt-2 space-y-2 text-sm">
                  {jobs.map((jobName) => (
                    <li key={jobName}>
                      <span className="font-medium">{jobName}</span>
                      <span className="block text-xs opacity-80">
                        {label === 'Overdue jobs' && data.health.runningJobs.includes(jobName)
                          ? 'This execution has been running for more than 30 minutes.'
                          : description}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {data.health.runningJobs.filter((jobName) => !staleJobs.has(jobName)).length > 0 && (
              <section className="rounded border border-current/20 bg-black/10 p-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Currently running ({data.health.runningJobs.filter((jobName) => !staleJobs.has(jobName)).length})
                </h2>
                <p className="mt-2 text-xs opacity-80">These jobs are in progress and have not exceeded the running threshold.</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {data.health.runningJobs.filter((jobName) => !staleJobs.has(jobName)).map((jobName) => (
                    <li key={jobName} className="font-medium">{jobName}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {cards.map(([label, value]) => <div key={label} className="rounded-lg border border-gray-700 bg-gray-800/50 p-5"><div className="text-sm text-gray-400">{label}</div><div className="mt-2 text-2xl font-semibold text-white">{value}</div></div>)}
      </div>
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Job Runs</h2>
        <div className="space-y-2">{data.recentRuns.map((run, index) => <div key={`${run.job_name}-${run.started_at}-${index}`} className="flex items-center justify-between border-b border-gray-700 py-3 text-sm"><div><span className="font-medium text-white">{run.job_name}</span>{run.error_message && <p className="text-red-300">{run.error_message}</p>}</div><div className="flex gap-4 text-gray-400"><span>{run.status}</span><span>{new Date(run.started_at).toLocaleString()}</span></div></div>)}</div>
      </div>
    </div>
  );
}
