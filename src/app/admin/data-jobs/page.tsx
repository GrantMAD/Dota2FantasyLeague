'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  RotateCw,
  Zap,
  Terminal,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Calendar,
  Layers,
  Activity,
  AlertOctagon,
  Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

function formatDateTime(val: string | null | undefined, fallback = '-'): string {
  if (!val) return fallback;
  const d = new Date(val);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleString();
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  return `${minutes}m ${remainingSecs}s`;
}

function formatNextRun(val: string | null | undefined): string {
  if (!val) return 'Manual only';
  if (val.startsWith('Cron:')) {
    return val;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) {
    return val;
  }
  const diffMs = d.getTime() - Date.now();
  if (diffMs > 0) {
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) {
      return `in ${diffMins}m (${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    }
    const diffHours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    return `in ${diffHours}h ${remMins}m`;
  }
  return d.toLocaleString();
}

interface JobResultSummary {
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: string[] | number;
  duration?: number;
  [key: string]: unknown;
}

interface JobStatus {
  job_name: string;
  schedule?: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
  last_run: string | null;
  last_duration_ms: number | null;
  next_run: string | null;
  metadata?: Record<string, unknown> | null;
}

interface FailedJob {
  id: string;
  job_name: string;
  error_message: string;
  retry_count: number;
  next_retry_at: string | null;
  is_dead_letter: boolean;
  started_at: string;
}

export default function DataJobsPage() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningJobs, setRunningJobs] = useState<Record<string, boolean>>({});
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    fetchJobStatus();
    fetchFailedJobs();
    const interval = setInterval(() => {
      fetchJobStatus(true);
      fetchFailedJobs();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  async function getAuthHeaders(): Promise<Record<string, string>> {
    try {
      const { data } = await supabase.auth.getSession();
      let token = data.session?.access_token;
      
      // If token expires in less than 30s or already expired, refresh it
      if (data.session && data.session.expires_at) {
        const expiresAtMs = data.session.expires_at * 1000;
        if (Date.now() > expiresAtMs - 30000) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          token = refreshed.session?.access_token || token;
        }
      }

      if (token) {
        return {
          Authorization: `Bearer ${token}`,
        };
      }
    } catch {
      // ignore
    }
    return {};
  }

  async function fetchJobStatus(silent = false) {
    if (!silent) setRefreshing(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/admin/jobs/status', {
        headers: { ...authHeaders },
      });
      if (response.ok) {
        const data = await response.json();
        const rawJobs = data.jobs || [];
        const normalizedJobs = rawJobs.map((j: any) => ({
          job_name: j.name || j.job_name,
          schedule: j.schedule || null,
          status: j.status?.status || j.status || 'idle',
          last_run: j.status?.startedAt || j.last_run || null,
          last_duration_ms: j.status?.duration || j.last_duration_ms || null,
          next_run: j.next_run || (j.schedule ? `Cron: ${j.schedule}` : null),
          metadata: j.status?.result || j.metadata || null,
        }));
        setJobs(normalizedJobs);
      }
    } catch (error) {
      console.error('Failed to fetch job status:', error);
    } finally {
      if (!silent) setRefreshing(false);
      setLoading(false);
    }
  }

  async function fetchFailedJobs() {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/admin/jobs/failed', {
        headers: { ...authHeaders },
      });
      if (response.ok) {
        const data = await response.json();
        setFailedJobs(data.failedJobs || []);
      }
    } catch {
      // Silently fail if endpoint not ready
    }
  }

  async function triggerJob(jobName: string) {
    setRunningJobs((prev) => ({ ...prev, [jobName]: true }));
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/admin/jobs/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ job_name: jobName }),
      });
      if (response.ok) {
        await fetchJobStatus(true);
      }
    } catch (error) {
      console.error('Failed to trigger job:', error);
    } finally {
      setRunningJobs((prev) => ({ ...prev, [jobName]: false }));
    }
  }

  async function retryJob(jobId: string, jobName: string) {
    setRetrying(jobId);
    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/admin/jobs/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ job_name: jobName }),
      });
      await fetchFailedJobs();
      await fetchJobStatus(true);
    } catch (error) {
      console.error('Failed to retry job:', error);
    } finally {
      setRetrying(null);
    }
  }

  // Summary counts
  const totalJobs = jobs.length;
  const runningCount = jobs.filter((j) => j.status === 'running' || runningJobs[j.job_name]).length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length + failedJobs.length;

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <RotateCw className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium text-slate-400">Loading scheduled jobs & ingestion engine...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 shadow-inner">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Data Ingestion Engine</h1>
              <p className="text-xs text-slate-400">Manage and orchestrate live Dota 2 sync pipelines and background tasks</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchJobStatus();
              fetchFailedJobs();
            }}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 shadow-sm transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            {refreshing ? 'Syncing...' : 'Refresh Status'}
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Pipelines</span>
            <Layers className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{totalJobs}</div>
          <span className="text-[11px] text-slate-400">Registered background workers</span>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-blue-400">Active</span>
            <Activity className={`h-4 w-4 text-blue-400 ${runningCount > 0 ? 'animate-pulse' : ''}`} />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-300">{runningCount}</div>
          <span className="text-[11px] text-blue-400/80">{runningCount > 0 ? 'Processing data...' : 'All idle'}</span>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">Healthy</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-300">{completedCount}</div>
          <span className="text-[11px] text-emerald-400/80">Completed last run successfully</span>
        </div>

        <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-rose-400">Alerts</span>
            <AlertOctagon className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-300">{failedCount}</div>
          <span className="text-[11px] text-rose-400/80">{failedCount > 0 ? 'Action required' : 'No dead letters'}</span>
        </div>
      </div>

      {/* Dead-Letter / Retries Section */}
      {failedJobs.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-rose-900/40 bg-rose-950/20 shadow-md">
          <div className="border-b border-rose-900/30 bg-rose-900/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                <h2 className="text-sm font-semibold text-rose-200">
                  Failed & Dead-Letter Executions ({failedJobs.length})
                </h2>
              </div>
              <span className="text-xs text-rose-400/80">Requires inspection</span>
            </div>
          </div>
          <div className="divide-y divide-rose-900/20">
            {failedJobs.map((fj) => (
              <div key={fj.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-white">{fj.job_name}</span>
                    {fj.is_dead_letter ? (
                      <span className="rounded bg-rose-950 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-300 border border-rose-800">
                        Dead Letter
                      </span>
                    ) : (
                      <span className="rounded bg-amber-950 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-800">
                        Retry {fj.retry_count}/3
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 font-mono text-xs text-rose-300/80">{fj.error_message}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => retryJob(fj.id, fj.job_name)}
                    disabled={retrying === fj.id}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-700/50 bg-rose-900/40 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-800 disabled:opacity-50"
                  >
                    <RotateCw className={`h-3.5 w-3.5 ${retrying === fj.id ? 'animate-spin' : ''}`} />
                    {retrying === fj.id ? 'Retrying...' : 'Retry Pipeline'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Jobs Grid / List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Available Pipelines</h2>
          <span className="text-xs text-slate-400">Automatic background sync enabled</span>
        </div>

        {jobs.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center">
            <Clock className="h-8 w-8 text-slate-600" />
            <p className="mt-2 text-sm text-slate-400">No data jobs registered</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {jobs.map((job) => (
              <JobCard
                key={job.job_name}
                job={job}
                isLocallyRunning={Boolean(runningJobs[job.job_name])}
                onTrigger={() => triggerJob(job.job_name)}
                disabled={refreshing}
              />
            ))}
          </div>
        )}
      </div>

      {/* Schedule Reference Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Automated Schedule Manifest</h3>
        </div>
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
            <div className="font-mono font-medium text-amber-400">sync-players</div>
            <div className="mt-1 text-slate-400">Daily at 03:00 UTC (Stratz/OpenDota roster ingest)</div>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
            <div className="font-mono font-medium text-amber-400">sync-teams</div>
            <div className="mt-1 text-slate-400">Daily at 03:15 UTC (Pro tier 1-2 teams)</div>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
            <div className="font-mono font-medium text-amber-400">discover-tournaments</div>
            <div className="mt-1 text-slate-400">Daily at 04:00 UTC (League & event discovery)</div>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
            <div className="font-mono font-medium text-amber-400">fetch-matches</div>
            <div className="mt-1 text-slate-400">Every 6 hours (Match batch header ingest)</div>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
            <div className="font-mono font-medium text-amber-400">fetch-match-details</div>
            <div className="mt-1 text-slate-400">Every 2 hours (Player fantasy breakdown)</div>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
            <div className="font-mono font-medium text-amber-400">track-roster-changes</div>
            <div className="mt-1 text-slate-400">Daily at 05:00 UTC (Transfer window auditing)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Sub-component: Job Card with Compact Summary & Collapsible Logs
// -------------------------------------------------------------

interface JobCardProps {
  job: JobStatus;
  isLocallyRunning: boolean;
  onTrigger: () => void;
  disabled: boolean;
}

function JobCard({ job, isLocallyRunning, onTrigger, disabled }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isRunning = job.status === 'running' || isLocallyRunning;
  const isCompleted = job.status === 'completed' && !isLocallyRunning;
  const isFailed = job.status === 'failed' && !isLocallyRunning;

  // Extract structured metadata summary if available
  const meta = (job.metadata || {}) as JobResultSummary;
  const createdCount = typeof meta.created === 'number' ? meta.created : null;
  const updatedCount = typeof meta.updated === 'number' ? meta.updated : null;
  const skippedCount = typeof meta.skipped === 'number' ? meta.skipped : null;
  
  let errorCount = 0;
  if (Array.isArray(meta.errors)) {
    errorCount = meta.errors.length;
  } else if (typeof meta.errors === 'number') {
    errorCount = meta.errors;
  }

  const hasStats = createdCount != null || updatedCount != null || skippedCount != null || errorCount > 0;
  const hasMetadata = job.metadata && Object.keys(job.metadata).length > 0;

  function copyLogToClipboard() {
    if (!job.metadata) return;
    navigator.clipboard.writeText(JSON.stringify(job.metadata, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={`group rounded-xl border transition-all duration-200 ${
        isRunning
          ? 'border-blue-500/40 bg-slate-900/90 shadow-lg shadow-blue-500/5'
          : isFailed
            ? 'border-rose-800/40 bg-slate-900/80'
            : isCompleted
              ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/80'
              : 'border-slate-800/80 bg-slate-900/40'
      }`}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Main Info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-semibold text-white tracking-wide">
                {job.job_name}
              </span>

              {/* Status Badge */}
              {isRunning ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400">
                  <span className="h-2 w-2 animate-ping rounded-full bg-blue-400" />
                  Running...
                </span>
              ) : isCompleted ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Success
                </span>
              ) : isFailed ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400">
                  <AlertTriangle className="h-3 w-3" />
                  Failed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-xs font-medium text-slate-400">
                  <Clock className="h-3 w-3" />
                  Idle
                </span>
              )}

              {/* Schedule Tag */}
              {job.schedule && (
                <span className="rounded border border-slate-700/60 bg-slate-800/40 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                  {job.schedule}
                </span>
              )}
            </div>

            {/* Quick Metrics Bar: Last Run, Duration, Next Run */}
            <div className="mt-3 flex flex-wrap items-center gap-y-1 gap-x-6 text-xs text-slate-400">
              <div>
                <span className="text-slate-400">Last Run:</span>{' '}
                <span className="font-mono text-slate-200">{formatDateTime(job.last_run, 'Never')}</span>
              </div>
              <div>
                <span className="text-slate-400">Duration:</span>{' '}
                <span className="font-mono text-slate-200">{formatDuration(job.last_duration_ms)}</span>
              </div>
              <div>
                <span className="text-slate-400">Next Scheduled:</span>{' '}
                <span className="font-mono text-slate-200">{formatNextRun(job.next_run)}</span>
              </div>
            </div>

            {/* Result Stats Chips (Created, Updated, Skipped, Errors) */}
            {hasStats && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {createdCount != null && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-300">
                    <span className="font-bold">+{createdCount.toLocaleString()}</span> created
                  </span>
                )}
                {updatedCount != null && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-950/40 px-2 py-0.5 text-xs font-medium text-sky-300">
                    <span className="font-bold">+{updatedCount.toLocaleString()}</span> updated
                  </span>
                )}
                {skippedCount != null && skippedCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-xs text-slate-400">
                    <span className="font-bold">{skippedCount.toLocaleString()}</span> skipped
                  </span>
                )}
                {errorCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-950/40 px-2 py-0.5 text-xs font-medium text-rose-300">
                    <AlertTriangle className="h-3 w-3 text-rose-400" />
                    <span className="font-bold">{errorCount}</span> errors reported
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* Action Area */}
          <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">
            {hasMetadata && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
                title="Toggle Log Details"
              >
                <Terminal className="h-3.5 w-3.5 text-slate-400" />
                <span>{expanded ? 'Hide Logs' : 'View Logs'}</span>
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                )}
              </button>
            )}

            <button
              onClick={onTrigger}
              disabled={disabled || isRunning}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition ${
                isRunning
                  ? 'cursor-not-allowed border border-blue-500/30 bg-blue-900/30 text-blue-300'
                  : 'border border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 active:scale-[0.98]'
              } disabled:opacity-50`}
            >
              {isRunning ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 animate-spin text-blue-400" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 text-amber-400 fill-amber-400/20" />
                  <span>Run Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Execution Logs Drawer */}
        {expanded && hasMetadata && (
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/80 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/50 px-3 py-1.5">
              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                <Terminal className="h-3.5 w-3.5 text-amber-400/80" />
                <span>Execution Output / Metadata</span>
              </div>
              <button
                onClick={copyLogToClipboard}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto p-3 font-mono text-xs text-slate-300 scrollbar-thin scrollbar-thumb-slate-700">
              {Array.isArray(meta.errors) && meta.errors.length > 0 && (
                <div className="mb-3 rounded border border-rose-900/40 bg-rose-950/30 p-2 text-rose-300">
                  <div className="font-semibold text-rose-400 mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Error Trace ({meta.errors.length}):
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {meta.errors.slice(0, 20).map((err, idx) => (
                      <li key={idx} className="break-all">
                        {typeof err === 'string' ? err : JSON.stringify(err)}
                      </li>
                    ))}
                    {meta.errors.length > 20 && (
                      <li className="italic text-rose-400">
                        ...and {meta.errors.length - 20} more errors (copied in full JSON)
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <pre className="whitespace-pre-wrap break-all text-[11px] text-slate-400">
                {JSON.stringify(job.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

