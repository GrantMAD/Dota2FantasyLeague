'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { ActiveGameweekHero } from './components/ActiveGameweekHero';
import { GameweekCard } from './components/GameweekCard';
import { GameweekHistoryModal } from './components/GameweekHistoryModal';
import { GameweekFilters } from './components/GameweekFilters';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';

import type { GameweekRow } from '@/types/fantasy';
import {
  getServerGameweekViewMode,
  getStoredGameweekViewMode,
  saveGameweekViewMode,
  subscribeToGameweekViewMode,
} from './gameweeks-utils';
export type { GameweekRow };

export type GameweekTab = 'all' | 'planning' | 'past';

const isWeekPast = (gw: GameweekRow) => gw.status === 'closed' || gw.status === 'locked';

export default function GameweeksPage({ initialGameweeks }: { initialGameweeks: GameweekRow[] }) {
  const [gameweeks, setGameweeks] = useState<GameweekRow[]>(initialGameweeks);
  const [loading, setLoading] = useState(initialGameweeks.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GameweekTab>('all');
  const viewMode = useSyncExternalStore(
    subscribeToGameweekViewMode,
    getStoredGameweekViewMode,
    getServerGameweekViewMode,
  );
  const [historyGameweek, setHistoryGameweek] = useState<GameweekRow | null>(null);
  const [expandedGameweekIds, setExpandedGameweekIds] = useState<Set<number> | null>(
    () => new Set(initialGameweeks.filter((gameweek) => gameweek.status === 'active').map((gameweek) => gameweek.id)),
  );

  useEffect(() => {
    let cancelled = false;
    async function fetchGameweeks() {
      try {
        const res = await fetchWithAuth('/api/gameweeks');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load gameweeks');
        }
        if (cancelled) return;
        const loadedGameweeks: GameweekRow[] = Array.isArray(data.gameweeks) ? data.gameweeks : [];
        setGameweeks(loadedGameweeks);
        setExpandedGameweekIds((current) => current === null
          ? new Set(loadedGameweeks.filter((gameweek) => gameweek.status === 'active').map((gameweek) => gameweek.id))
          : current);
        setError(null);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load gameweeks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (initialGameweeks.length === 0) void fetchGameweeks();
    const refreshInterval = window.setInterval(() => void fetchGameweeks(), 65_000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [initialGameweeks.length]);

  useEffect(() => {
    if (initialGameweeks.length === 0) return;
    let cancelled = false;
    const params = new URLSearchParams({
      scoresOnly: 'true',
      gameweekIds: initialGameweeks.map((gameweek) => String(gameweek.id)).join(','),
    });
    void fetchWithAuth(`/api/gameweeks?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) {
          if (response.status !== 401) throw new Error(`Failed to load gameweek scores (${response.status})`);
          return null;
        }
        return response.json();
      })
      .then((data) => {
        if (cancelled || !data || typeof data.user_scores !== 'object') return;
        const userScores = data.user_scores as Record<string, number>;
        setGameweeks((current) => current.map((gameweek) => ({
          ...gameweek,
          user_score: userScores[String(gameweek.id)] ?? null,
        })));
      })
      .catch((error: unknown) => console.warn('[Gameweeks] Failed to load personalized scores:', error));
    return () => {
      cancelled = true;
    };
  }, [initialGameweeks]);

  const activeGameweek = useMemo(
    () => gameweeks.find((gw) => gw.status === 'active') ?? gameweeks.find((gw) => gw.status === 'upcoming') ?? null,
    [gameweeks]
  );

  const filteredGameweeks = useMemo(() => {
    if (activeTab === 'planning') {
      return gameweeks.filter((gw) => gw.status === 'active' || gw.status === 'upcoming');
    }

    if (activeTab === 'past') {
      return gameweeks.filter(isWeekPast);
    }

    return gameweeks;
  }, [gameweeks, activeTab]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300">
              Fantasy Schedule
            </div>
            <DataFreshnessBadge page="gameweeks" />
          </div>
          <h1 className="gameweeks-page-heading text-3xl font-black tracking-tight text-[var(--text-primary)]">Gameweeks</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
            Track deadlines, fixtures, DGW/BGW windows, and your recent results in one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/gameweeks/planner"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-800 dark:text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/15"
          >
            My Squad Planner
          </Link>
          <details className="relative hidden md:block xl:hidden">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:border-amber-400 hover:bg-amber-500/15 dark:text-amber-200">
              More actions
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </summary>
            <div className="absolute right-0 z-20 mt-2 grid min-w-48 gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-xl">
              <Link href="/season-recap" className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]">
                Season Recap
              </Link>
              <Link href="/lineups" className="rounded-lg px-3 py-2 text-sm text-amber-700 hover:bg-[var(--surface-raised)] dark:text-amber-300">
                Edit Lineup
              </Link>
              <Link href="/transfers" className="gameweeks-transfer-link rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]">
                Transfer Market
              </Link>
              {activeGameweek && (
                <Link
                  href={`/gameweeks/${activeGameweek.id}`}
                  className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                >
                  Gameweek Results
                </Link>
              )}
            </div>
          </details>
          <Link
            href="/season-recap"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 transition hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-950 dark:hover:text-white md:hidden xl:inline-flex"
          >
            Season Recap
          </Link>
          <Link
            href="/lineups"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300 transition hover:border-amber-400 hover:bg-amber-500/15 md:hidden xl:inline-flex"
          >
            Edit Lineup
          </Link>
          <Link
            href="/transfers"
            className="gameweeks-transfer-link inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white md:hidden xl:inline-flex"
          >
            Transfer Market
          </Link>
          {activeGameweek && (
            <Link
              href={`/gameweeks/${activeGameweek.id}`}
              className="gameweeks-matches-link inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white md:hidden xl:inline-flex"
            >
              Gameweek Results
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-8 rounded-2xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <GameweekFilters
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={saveGameweekViewMode}
      />

      {loading ? (
        <div className="space-y-6">
          <div className="animate-pulse rounded-3xl border border-[var(--border)] bg-[var(--surface-raised)] p-6">
            <div className="mb-4 h-6 w-48 rounded bg-[var(--surface)]" />
            <div className="mb-3 h-10 w-72 rounded bg-[var(--surface)]" />
            <div className="h-4 w-full rounded bg-[var(--surface)]" />
          </div>
          {[1, 2, 3].map((item) => (
            <div key={item} className="animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-5">
              <div className="mb-4 h-4 w-40 rounded bg-[var(--surface)]" />
              <div className="h-24 rounded bg-[var(--surface)]" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {activeGameweek && (
            <ActiveGameweekHero gameweek={activeGameweek} />
          )}

          <div className={viewMode === 'compact' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-5'}>
            {filteredGameweeks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center text-slate-400">
                No gameweeks match this filter.
              </div>
            ) : (
              filteredGameweeks.map((gw) => (
              <GameweekCard
                key={gw.id}
                gameweek={gw}
                compact={viewMode === 'compact'}
                expanded={expandedGameweekIds?.has(gw.id) ?? false}
                onExpandedChange={(expanded) => setExpandedGameweekIds((current) => {
                  const updated = new Set(current ?? []);
                  if (expanded) updated.add(gw.id);
                  else updated.delete(gw.id);
                  return updated;
                })}
                onHistoryClick={setHistoryGameweek}
              />
              ))
            )}
          </div>
        </>
      )}
      {historyGameweek && (
        <GameweekHistoryModal
          gameweekId={historyGameweek.id}
          gameweekNumber={historyGameweek.gameweek_number}
          onClose={() => setHistoryGameweek(null)}
        />
      )}
    </div>
  );
}
