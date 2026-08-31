'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Clock, Play } from 'lucide-react';

interface JobStatus {
  job_name: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  last_run: string;
  last_duration_ms: number;
  next_run: string;
  metadata?: Record<string, unknown>;
}

export default function DataJobsPage() {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchJobStatus();
    // Refresh every 10 seconds
    const interval = setInterval(fetchJobStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchJobStatus() {
    try {
      const response = await fetch('/api/admin/jobs/status');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Failed to fetch job status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function triggerJob(jobName: string) {
    setRefreshing(true);
    try {
      const response = await fetch('/api/admin/jobs/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_name: jobName }),
      });

      if (response.ok) {
        await fetchJobStatus();
      }
    } catch (error) {
      console.error('Failed to trigger job:', error);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Loading job status...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Data Ingestion Jobs</h1>
          <p className="mt-1 text-gray-400">Monitor and control background data sync jobs</p>
        </div>
        <button
          onClick={fetchJobStatus}
          disabled={refreshing}
          className="rounded bg-amber-500/20 px-4 py-2 font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Jobs List */}
      <div className="space-y-3">
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center">
            <Clock className="mx-auto h-12 w-12 text-gray-600" />
            <p className="mt-2 text-gray-400">No jobs configured</p>
          </div>
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.job_name}
              job={job}
              onTrigger={() => triggerJob(job.job_name)}
              disabled={refreshing}
            />
          ))
        )}
      </div>

      {/* Job Schedule Info */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
        <h3 className="mb-4 font-semibold text-white">Scheduled Sync Times (UTC)</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li>• <strong>sync-players</strong>: Daily at 03:00 UTC</li>
          <li>• <strong>sync-teams</strong>: Daily at 03:15 UTC</li>
          <li>• <strong>discover-tournaments</strong>: Daily at 04:00 UTC</li>
          <li>• <strong>fetch-matches</strong>: Every 6 hours starting at 00:00 UTC</li>
          <li>• <strong>fetch-match-details</strong>: Every 2 hours starting at 00:30 UTC</li>
          <li>• <strong>track-roster-changes</strong>: Daily at 05:00 UTC</li>
        </ul>
      </div>
    </div>
  );
}

interface JobCardProps {
  job: JobStatus;
  onTrigger: () => void;
  disabled: boolean;
}

function JobCard({ job, onTrigger, disabled }: JobCardProps) {
  const isRunning = job.status === 'running';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  const statusColor =
    isCompleted ? 'text-green-400' :
    isRunning ? 'text-blue-400' :
    isFailed ? 'text-red-400' :
    'text-gray-400';

  const statusBgColor =
    isCompleted ? 'bg-green-500/10 border-green-500/30' :
    isRunning ? 'bg-blue-500/10 border-blue-500/30' :
    isFailed ? 'bg-red-500/10 border-red-500/30' :
    'bg-gray-800/50 border-gray-700';

  const statusIcon =
    isCompleted ? <CheckCircle className="h-5 w-5" /> :
    isRunning ? <Clock className="h-5 w-5 animate-spin" /> :
    isFailed ? <AlertCircle className="h-5 w-5" /> :
    <Clock className="h-5 w-5" />;

  return (
    <div className={`rounded-lg border p-6 ${statusBgColor}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={statusColor}>{statusIcon}</div>
            <div>
              <h3 className="font-semibold text-white">{job.job_name}</h3>
              <p className={`text-sm ${statusColor}`}>
                {job.status === 'running'
                  ? 'Running...'
                  : job.status === 'completed'
                    ? 'Last run completed'
                    : job.status === 'failed'
                      ? 'Last run failed'
                      : 'Idle'}
              </p>
            </div>
          </div>

          {/* Job Details */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-gray-400">Last Run</p>
              <p className="mt-1 font-mono text-sm text-gray-300">
                {job.last_run ? new Date(job.last_run).toLocaleString() : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Duration</p>
              <p className="mt-1 font-mono text-sm text-gray-300">
                {job.last_duration_ms ? `${job.last_duration_ms}ms` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Next Run</p>
              <p className="mt-1 font-mono text-sm text-gray-300">
                {job.next_run ? new Date(job.next_run).toLocaleString() : '-'}
              </p>
            </div>
          </div>

          {/* Metadata */}
          {job.metadata && (
            <div className="mt-3 rounded bg-gray-700/30 p-3 font-mono text-xs text-gray-400">
              {Object.entries(job.metadata).map(([key, value]) => (
                <div key={key}>
                  <span className="text-gray-500">{key}:</span>{' '}
                  <span className="text-gray-300">{JSON.stringify(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <button
          onClick={onTrigger}
          disabled={disabled || isRunning}
          className="ml-4 shrink-0 rounded bg-amber-500/20 px-4 py-2 font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
        >
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            <span>Run Now</span>
          </div>
        </button>
      </div>
    </div>
  );
}
