import { AlertTriangle, RefreshCw } from 'lucide-react';

interface DashboardErrorAlertProps {
  error: string;
  loading: boolean;
  onRetry: () => void;
}

export function DashboardErrorAlert({ error, loading, onRetry }: DashboardErrorAlertProps) {
  return (
    <div
      role="alert"
      className="mb-6 flex flex-col gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Dashboard data could not be loaded</p>
          <p className="mt-1 break-words">{error}</p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Retry dashboard data"
        onClick={onRetry}
        disabled={loading}
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-rose-500/40 px-3 py-2 font-semibold transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-60 sm:self-center"
      >
        <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );
}
