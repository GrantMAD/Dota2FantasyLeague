'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ActiveGameweekHero } from './components/ActiveGameweekHero';
import { GameweekCard } from './components/GameweekCard';
import { GameweekHistoryModal } from './components/GameweekHistoryModal';
import { GameweekFilters } from './components/GameweekFilters';

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

export default function GameweeksPage() {
  const [gameweeks, setGameweeks] = useState<GameweekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GameweekTab>('all');
  const viewMode = useSyncExternalStore(
    subscribeToGameweekViewMode,
    getStoredGameweekViewMode,
    getServerGameweekViewMode,
  );
  const [historyGameweek, setHistoryGameweek] = useState<GameweekRow | null>(null);

  useEffect(() => {
    async function fetchGameweeks() {
      try {
        setLoading(true);
        const res = await fetchWithAuth('/api/gameweeks');
        const data = await res.json();
        setGameweeks(Array.isArray(data.gameweeks) ? data.gameweeks : []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load gameweeks');
      } finally {
        setLoading(false);
      }
    }

    fetchGameweeks();
  }, []);

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
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300">
            Fantasy Schedule
          </div>
          <h1 className="gameweeks-page-heading text-3xl font-black tracking-tight text-white">Gameweeks</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Track deadlines, fixtures, DGW/BGW windows, and your recent results in one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/gameweeks/planner"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/15"
          >
            My Squad Planner
          </Link>
          <details className="relative hidden md:block xl:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white">
              More actions
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 grid min-w-48 gap-1 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl shadow-slate-950/50">
              <Link href="/season-recap" className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
                Season Recap
              </Link>
              <Link href="/lineups" className="rounded-lg px-3 py-2 text-sm text-amber-300 hover:bg-slate-800">
                Edit Lineup
              </Link>
              <Link href="/transfers" className="gameweeks-transfer-link rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
                Transfer Market
              </Link>
              {activeGameweek && (
                <Link
                  href={`/matches?gameweekId=${activeGameweek.id}`}
                  className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  Gameweek Matches
                </Link>
              )}
            </div>
          </details>
          <Link
            href="/season-recap"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white md:hidden xl:inline-flex"
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
              href={`/matches?gameweekId=${activeGameweek.id}`}
              className="gameweeks-matches-link inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white md:hidden xl:inline-flex"
            >
              Gameweek Matches
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-8 rounded-2xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-4 h-6 w-48 rounded bg-slate-800" />
            <div className="mb-3 h-10 w-72 rounded bg-slate-800" />
            <div className="h-4 w-full rounded bg-slate-800" />
          </div>
          {[1, 2, 3].map((item) => (
            <div key={item} className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 h-4 w-40 rounded bg-slate-800" />
              <div className="h-24 rounded bg-slate-800" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {activeGameweek && (
            <ActiveGameweekHero gameweek={activeGameweek} />
          )}

          <GameweekFilters
            activeTab={activeTab}
            onTabChange={setActiveTab}
            viewMode={viewMode}
            onViewModeChange={saveGameweekViewMode}
          />

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
