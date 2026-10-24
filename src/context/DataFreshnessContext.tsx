'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

interface JobDetailItem {
  jobName: string;
  title: string;
  description: string;
  schedule: string;
  status: string;
  lastRun: string | null;
  nextRun: string | null;
}

export interface FreshnessData {
  lastUpdated: string | null;
  nextUpdate: string | null;
  jobName?: string;
  serverTime: string;
  jobs?: JobDetailItem[];
}

interface DataFreshnessContextValue {
  dataByPage: Record<string, FreshnessData | undefined>;
  loadingByPage: Record<string, boolean | undefined>;
  tick: number;
  subscribePage: (page: string) => () => void;
  refreshPage: (page: string) => Promise<void>;
}

const DataFreshnessContext = createContext<DataFreshnessContextValue | null>(null);

export function DataFreshnessProvider({ children }: { children: ReactNode }) {
  const [dataByPage, setDataByPage] = useState<Record<string, FreshnessData | undefined>>({});
  const [loadingByPage, setLoadingByPage] = useState<Record<string, boolean | undefined>>({});
  const [tick, setTick] = useState(0);
  const activePageCounts = useRef(new Map<string, number>());
  const pendingRequests = useRef(new Map<string, Promise<void>>());

  const loadPage = useCallback((page: string) => {
    const pending = pendingRequests.current.get(page);
    if (pending) return pending;

    setLoadingByPage((current) => ({ ...current, [page]: current[page] ?? true }));
    const request = (async () => {
      try {
        const response = await fetchWithAuth(`/api/data/freshness?page=${encodeURIComponent(page)}`);
        if (!response.ok) throw new Error(`Freshness request failed with status ${response.status}`);
        const json = await response.json();
        if (!json.success) throw new Error('Freshness request returned an unsuccessful response');
        setDataByPage((current) => ({ ...current, [page]: json as FreshnessData }));
      } catch (error) {
        console.warn(`[Data Freshness] Could not refresh ${page} status:`, error);
      } finally {
        setLoadingByPage((current) => ({ ...current, [page]: false }));
        pendingRequests.current.delete(page);
      }
    })();
    pendingRequests.current.set(page, request);
    return request;
  }, []);

  const subscribePage = useCallback((page: string) => {
    const subscribers = activePageCounts.current.get(page) ?? 0;
    activePageCounts.current.set(page, subscribers + 1);
    if (subscribers === 0) void loadPage(page);
    return () => {
      const remaining = (activePageCounts.current.get(page) ?? 1) - 1;
      if (remaining > 0) activePageCounts.current.set(page, remaining);
      else activePageCounts.current.delete(page);
    };
  }, [loadPage]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        activePageCounts.current.forEach((_, page) => void loadPage(page));
      }
    }, 120_000);
    const tickInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') setTick((current) => current + 1);
    }, 15_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        activePageCounts.current.forEach((_, page) => void loadPage(page));
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(tickInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadPage]);

  const value = useMemo(
    () => ({ dataByPage, loadingByPage, tick, subscribePage, refreshPage: loadPage }),
    [dataByPage, loadingByPage, loadPage, subscribePage, tick],
  );

  return <DataFreshnessContext.Provider value={value}>{children}</DataFreshnessContext.Provider>;
}

export function useDataFreshness() {
  const context = useContext(DataFreshnessContext);
  if (!context) throw new Error('useDataFreshness must be used within DataFreshnessProvider');
  return context;
}
