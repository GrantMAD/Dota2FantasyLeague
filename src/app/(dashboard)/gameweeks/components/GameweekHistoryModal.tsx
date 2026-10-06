'use client';

import { useEffect, useRef, useState } from 'react';
import { Award, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useAccessibleDialog } from '@/components/use-accessible-dialog';

interface HistoryPlayer {
  id: number;
  name: string;
  role: string;
  points: number;
  profileImageUrl: string | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
}

interface GameweekHistory {
  gameweek: { id: number; number: number };
  managerScore: number | null;
  globalAverage: number | null;
  starters: HistoryPlayer[];
  bench: HistoryPlayer[];
}

interface GameweekHistoryModalProps {
  gameweekId: number;
  gameweekNumber: number;
  onClose: () => void;
}

function PlayerList({ players, emptyMessage }: { players: HistoryPlayer[]; emptyMessage: string }) {
  if (players.length === 0) {
    return <p className="py-4 text-sm text-slate-400">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-slate-800">
      {players.map((player) => (
        <li key={`${player.role}-${player.id}`} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-white">{player.name}</span>
              {player.isCaptain && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Captain</span>
              )}
              {player.isViceCaptain && (
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">Vice</span>
              )}
            </div>
            <span className="text-xs text-slate-400">{player.role}</span>
          </div>
          <span className="shrink-0 text-sm font-semibold text-emerald-300">{player.points.toFixed(1)} pts</span>
        </li>
      ))}
    </ul>
  );
}

export function GameweekHistoryModal({ gameweekId, gameweekNumber, onClose }: GameweekHistoryModalProps) {
  const [history, setHistory] = useState<GameweekHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useAccessibleDialog({ open: true, onClose, initialFocusRef: closeButtonRef });

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      try {
        const response = await fetchWithAuth(`/api/gameweeks/${gameweekId}/history`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load gameweek history.');
        if (!cancelled) setHistory(data as GameweekHistory);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load gameweek history.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [gameweekId]);

  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gameweek-history-title"
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
              <Award className="h-4 w-4" />
              Your Gameweek
            </div>
            <h2 id="gameweek-history-title" className="text-2xl font-bold text-white">Gameweek {gameweekNumber} History</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close gameweek history" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">Loading your gameweek history…</div>
        ) : error ? (
          <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
        ) : history ? (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-400">Your score</div>
                <div className="mt-1 text-2xl font-bold text-emerald-300">
                  {history.managerScore === null ? '—' : `${history.managerScore.toFixed(1)} pts`}
                </div>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-400">Global average</div>
                <div className="mt-1 text-2xl font-bold text-white">
                  {history.globalAverage === null ? '—' : `${history.globalAverage.toFixed(1)} pts`}
                </div>
                {history.managerScore !== null && history.globalAverage !== null && (
                  <div className={`mt-1 text-xs ${history.managerScore >= history.globalAverage ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {history.managerScore >= history.globalAverage ? '+' : ''}{(history.managerScore - history.globalAverage).toFixed(1)} pts vs average
                  </div>
                )}
              </div>
            </div>

            {history.starters.length === 0 && history.bench.length === 0 ? (
              <p className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-300">
                No saved lineup was found for this gameweek.
              </p>
            ) : (
              <div className="space-y-6">
                <section>
                  <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-300">Starting 5</h3>
                  <p className="mb-2 text-xs text-slate-500">Player rows show base points; captain and chip multipliers are reflected in your total score.</p>
                  <PlayerList players={history.starters} emptyMessage="No starting players saved." />
                </section>
                <section>
                  <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-300">Bench</h3>
                  <PlayerList players={history.bench} emptyMessage="No bench players saved." />
                </section>
              </div>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
