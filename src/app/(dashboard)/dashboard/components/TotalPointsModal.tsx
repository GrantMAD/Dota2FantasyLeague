'use client';

import { useEffect, useRef, useState } from 'react';
import { Award, Info, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import {
  POINT_CATEGORIES,
  type GameweekPointsBreakdown,
  type PlayerPointCategories,
  type PointCategory,
} from '@/lib/dashboard-points';
import { useAccessibleDialog } from '@/components/use-accessible-dialog';

interface PointsBreakdown {
  seasonName: string | null;
  totalPoints: number;
  categoryTotals: PlayerPointCategories;
  unitemizedPoints: number;
  currentGameweekId?: number | null;
  gameweeks: GameweekPointsBreakdown[];
}

interface TotalPointsModalProps {
  onClose: () => void;
}

const CATEGORY_ACCENTS: Record<PointCategory, string> = {
  combat: '#fb7185',
  economy: '#fbbf24',
  objective: '#34d399',
  teamfight: '#a78bfa',
  win: '#facc15',
  series: '#22d3ee',
  performance: '#60a5fa',
  consistency: '#2dd4bf',
  penalty: '#f87171',
};

function formatPoints(points: number): string {
  return `${points > 0 ? '+' : ''}${points.toFixed(2)}`;
}

export function TotalPointsModal({ onClose }: TotalPointsModalProps) {
  const [breakdown, setBreakdown] = useState<PointsBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useAccessibleDialog({ open: true, onClose, initialFocusRef: closeButtonRef });
  const expandedGameweekId = breakdown?.gameweeks.find(
    (gameweek) => gameweek.gameweekId === breakdown.currentGameweekId,
  )?.gameweekId ?? breakdown?.gameweeks[0]?.gameweekId;
  const categorySubtotal = breakdown
    ? POINT_CATEGORIES.reduce((sum, [key]) => sum + breakdown.categoryTotals[key], 0)
    : 0;

  useEffect(() => {
    let cancelled = false;
    async function loadBreakdown() {
      try {
        const response = await fetchWithAuth('/api/dashboard/points-breakdown');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load your points breakdown.');
        if (!cancelled) setBreakdown(data as PointsBreakdown);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load your points breakdown.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadBreakdown();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-80 flex items-start justify-center overflow-y-auto bg-slate-950/75 p-4 py-8 backdrop-blur-sm sm:items-center animate-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="total-points-title"
        tabIndex={-1}
        className="animate-modal-content my-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7"
      >
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
              <Award className="h-4 w-4" />
              Season points
            </div>
            <h2 id="total-points-title" className="text-2xl font-bold text-white">
              Where your points came from
            </h2>
            {breakdown?.seasonName && <p className="mt-1 text-sm text-slate-400">{breakdown.seasonName}</p>}
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close total points breakdown"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {loading ? (
          <div role="status" aria-label="Loading points breakdown" className="space-y-4 py-2">
            <div className="h-24 animate-pulse rounded-xl border border-slate-700/60 bg-slate-800/40 p-5">
              <div className="h-3 w-24 rounded bg-slate-700" />
              <div className="mt-3 h-7 w-32 rounded bg-slate-700" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex h-12 animate-pulse items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3">
                  <div className="h-3.5 w-24 rounded bg-slate-800" />
                  <div className="h-4 w-12 rounded bg-slate-800" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : breakdown ? (
          <>
            <div className="mb-6 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5">
              <div className="text-xs uppercase tracking-wider text-slate-400">Season total</div>
              <div className="mt-1 text-3xl font-bold text-emerald-300">{breakdown.totalPoints.toFixed(2)} pts</div>
              <p className="mt-2 text-xs text-slate-400">
                The saved total is built from your gameweek lineup scores, including captain multipliers and applicable chips.
              </p>
            </div>

            <section className="mb-7">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 sm:p-5">
                <header className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Scoring categories</h3>
                    <p className="mt-1 text-xs text-slate-500">Category subtotal</p>
                  </div>
                  <span className="shrink-0 font-mono text-lg font-bold text-white">
                    {formatPoints(categorySubtotal)} pts
                  </span>
                </header>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {POINT_CATEGORIES.map(([key, label]) => (
                    <div key={key} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_ACCENTS[key] }} />
                        <span className="text-xs font-medium text-slate-400">{label}</span>
                      </div>
                      <div className="mt-2 font-mono text-lg font-semibold leading-none text-slate-100">
                        {formatPoints(breakdown.categoryTotals[key])}
                        <span className="ml-1.5 font-sans text-xs font-medium text-slate-500">pts</span>
                      </div>
                    </div>
                  ))}
                </div>
                {Math.abs(breakdown.unitemizedPoints) >= 0.01 && (
                  <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-dashed border-slate-700/80 pt-4">
                    <div className="flex min-w-0 items-start gap-2">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-300">Unitemized adjustment</p>
                        <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                          Keeps the category subtotal aligned with your saved season total when historical scoring details are incomplete.
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold text-slate-200">
                      {formatPoints(breakdown.unitemizedPoints)} pts
                    </span>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">Gameweek contributions</h3>
              {breakdown.gameweeks.length === 0 ? (
                <p className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-300">
                  No saved gameweek lineups are available yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {breakdown.gameweeks.map((gameweek) => (
                    <details
                      key={gameweek.gameweekId}
                      open={gameweek.gameweekId === expandedGameweekId}
                      className="group rounded-xl border border-slate-800 bg-slate-950/35"
                    >
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
                        <span className="font-semibold text-white">Gameweek {gameweek.gameweekNumber}</span>
                        <span className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                          {gameweek.points.toFixed(2)} pts
                          {gameweek.benchBoost && (
                            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-200">Bench Boost</span>
                          )}
                        </span>
                      </summary>
                      <div className="border-t border-slate-800 px-4 pb-3">
                        {gameweek.contributors.length === 0 ? (
                          <p className="py-3 text-sm text-slate-400">No player scoring details are available for this gameweek.</p>
                        ) : (
                          <ul className="divide-y divide-slate-800">
                            {gameweek.contributors.map((player) => (
                              <li key={`${gameweek.gameweekId}-${player.playerId}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-white">{player.name}</span>
                                    {player.isCaptain && (
                                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                                        Captain {player.multiplier}x
                                      </span>
                                    )}
                                    {!player.isCaptain && player.isViceCaptain && player.multiplier > 1 && (
                                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-200">
                                        Vice-captain {player.multiplier}x
                                      </span>
                                    )}
                                    {player.isAutoSub && (
                                      <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-200">Auto-sub</span>
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-400">{player.role} · {player.basePoints.toFixed(2)} base pts</span>
                                </div>
                                <span className="shrink-0 text-sm font-semibold text-emerald-300">
                                  {player.points.toFixed(2)} pts
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </section>
    </div>
  );
}
