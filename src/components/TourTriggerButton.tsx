'use client';

import { HelpCircle, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getPageTour } from '@/lib/tourSteps';
import { useTour } from '@/context/TourContext';

export function TourTriggerButton() {
  const pathname = usePathname();
  const { isOpen, openTour, isCompleted, isDismissed, dismissReplayButton } = useTour();
  const pageTour = getPageTour(pathname);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // No tour defined, tour is currently open, or user has dismissed the replay button.
  if (!pageTour || isOpen) return null;

  // Before mount, always render the non-replay variant so server and first
  // client render agree (DB state is not available server-side).
  const showReplay = mounted && isCompleted;

  // Hide entirely once dismissed (after mount to avoid hydration mismatch).
  if (mounted && isDismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-1">
      <button
        type="button"
        onClick={openTour}
        className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-slate-950/80 px-4 py-2.5 text-sm font-semibold text-cyan-300 shadow-[0_12px_30px_rgba(34,211,238,0.18)] backdrop-blur-md transition hover:border-cyan-300 hover:bg-slate-900/90"
        aria-label={showReplay ? 'Replay this page tour' : 'Tour this page'}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-300">
          {showReplay ? <RotateCcw className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
        </span>
        <span>{showReplay ? 'Replay tour' : 'Tour this page'}</span>
      </button>

      {/* Dismiss button — only visible when the tour has been completed */}
      {showReplay && (
        <button
          type="button"
          onClick={dismissReplayButton}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700/60 bg-slate-950/80 text-slate-500 backdrop-blur-md transition hover:border-slate-500 hover:text-slate-300"
          aria-label="Hide replay button"
          title="Don't show this again"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
