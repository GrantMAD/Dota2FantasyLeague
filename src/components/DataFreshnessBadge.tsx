'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useAccessibleDialog } from './use-accessible-dialog';
import { useDataFreshness } from '@/context/DataFreshnessContext';

interface DataFreshnessBadgeProps {
  page: string;
  className?: string;
  label?: string;
  variant?: 'badge' | 'detailed' | 'both';
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Pending sync';
  const timestamp = new Date(dateString).getTime();
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function formatCountdown(targetString: string | null): string {
  if (!targetString) return 'Scheduled';
  const targetMs = new Date(targetString).getTime();
  const diffMs = targetMs - Date.now();

  if (diffMs <= 0) return 'any moment';

  const diffSec = Math.floor(diffMs / 1000);
  const minutes = Math.floor(diffSec / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remMin = minutes % 60;
    return `in ${hours}h ${remMin}m`;
  }
  if (minutes > 0) {
    return `in ~${minutes}m`;
  }
  return `in <1m`;
}

export function DataFreshnessBadge({
  page,
  className = '',
  variant = 'both',
}: DataFreshnessBadgeProps) {
  const { dataByPage, loadingByPage, subscribePage, refreshPage, tick } = useDataFreshness();
  const data = dataByPage[page] ?? null;
  const loading = loadingByPage[page] ?? true;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    open: isModalOpen,
    onClose: closeModal,
    initialFocusRef: closeButtonRef,
  });

  useEffect(() => {
    return subscribePage(page);
  }, [page, subscribePage]);

  // Close modal on click outside.
  useEffect(() => {
    if (!isModalOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        closeModal();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [closeModal, dialogRef, isModalOpen]);

  if (loading && !data) {
    return (
      <div className={`data-freshness-loading inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs animate-pulse ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600"></span>
        <span className="text-slate-500 dark:text-slate-400">Checking sync status...</span>
      </div>
    );
  }

  const lastUpdatedText = formatRelativeTime(data?.lastUpdated ?? null);
  const nextUpdateText = formatCountdown(data?.nextUpdate ?? null);
  void tick;

  return (
    <div className={`data-freshness-container relative inline-flex items-center gap-2 ${className}`}>
      {/* OPTION 1: Standalone subtle badge / pill */}
      {(variant === 'badge' || variant === 'both') && (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="data-freshness-pill inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm shadow-sm transition-all cursor-pointer group"
          title="Click to view detailed background job schedules"
        >
          {/* Status indicator pulse dot */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 dark:bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600 dark:bg-emerald-500"></span>
          </span>

          <span className="data-freshness-label">
            Updated <span className="data-freshness-updated-value font-semibold">{lastUpdatedText}</span>
          </span>

          <span className="data-freshness-divider font-bold">•</span>

          <span className="data-freshness-label">
            Next sync <span className="data-freshness-next-value font-semibold">{nextUpdateText}</span>
          </span>

          {/* Sleek SVG info/details indicator */}
          <span className="data-freshness-info-icon p-0.5 rounded-full transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        </button>
      )}

      {/* OPTION 2: Compact Info Icon Trigger */}
      {variant === 'detailed' && (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="data-freshness-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shadow-sm"
          title="Live Data Sync Status"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 dark:bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600 dark:bg-emerald-500"></span>
          </span>
          <svg className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="data-freshness-label font-medium">Sync Status</span>
        </button>
      )}

      {/* DETAILED MODAL / FLYOUT (Option 2) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="data-freshness-title"
            tabIndex={-1}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeModal();
            }}
            className="data-freshness-modal w-full max-w-lg rounded-2xl p-6 shadow-2xl text-left relative overflow-hidden"
          >
            {/* Header glow */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-500"></div>

            {/* Modal Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <h3 id="data-freshness-title" className="text-lg font-bold data-freshness-modal-title flex items-center gap-2">
                    Live Data Sync Status
                    <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Automated
                    </span>
                  </h3>
                  <p className="text-xs data-freshness-modal-subtitle">
                    Background jobs powering data on this page
                  </p>
                </div>
              </div>

              <button
                type="button"
                ref={closeButtonRef}
                onClick={closeModal}
                className="data-freshness-close-btn p-1.5 rounded-lg transition-colors"
                aria-label="Close data freshness details"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Overall Summary Card */}
            <div className="data-freshness-summary-card grid grid-cols-2 gap-3 mb-5 p-3.5 rounded-xl">
              <div>
                <p className="data-freshness-card-label text-[11px] uppercase tracking-wider font-semibold mb-0.5">
                  Last Updated
                </p>
                <p className="text-sm font-bold data-freshness-updated-value flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                  {lastUpdatedText}
                </p>
                {data?.lastUpdated && (
                  <p className="data-freshness-card-sub text-[10px] mt-0.5">
                    {new Date(data.lastUpdated).toLocaleTimeString()}
                  </p>
                )}
              </div>

              <div>
                <p className="data-freshness-card-label text-[11px] uppercase tracking-wider font-semibold mb-0.5">
                  Next Scheduled Sync
                </p>
                <p className="text-sm font-bold data-freshness-next-value flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400 animate-pulse"></span>
                  {nextUpdateText}
                </p>
                {data?.nextUpdate && (
                  <p className="data-freshness-card-sub text-[10px] mt-0.5">
                    {new Date(data.nextUpdate).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>

            {/* Individual Job Breakdown */}
            <div className="no-scrollbar max-h-64 space-y-2.5 overflow-y-auto pr-1">
              <p className="text-xs font-semibold data-freshness-card-label uppercase tracking-wider">
                Active Job Pipelines
              </p>

              {data?.jobs && data.jobs.length > 0 ? (
                data.jobs.map((job) => (
                  <div
                    key={job.jobName}
                    className="data-freshness-job-row p-3 rounded-xl transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold data-freshness-job-title text-xs">
                          {job.title}
                        </span>
                        <code className="data-freshness-job-code text-[10px] px-1.5 py-0.5 rounded font-mono">
                          {job.schedule}
                        </code>
                      </div>
                      <span className={`data-freshness-status text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        job.status === 'running'
                          ? 'data-freshness-status-running animate-pulse'
                          : job.status === 'completed'
                          ? 'data-freshness-status-completed'
                          : 'data-freshness-status-idle'
                      }`}>
                        {job.status === 'completed' ? 'Synced' : job.status}
                      </span>
                    </div>

                    <p className="text-[11px] data-freshness-job-desc mb-2">
                      {job.description}
                    </p>

                    <div className="data-freshness-job-footer flex items-center justify-between text-[11px] pt-1.5 border-t">
                      <span>
                        Last: <strong className="data-freshness-updated-value">{formatRelativeTime(job.lastRun)}</strong>
                      </span>
                      <span>
                        Next: <strong className="data-freshness-next-value">{formatCountdown(job.nextRun)}</strong>
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs data-freshness-card-sub italic">No specific jobs registered for this page.</p>
              )}
            </div>

            {/* Footer Actions */}
            <div className="data-freshness-modal-footer flex items-center justify-between mt-5 pt-3 border-t text-xs">
              <span className="data-freshness-card-sub text-[11px]">
                Auto-syncs via background cron jobs
              </span>
              <button
                type="button"
                onClick={() => void refreshPage(page)}
                className="data-freshness-refresh-btn px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
