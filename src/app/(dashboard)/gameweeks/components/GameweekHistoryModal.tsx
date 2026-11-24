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
    return <p className="py-4 text-sm text-[var(--text-secondary)]">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
      <ul>
        {players.map((player, index) => (
          <li
            key={`${player.role}-${player.id}`}
            className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0"
            style={{
              background: index % 2 === 0 ? 'var(--surface)' : 'var(--surface-raised)',
            }}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-medium text-[var(--text-primary)]">{player.name}</span>
                {player.isCaptain && (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Captain</span>
                )}
                {player.isViceCaptain && (
                  <span className="rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">Vice</span>
                )}
              </div>
              <span className="text-xs text-[var(--text-secondary)]">{player.role}</span>
            </div>
            <span className="shrink-0 text-sm font-semibold text-emerald-300">{player.points.toFixed(1)} pts</span>
          </li>
        ))}
      </ul>
    </div>
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
      className="fixed inset-0 z-80 flex items-center justify-center bg-[var(--surface)]/75 p-4 backdrop-blur-sm"
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
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl sm:p-7"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
              <Award className="h-4 w-4" />
              Your Gameweek
            </div>
            <h2 id="gameweek-history-title" className="text-2xl font-bold text-[var(--text-primary)]">Gameweek {gameweekNumber} History</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close gameweek history" className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]">
            <X className="h-5 w-5" />
          </button>
        </header>

        {loading ? (
          <div role="status" aria-label="Loading gameweek history" className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-20 animate-pulse rounded-xl border border-[var(--border)]/60 bg-[var(--surface-raised)]/40 p-4">
                <div className="h-3 w-20 rounded bg-[var(--surface-muted)]" />
                <div className="mt-2 h-6 w-24 rounded bg-[var(--surface-muted)]" />
              </div>
              <div className="h-20 animate-pulse rounded-xl border border-[var(--border)]/60 bg-[var(--surface-raised)]/40 p-4">
                <div className="h-3 w-24 rounded bg-[var(--surface-muted)]" />
                <div className="mt-2 h-6 w-24 rounded bg-[var(--surface-muted)]" />
              </div>
            </div>
            <div className="h-28 animate-pulse rounded-xl border border-[var(--border)]/60 bg-[var(--surface-raised)]/40 p-4">
              <div className="h-3 w-32 rounded bg-[var(--surface-muted)]" />
              <div className="mt-3 flex gap-2">
                <div className="h-10 w-10 rounded-lg bg-[var(--surface-muted)]" />
                <div className="h-10 w-10 rounded-lg bg-[var(--surface-muted)]" />
                <div className="h-10 w-10 rounded-lg bg-[var(--surface-muted)]" />
              </div>
            </div>
          </div>
        ) : error ? (
          <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
        ) : history ? (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Your score</div>
                <div className="mt-1 text-2xl font-bold text-emerald-300">
                  {history.managerScore === null ? '—' : `${history.managerScore.toFixed(1)} pts`}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
                <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Global average</div>
                <div className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
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
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-sm text-[var(--text-secondary)]">
                No saved lineup was found for this gameweek.
              </p>
            ) : (
              <div className="space-y-6">
                <section>
                  <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Starting 5</h3>
                  <p className="mb-2 text-xs text-[var(--text-muted)]">Player rows show base points; captain and chip multipliers are reflected in your total score.</p>
                  <PlayerList players={history.starters} emptyMessage="No starting players saved." />
                </section>
                <section>
                  <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Bench</h3>
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
