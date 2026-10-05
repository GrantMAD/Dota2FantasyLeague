'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

interface TourContextValue {
  isOpen: boolean;
  closeTour: () => void;
  isGuideOpen: boolean;
  openGuide: () => void;
  closeGuide: () => void;
  startTour: () => void;
  stepIndex: number;
  setStepIndex: (n: number) => void;
  isCompleted: boolean;
  markCompleted: () => void;
  isDismissed: boolean;
  dismissReplayButton: () => void;
  pageKey: string;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

export function TourProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pageKey = pathname || '/';

  const [isOpen, setIsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Set of page keys the user has completed tours for (from the DB).
  const [completedPages, setCompletedPages] = useState<Set<string>>(new Set());
  // Set of page keys where the user has dismissed the replay button.
  const [dismissedPages, setDismissedPages] = useState<Set<string>>(new Set());
  // Whether the initial DB fetch has finished (used to avoid flash).
  const [loaded, setLoaded] = useState(false);

  // Fetch all completed/dismissed tours once on mount.
  useEffect(() => {
    fetchWithAuth('/api/user/tour-completions')
      .then((res) => res.json())
      .then((data: { completions?: string[]; dismissed?: string[] }) => {
        if (Array.isArray(data.completions)) {
          setCompletedPages(new Set(data.completions));
        }
        if (Array.isArray(data.dismissed)) {
          setDismissedPages(new Set(data.dismissed));
        }
      })
      .catch(() => {
        // Unauthenticated or network error — silently fall back to empty.
      })
      .finally(() => setLoaded(true));
  }, []);

  const isCompleted = loaded && completedPages.has(pageKey);
  const isDismissed = loaded && dismissedPages.has(pageKey);

  const closeTour = useCallback(() => {
    setIsOpen(false);
    setStepIndex(0);
  }, []);

  const openGuide = useCallback(() => {
    setIsOpen(false);
    setIsGuideOpen(true);
  }, []);

  const closeGuide = useCallback(() => {
    setIsGuideOpen(false);
  }, []);

  const startTour = useCallback(() => {
    setIsGuideOpen(false);
    setStepIndex(0);
    setIsOpen(true);
  }, []);

  const markCompleted = useCallback(() => {
    // Optimistic update so the UI switches immediately.
    setCompletedPages((prev) => new Set([...prev, pageKey]));

    fetchWithAuth('/api/user/tour-completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageKey }),
    }).catch(() => {
      // Roll back optimistic update on failure.
      setCompletedPages((prev) => {
        const next = new Set(prev);
        next.delete(pageKey);
        return next;
      });
    });
  }, [pageKey]);

  const dismissReplayButton = useCallback(() => {
    // Optimistic update — hide instantly.
    setDismissedPages((prev) => new Set([...prev, pageKey]));

    fetchWithAuth('/api/user/tour-completions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageKey }),
    }).catch(() => {
      // Roll back on failure.
      setDismissedPages((prev) => {
        const next = new Set(prev);
        next.delete(pageKey);
        return next;
      });
    });
  }, [pageKey]);

  const value = useMemo<TourContextValue>(
    () => ({
      isOpen,
      closeTour,
      isGuideOpen,
      openGuide,
      closeGuide,
      startTour,
      stepIndex,
      setStepIndex,
      isCompleted,
      markCompleted,
      isDismissed,
      dismissReplayButton,
      pageKey,
    }),
    [closeGuide, closeTour, dismissReplayButton, isCompleted, isDismissed, isGuideOpen, isOpen, markCompleted, openGuide, pageKey, startTour, stepIndex],
  );

  return <TourContext.Provider key={pageKey} value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const context = useContext(TourContext);

  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }

  return context;
}
