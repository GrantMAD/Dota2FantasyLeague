'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Award, LoaderCircle, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import type { FriendProfile, FriendProgress } from '@/types/friends';

function displayName(user: Pick<FriendProfile, 'username' | 'display_name'>) {
  return user.display_name?.trim() || user.username;
}

function formatPoints(value: number | string) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function FriendAvatar({
  user,
  size = 44,
}: {
  user: Pick<FriendProfile, 'username' | 'display_name' | 'avatar_url'>;
  size?: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-sm font-bold text-[var(--text-primary)]"
      style={{ width: size, height: size }}
    >
      {user.avatar_url ? (
        <Image
          src={user.avatar_url}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        displayName(user).slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

export function FriendProgressModal({
  user,
  onClose,
}: {
  user: FriendProfile;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState<FriendProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadProgress() {
      try {
        const response = await fetchWithAuth(`/api/friends/${encodeURIComponent(user.id)}/progress`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as FriendProgress & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Unable to load manager progress.');
        if (!controller.signal.aborted) setProgress(data);
      } catch (loadError: unknown) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load manager progress.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProgress();
    return () => controller.abort();
  }, [user.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    closeButtonRef.current?.focus();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-progress-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 shadow-2xl sm:p-7"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <FriendAvatar user={user} />
            <div>
              <h2 id="friend-progress-title" className="text-xl font-bold text-[var(--text-primary)]">
                {displayName(user)}
              </h2>
              <p className="text-sm text-[var(--text-muted)]">@{user.username}</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close manager progress"
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {loading ? (
          <div role="status" className="flex min-h-32 items-center justify-center text-sm text-[var(--text-muted)]">
            <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> Loading progress…
          </div>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </p>
        ) : progress?.season ? (
          <>
            <p className="mb-4 text-sm font-medium text-[var(--text-muted)]">{progress.season.name}</p>
            <div className="mb-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--surface)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Season points</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                  {formatPoints(progress.season.total_points)}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--surface)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Global rank</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                  {progress.season.global_rank ? `#${progress.season.global_rank.toLocaleString()}` : 'Unranked'}
                </p>
              </div>
            </div>
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <Award className="h-4 w-4 text-[var(--accent-primary)]" /> Gameweek history
            </h3>
            {progress.season.gameweeks.length ? (
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="bg-[var(--surface)] text-xs uppercase text-[var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Gameweek</th>
                      <th className="px-4 py-3">Points</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {progress.season.gameweeks.map((gameweek) => (
                      <tr key={gameweek.id} className="text-[var(--text-primary)]">
                        <td className="px-4 py-3">GW {gameweek.gameweek_number}</td>
                        <td className="px-4 py-3">{formatPoints(gameweek.gameweek_points)}</td>
                        <td className="px-4 py-3">{formatPoints(gameweek.total_points)}</td>
                        <td className="px-4 py-3">#{gameweek.rank.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
                No closed gameweek scores have been recorded yet.
              </p>
            )}
          </>
        ) : (
          <p className="rounded-xl bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
            There is no active or completed season to show yet.
          </p>
        )}
      </section>
    </div>
  );
}
