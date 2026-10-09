'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import type { TelemetryEventType, TelemetrySummary } from '@/lib/telemetry';

interface TelemetryRow {
  id: number;
  recorded_at: string;
  event_type: TelemetryEventType;
  trace_id: string | null;
  route: string | null;
  method: string | null;
  resource: string | null;
  status_code: number | null;
  duration_ms: number | null;
  error_class: string | null;
  deployment_id: string | null;
  sample_rate: number | null;
  metadata: Record<string, string | number | boolean | null> | null;
}

interface TelemetryResponse {
  summary: TelemetrySummary;
  summarySampleCapped: boolean;
  summaryIsEstimated: boolean;
  events: TelemetryRow[];
  page: number;
  pageSize: number;
  windowHours: number;
}

const EVENT_LABELS: Record<TelemetryEventType, string> = {
  page_view: 'Page view',
  api_request: 'API request',
  database_request: 'Database',
  provider_request: 'Provider',
};

export default function AdminTelemetryPage() {
  const [data, setData] = useState<TelemetryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState('24');
  const [eventType, setEventType] = useState('');
  const [route, setRoute] = useState('');
  const [traceId, setTraceId] = useState('');
  const [appliedRoute, setAppliedRoute] = useState('');
  const [appliedTraceId, setAppliedTraceId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAppliedRoute(route.trim());
      setAppliedTraceId(traceId.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [route, traceId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ hours, page: String(page), limit: '50' });
      if (eventType) params.set('event_type', eventType);
      if (appliedRoute) params.set('route', appliedRoute);
      if (appliedTraceId) params.set('trace_id', appliedTraceId);
      const response = await fetchWithAuth(`/api/admin/telemetry?${params.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load telemetry.');
      setData(body as TelemetryResponse);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load telemetry.');
    } finally {
      setLoading(false);
    }
  }, [appliedRoute, appliedTraceId, eventType, hours, page]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const summary = data?.summary;
  const cards = [
    ['Page views', summary?.pageViews ?? 0],
    ['API requests', summary?.apiRequests ?? 0],
    ['DB events (sampled)', summary?.databaseRequests ?? 0],
    ['Provider calls', summary?.providerRequests ?? 0],
    ['Errors', summary?.errors ?? 0],
    ['Avg / p95 latency', `${summary?.averageDurationMs ?? 0} / ${summary?.p95DurationMs ?? 0} ms`],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Activity className="h-8 w-8 text-amber-400" /> Interaction Telemetry
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Full request volume is summarized in minute buckets; detailed rows retain errors, requests slower than 2 seconds, and a 1% sample of routine activity. Payloads, credentials, and user-entered content are excluded.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Telemetry summary">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="mt-2 text-xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </section>

      {data?.summaryIsEstimated && (
        <p className="rounded border border-sky-700/60 bg-sky-900/20 p-3 text-sm text-sky-200">
          Summary totals are aggregated by minute. Successful database reads are weighted to estimate total volume from the configured read sample; the event table below contains only retained detail traces.
        </p>
      )}
      {data?.summarySampleCapped && (
        <p className="rounded border border-amber-700/60 bg-amber-900/20 p-3 text-sm text-amber-200">
          Trace summaries use the newest 1,000 retained details; narrow the filters for a more focused view.
        </p>
      )}
      {error && <p role="alert" className="rounded border border-red-700 bg-red-900/20 p-4 text-red-300">{error}</p>}

      <section className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-800 p-4">
          <label className="text-sm text-gray-300">
            Time window
            <select
              value={hours}
              onChange={(event) => { setHours(event.target.value); setPage(1); }}
              className="ml-2 rounded border border-gray-700 bg-gray-950 px-3 py-2 text-white"
            >
              <option value="1">Last hour</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
              <option value="720">30 days</option>
              <option value="2160">90 days</option>
              <option value="4320">180 days</option>
            </select>
          </label>
          <label className="text-sm text-gray-300">
            Event
            <select
              value={eventType}
              onChange={(event) => { setEventType(event.target.value); setPage(1); }}
              className="ml-2 rounded border border-gray-700 bg-gray-950 px-3 py-2 text-white"
            >
              <option value="">All event types</option>
              {Object.entries(EVENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="flex min-w-56 flex-1 items-center gap-2 text-sm text-gray-300">
            Route
            <input
              value={route}
              onChange={(event) => { setRoute(event.target.value); setPage(1); }}
              maxLength={240}
              placeholder="/api/fantasy/lineup"
              className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-950 px-3 py-2 text-white placeholder:text-gray-600"
            />
          </label>
          <label className="flex min-w-64 flex-1 items-center gap-2 text-sm text-gray-300">
            Trace ID
            <input
              value={traceId}
              onChange={(event) => { setTraceId(event.target.value); setPage(1); }}
              maxLength={64}
              placeholder="Filter correlated events"
              className="min-w-0 flex-1 rounded border border-gray-700 bg-gray-950 px-3 py-2 text-white placeholder:text-gray-600"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <p className="border-b border-gray-800 px-4 py-3 text-sm text-gray-400">
            Retained detail traces — errors, slow requests, and a 1% routine sample
          </p>
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-gray-800/70 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Route / Resource</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Sample</th>
                <th className="px-4 py-3">Trace</th>
                <th className="px-4 py-3">Safe metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data?.events.map((row) => (
                <tr key={row.id} className="align-top text-gray-200">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-400">{new Date(row.recorded_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{EVENT_LABELS[row.event_type] ?? row.event_type}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.route ?? row.resource ?? '—'}{row.method ? ` · ${row.method}` : ''}</td>
                  <td className={`px-4 py-3 ${row.status_code !== null && row.status_code >= 400 ? 'text-red-300' : ''}`}>
                    {row.status_code ?? row.error_class ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{row.duration_ms === null ? '—' : `${row.duration_ms} ms`}</td>
                  <td className="px-4 py-3">{Math.round((row.sample_rate ?? 1) * 100)}%</td>
                  <td className="max-w-36 truncate px-4 py-3 font-mono text-xs text-gray-400" title={row.trace_id ?? undefined}>{row.trace_id ?? '—'}</td>
                  <td className="max-w-64 truncate px-4 py-3 font-mono text-xs text-gray-500" title={JSON.stringify(row.metadata ?? {})}>
                    {JSON.stringify(row.metadata ?? {})}
                  </td>
                </tr>
              ))}
              {!loading && !error && data?.events.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No retained detail traces match this filter; aggregated activity is included above.</td></tr>
              )}
              {loading && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Loading telemetry…</td></tr>}
            </tbody>
          </table>
        </div>

        <footer className="flex items-center justify-between border-t border-gray-800 px-4 py-3 text-sm text-gray-400">
          <span>{(data?.summary.sampleSize ?? 0).toLocaleString()} estimated events in summary</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              aria-label="Previous page"
              className="rounded border border-gray-700 p-2 hover:bg-gray-800 disabled:opacity-40"
            ><ChevronLeft className="h-4 w-4" /></button>
            <span>Page {page}</span>
            <button
              type="button"
              disabled={loading || (data !== null && data.events.length < data.pageSize)}
              onClick={() => setPage((current) => current + 1)}
              aria-label="Next page"
              className="rounded border border-gray-700 p-2 hover:bg-gray-800 disabled:opacity-40"
            ><ChevronRight className="h-4 w-4" /></button>
          </div>
        </footer>
      </section>
    </div>
  );
}
