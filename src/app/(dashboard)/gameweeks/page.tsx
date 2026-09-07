'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ActiveGameweekHero } from './components/ActiveGameweekHero';
import { GameweekCard } from './components/GameweekCard';
import { GameweekFilters } from './components/GameweekFilters';

export type GameweekTab = 'all' | 'planning' | 'past';

export type GameweekRow = {
  id: number;
  season_id: number;
  gameweek_number: number;
  start_date: string;
  end_date: string;
  deadline: string;
  status: 'upcoming' | 'active' | 'closed' | 'locked';
  match_count: number;
  tournaments: Array<{ id: number; name: string; slug?: string | null }>;
  flags: Array<{ flag: string; team_id: number; professional_teams?: { id: number; name: string; slug?: string | null; logo_url?: string | null } | null }>;
  top_scorer: { player_id: number; total_points: number; name: string; in_game_name?: string | null; primary_role?: string | null } | null;
  user_score: number | null;
};

const isWeekPast = (gw: GameweekRow) => gw.status === 'closed' || gw.status === 'locked';

export default function GameweeksPage() {
  const [gameweeks, setGameweeks] = useState<GameweekRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GameweekTab>('all');
  const [viewMode, setViewMode] = useState<'compact' | 'detailed'>('detailed');

  useEffect(() => {
    async function fetchGameweeks() {
      try {
        setLoading(true);
        const res = await fetch('/api/gameweeks');
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

        <div className="flex items-center gap-3">
          <Link
            href="/lineups"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300 transition hover:border-amber-400 hover:bg-amber-500/15"
          >
            Edit Lineup
          </Link>
          <Link
            href="/transfers"
            className="gameweeks-transfer-link inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Transfer Market
          </Link>
          {activeGameweek && (
            <Link
              href={`/matches?gameweekId=${activeGameweek.id}`}
              className="gameweeks-matches-link inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
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
            onViewModeChange={setViewMode}
          />

          <div className={viewMode === 'compact' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-5'}>
            {filteredGameweeks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center text-slate-400">
                No gameweeks match this filter.
              </div>
            ) : (
              filteredGameweeks.map((gw) => (
                <GameweekCard key={gw.id} gameweek={gw} compact={viewMode === 'compact'} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
