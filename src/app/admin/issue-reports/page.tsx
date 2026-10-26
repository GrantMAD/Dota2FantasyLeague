'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { AlertTriangle, Bug, CheckCircle2, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';

type ReportStatus = 'new' | 'under_review' | 'in_progress' | 'resolved' | 'closed';
type ReportCategory = 'bug' | 'error' | 'ui';

interface IssueReport {
  id: number;
  user_id: string;
  title: string;
  category: ReportCategory;
  description: string;
  page_url: string | null;
  screenshot_url: string | null;
  status: ReportStatus;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  reporter: { id: string; username: string; display_name: string | null } | null;
}

interface StatusHistory {
  id: number;
  issue_report_id: number;
  changed_by: string | null;
  old_status: ReportStatus | null;
  new_status: ReportStatus;
  resolution_note: string | null;
  created_at: string;
}

const statusLabels: Record<ReportStatus, string> = {
  new: 'New',
  under_review: 'Under review',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};
const categoryLabels: Record<ReportCategory, string> = { bug: 'Bug', error: 'Error', ui: 'UI problem' };
const reportStatuses = Object.keys(statusLabels) as ReportStatus[];

export default function AdminIssueReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<number, { status: ReportStatus; note: string }>>({});

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), status: statusFilter, category: categoryFilter });
      if (appliedSearch) params.set('search', appliedSearch);
      const response = await fetchWithAuth(`/api/admin/issue-reports?${params.toString()}`);
      const data = await response.json() as { reports?: IssueReport[]; history?: StatusHistory[]; total?: number; error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to load issue reports.');
      setReports(data.reports ?? []);
      setHistory(data.history ?? []);
      setTotal(data.total ?? 0);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load issue reports.');
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, categoryFilter, page, statusFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadReports(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadReports]);

  async function saveStatus(report: IssueReport) {
    const change = pendingChanges[report.id];
    if (!change) return;
    setSavingId(report.id);
    try {
      const response = await fetchWithAuth('/api/admin/issue-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: report.id,
          status: change.status,
          resolution_note: change.note,
        }),
      });
      const data = await response.json() as { report?: IssueReport; status_changed?: boolean; push?: { accepted: number; errors: string[] }; error?: string };
      if (!response.ok || !data.report) throw new Error(data.error || 'Unable to update report status.');
      setReports((current) => current.map((item) => item.id === report.id ? { ...item, ...data.report!, reporter: item.reporter, screenshot_url: item.screenshot_url } : item));
      setPendingChanges((current) => {
        const next = { ...current };
        delete next[report.id];
        return next;
      });
      if (data.push?.errors.length) {
        toast.success('Status saved', 'The in-app notification was created, but push delivery reported an issue.');
      } else {
        toast.success(data.status_changed ? 'Status updated' : 'Report saved', data.status_changed ? 'The reporter was notified in-app and by push if enabled.' : 'No status change was made.');
      }
      setError(null);
      await loadReports();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to update report status.';
      setError(message);
      toast.error('Update failed', message);
    } finally {
      setSavingId(null);
    }
  }

  const historyByReport = new Map<number, StatusHistory[]>();
  for (const entry of history) {
    const list = historyByReport.get(entry.issue_report_id) ?? [];
    list.push(entry);
    historyByReport.set(entry.issue_report_id, list);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Support queue</p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-black text-white"><Bug className="h-7 w-7 text-amber-400" />Issue reports</h1>
          <p className="mt-2 text-sm text-gray-400">Review user-submitted bugs, errors, and interface problems; status changes notify the reporter.</p>
        </div>
        <button type="button" onClick={() => void loadReports()} className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-gray-800">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </header>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/70">
        <label className="text-xs font-semibold text-gray-400">Search reports
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title or description" maxLength={100} className="mt-1 block w-full min-w-52 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-600" />
        </label>
        <label className="text-xs font-semibold text-gray-400">Status
          <select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }} className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
            <option value="all">All statuses</option>
            {reportStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-gray-400">Category
          <select value={categoryFilter} onChange={(event) => { setPage(1); setCategoryFilter(event.target.value); }} className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
            <option value="all">All categories</option>
            {Object.entries(categoryLabels).map(([category, label]) => <option key={category} value={category}>{label}</option>)}
          </select>
        </label>
        <p className="ml-auto self-end pb-2 text-sm text-gray-400">{total} report{total === 1 ? '' : 's'}</p>
      </div>

      {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      {loading ? <div className="flex items-center gap-2 py-10 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />Loading reports...</div> : reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-700 p-10 text-center text-sm text-gray-400">No issue reports match these filters.</div>
      ) : (
        <div className="space-y-5">
          {reports.map((report) => {
            const change = pendingChanges[report.id] ?? { status: report.status, note: report.resolution_note ?? '' };
            return (
              <article key={report.id} className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900/70">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">{categoryLabels[report.category]}</span>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">{statusLabels[report.status]}</span>
                      <span className="text-xs text-gray-500">Report #{report.id}</span>
                    </div>
                    <h2 className="text-lg font-bold text-white">{report.title}</h2>
                    <p className="mt-1 text-xs text-gray-400">
                      Submitted by {report.reporter?.display_name || report.reporter?.username || 'Unknown user'} · {new Date(report.created_at).toLocaleString()}
                      {report.page_url && <> · <a href={report.page_url} target="_blank" rel="noreferrer" className="underline hover:text-cyan-300">{report.page_url}</a></>}
                    </p>
                  </div>
                  {report.screenshot_url && <a href={report.screenshot_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:underline">Open screenshot <ExternalLink className="h-3 w-3" /></a>}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-gray-300">{report.description}</p>
                {report.screenshot_url && <a href={report.screenshot_url} target="_blank" rel="noreferrer"><Image src={report.screenshot_url} alt={`Screenshot attached to report ${report.id}`} width={960} height={640} unoptimized className="max-h-72 w-auto max-w-full rounded-xl border border-gray-700 object-contain" /></a>}

                <div className="grid gap-4 border-t border-gray-800 pt-4 lg:grid-cols-[220px_1fr_auto] lg:items-end">
                  <label className="text-xs font-semibold text-gray-400">Update status
                    <select value={change.status} onChange={(event) => setPendingChanges((current) => ({ ...current, [report.id]: { ...change, status: event.target.value as ReportStatus } }))} className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                      {reportStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-gray-400">Resolution or progress note
                    <textarea value={change.note} onChange={(event) => setPendingChanges((current) => ({ ...current, [report.id]: { ...change, note: event.target.value } }))} maxLength={2000} rows={2} placeholder="Optional update shown to the reporter" className="mt-1 block w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-600" />
                  </label>
                  <button type="button" onClick={() => void saveStatus(report)} disabled={savingId === report.id} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-gray-950 hover:bg-amber-400 disabled:opacity-60">
                    {savingId === report.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Save update
                  </button>
                </div>
                {(historyByReport.get(report.id)?.length ?? 0) > 0 && (
                  <ol className="space-y-2 border-l border-gray-700 pl-4">
                    {historyByReport.get(report.id)?.map((entry) => (
                      <li key={entry.id} className="text-xs text-gray-500">
                        {entry.old_status ? `${statusLabels[entry.old_status]} → ` : 'Submitted as '}{statusLabels[entry.new_status]} · {new Date(entry.created_at).toLocaleString()}
                        {entry.resolution_note && <p className="mt-1 whitespace-pre-wrap text-gray-400">{entry.resolution_note}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </article>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>Page {page} of {Math.max(1, Math.ceil(total / 50))}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-gray-700 px-3 py-1.5 disabled:opacity-40">Previous</button>
          <button type="button" disabled={page >= Math.ceil(total / 50) || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-gray-700 px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
