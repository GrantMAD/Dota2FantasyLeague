'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, LayoutDashboard, Home } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled Dashboard Error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full rounded-2xl border border-slate-700/80 bg-slate-800/80 backdrop-blur-sm p-8 text-center shadow-xl shadow-black/40">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-slate-400 text-sm mb-6">
          An unexpected error occurred while rendering this page. You can attempt to retry or return to your dashboard.
        </p>

        {error.message && process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-3 rounded-lg bg-slate-900/80 border border-slate-700/60 text-left">
            <p className="text-xs font-mono text-red-300 break-words">{error.message}</p>
            {error.digest && (
              <p className="text-[10px] font-mono text-slate-500 mt-1">Digest: {error.digest}</p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-linear-to-r from-amber-500 to-orange-600 text-white hover:shadow-lg hover:shadow-orange-500/20 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
