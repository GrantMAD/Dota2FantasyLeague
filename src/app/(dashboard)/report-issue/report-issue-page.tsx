'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { AlertTriangle, Bug, CheckCircle2, ImagePlus, Loader2, Send, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';

type ReportStatus = 'new' | 'under_review' | 'in_progress' | 'resolved' | 'closed';
type ReportCategory = 'bug' | 'error' | 'ui';

interface IssueReport {
  id: number;
  title: string;
  category: ReportCategory;
  description: string;
  page_url: string | null;
  screenshot_url: string | null;
  status: ReportStatus;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

interface StatusHistory {
  id: number;
  issue_report_id: number;
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

const categoryLabels: Record<ReportCategory, string> = {
  bug: 'Bug',
  error: 'Error message',
  ui: 'UI problem',
};

export default function ReportIssuePage() {
  const toast = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ReportCategory>('bug');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const highlightedReportId = Number(searchParams.get('report'));
  const groupedHistory = useMemo(() => {
    const grouped = new Map<number, StatusHistory[]>();
    for (const entry of history) {
      const list = grouped.get(entry.issue_report_id) ?? [];
      list.push(entry);
      grouped.set(entry.issue_report_id, list);
    }
    return grouped;
  }, [history]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (Number.isSafeInteger(highlightedReportId) && highlightedReportId > 0) {
        params.set('reportId', String(highlightedReportId));
      }
      const query = params.size ? `?${params.toString()}` : '';
      const response = await fetchWithAuth(`/api/issue-reports${query}`);
      const data = await response.json() as { reports?: IssueReport[]; history?: StatusHistory[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to load your reports.');
      setReports(data.reports ?? []);
      setHistory(data.history ?? []);
      setLoadError(null);
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load your reports.');
    } finally {
      setLoading(false);
    }
  }, [highlightedReportId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadReports(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadReports]);
  useEffect(() => () => {
    if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
  }, [screenshotPreview]);

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const formData = new FormData();
    formData.set('title', title);
    formData.set('category', category);
    formData.set('description', description);
    formData.set('page_url', `${pathname}${window.location.search}`);
    if (screenshot) formData.set('screenshot', screenshot);

    try {
      const response = await fetchWithAuth('/api/issue-reports', { method: 'POST', body: formData });
      const data = await response.json() as { report?: IssueReport; message?: string; error?: string };
      if (!response.ok || !data.report) throw new Error(data.error || 'Unable to submit your report.');
      setReports((current) => [data.report!, ...current]);
      setTitle('');
      setCategory('bug');
      setDescription('');
      setScreenshot(null);
      setScreenshotPreview(null);
      toast.success('Report submitted', 'You can track its status below.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to submit your report.';
      setSubmitError(message);
      toast.error('Report not submitted', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500"><Bug className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">Help us improve</p>
            <h1 className="text-3xl font-black text-[var(--text-primary)]">Report an issue</h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
          Tell us about a bug, error, or interface problem. Your report is private to you and the support team, and you can follow its status here.
        </p>
      </header>

      <form onSubmit={submitReport} className="space-y-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-[var(--text-primary)]">
            Issue type
            <select value={category} onChange={(event) => setCategory(event.target.value as ReportCategory)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3">
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-[var(--text-primary)]">
            Short title
            <input required minLength={5} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What went wrong?" className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3" />
          </label>
        </div>
        <label className="block space-y-2 text-sm font-semibold text-[var(--text-primary)]">
          What happened?
          <textarea required minLength={10} maxLength={5000} rows={6} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what you expected and what happened instead." className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3" />
          <span className="block text-right text-xs font-normal text-[var(--text-muted)]">{description.length}/5000</span>
        </label>

        <div className="space-y-2">
          <label htmlFor="issue-screenshot" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] hover:border-cyan-500/50">
            <ImagePlus className="h-4 w-4 text-cyan-500" /> Add screenshot (optional)
          </label>
          <input id="issue-screenshot" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setScreenshot(file);
            setScreenshotPreview(file ? URL.createObjectURL(file) : null);
          }} />
          <p className="text-xs text-[var(--text-muted)]">JPEG, PNG, or WebP; maximum 5 MB. Screenshots are stored privately.</p>
          {screenshot && (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3">
              {screenshotPreview && <Image src={screenshotPreview} alt="Screenshot preview" width={96} height={64} unoptimized className="h-16 w-24 rounded-lg object-cover" />}
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]">{screenshot.name}</span>
              <button type="button" onClick={() => { setScreenshot(null); setScreenshotPreview(null); }} aria-label="Remove screenshot" className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"><X className="h-4 w-4" /></button>
            </div>
          )}
        </div>

        {submitError && <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300"><AlertTriangle className="h-4 w-4 shrink-0" />{submitError}</p>}
        <button disabled={submitting} type="submit" className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? 'Submitting...' : 'Submit report'}
        </button>
      </form>

      <section className="space-y-4" aria-labelledby="my-reports-heading">
        <div className="flex items-center justify-between">
          <h2 id="my-reports-heading" className="text-xl font-bold text-[var(--text-primary)]">Your reports</h2>
          <button type="button" onClick={() => void loadReports()} className="text-sm font-semibold text-cyan-600 hover:underline dark:text-cyan-300">Refresh</button>
        </div>
        {loading ? <p className="text-sm text-[var(--text-muted)]">Loading your reports...</p> : loadError ? (
          <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-300">{loadError}</p>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-sm text-[var(--text-muted)]">You have not submitted any issue reports yet.</div>
        ) : reports.map((report) => (
          <article key={report.id} id={`report-${report.id}`} className={`space-y-4 rounded-2xl border bg-[var(--surface)] p-5 ${highlightedReportId === report.id ? 'border-cyan-500 ring-2 ring-cyan-500/20' : 'border-[var(--border)]'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">{categoryLabels[report.category]}</span>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">{statusLabels[report.status]}</span>
                </div>
                <h3 className="font-bold text-[var(--text-primary)]">{report.title}</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Submitted {new Date(report.created_at).toLocaleString()} {report.page_url ? `· ${report.page_url}` : ''}</p>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{report.description}</p>
            {report.screenshot_url && <a href={report.screenshot_url} target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold text-cyan-600 hover:underline dark:text-cyan-300">View attached screenshot</a>}
            {report.resolution_note && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />Team update</p><p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{report.resolution_note}</p></div>}
            {(groupedHistory.get(report.id)?.length ?? 0) > 0 && (
              <ol className="space-y-2 border-l border-[var(--border)] pl-4">
                {groupedHistory.get(report.id)?.map((entry) => (
                  <li key={entry.id} className="text-xs text-[var(--text-muted)]">
                    {entry.old_status ? `${statusLabels[entry.old_status]} → ` : 'Submitted as '}{statusLabels[entry.new_status]} · {new Date(entry.created_at).toLocaleString()}
                  </li>
                ))}
              </ol>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
