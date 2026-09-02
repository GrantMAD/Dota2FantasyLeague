'use client';

import { useEffect, useState } from 'react';

interface ObservabilityData {
  summary: { configuredJobs: number; runningJobs: number; recentRuns: number; recentFailures: number; averageDurationMs: number };
  health: { healthy: boolean; issues?: string[] };
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
  if (!data) return <div className="py-12 text-center text-gray-400">Loading observability...</div>;

  const cards = [
    ['Configured Jobs', data.summary.configuredJobs],
    ['Running Jobs', data.summary.runningJobs],
    ['Recent Failures', data.summary.recentFailures],
    ['Average Duration', `${data.summary.averageDurationMs} ms`],
    ['Cached Responses', data.cache.entries],
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-white">Live Observability</h1><p className="mt-1 text-gray-400">Background job health, failures, latency, and response cache status.</p></div>
        <button onClick={load} className="rounded bg-amber-500/20 px-4 py-2 text-amber-400 hover:bg-amber-500/30">Refresh</button>
      </div>
      <div className={`rounded border p-4 ${data.health.healthy ? 'border-emerald-700 bg-emerald-900/20 text-emerald-300' : 'border-red-700 bg-red-900/20 text-red-300'}`}>
        System health: {data.health.healthy ? 'Healthy' : 'Needs attention'}
        {data.health.issues?.length ? ` - ${data.health.issues.join(', ')}` : ''}
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
