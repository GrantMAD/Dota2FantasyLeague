'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useAccessibleDialog } from '@/components/use-accessible-dialog';
import type { ScoreBreakdown } from '@/types/fantasy';
import type { SquadPlayer } from './SquadPlayerCard';
import { canOptimizeImage } from '@/lib/optimized-image';

type PlayerPerformance = {
  id: number;
  gameweek_id: number;
  kills: number;
  deaths: number;
  assists: number;
  fantasy_points_breakdown?: { total_points?: number } | null;
};

export type PlayerDetails = SquadPlayer & {
  total_season_points?: number;
  last_gw_points?: number;
  performances?: PlayerPerformance[];
};

interface PlayerDetailModalProps {
  player: PlayerDetails | null;
  loading: boolean;
  onClose: () => void;
  scoreBreakdown?: ScoreBreakdown | null;
}

const SCORE_CATEGORIES = [
  ['Combat', 'combat'],
  ['Economy', 'economy'],
  ['Objective', 'objective'],
  ['Teamfight', 'teamfight'],
  ['Win', 'win'],
  ['Series', 'series'],
  ['Performance', 'performance'],
  ['Consistency', 'consistency'],
  ['Penalty', 'penalty'],
] as const;

export function PlayerDetailModal({ player, loading, onClose, scoreBreakdown }: PlayerDetailModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    open: Boolean(player) && !loading,
    onClose,
    initialFocusRef: closeButtonRef,
  });

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
        role="status"
      >
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-secondary)] shadow-xl">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            <span>Loading player details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!player) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="squad-player-title"
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text-primary)] shadow-2xl"
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-teal-500/40 bg-[var(--surface-raised)] shadow-md">
              {player.profile_image_url ? (
                <Image
                  src={player.profile_image_url}
                  alt={player.in_game_name || player.name}
                  width={64}
                  height={64}
                  unoptimized={!canOptimizeImage(player.profile_image_url)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-base font-bold text-[var(--text-muted)]">
                  {(player.in_game_name || player.name || 'P').substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
                {player.primary_role || 'Pro Player'}
              </div>
              <h2 id="squad-player-title" className="mt-1 text-2xl font-bold text-white">
                {player.in_game_name || player.name}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {player.professional_teams?.name || 'Free Agent'} • {player.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close player details"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-2 text-[var(--text-muted)] transition hover:border-teal-500/50 hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Current Price</span>
            <p className="mt-1 font-mono text-lg font-black text-amber-700 dark:text-amber-400">
              ${Number(player.current_price || 0).toFixed(1)}M
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Season Points</span>
            <p className="mt-1 text-lg font-black text-[var(--text-primary)]">
              {player.total_season_points ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Last GW Points</span>
            <p className="mt-1 text-lg font-black text-[var(--accent-primary)]">
              {player.last_gw_points ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Availability</span>
            <p className={`mt-1 text-sm font-semibold capitalize ${player.availability_status && player.availability_status !== 'available' ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {player.availability_status || 'Available'}
            </p>
          </div>
        </div>

        {scoreBreakdown !== undefined && (
          <section aria-labelledby="player-score-breakdown-title" className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="player-score-breakdown-title" className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                Gameweek Score Breakdown
              </h3>
              {scoreBreakdown && (
                <span className="font-mono text-sm font-black text-[var(--accent-primary)]">
                  {scoreBreakdown.total.toFixed(2)} pts
                </span>
              )}
            </div>
            {scoreBreakdown ? (
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SCORE_CATEGORIES.map(([label, key]) => {
                  const value = scoreBreakdown[key];
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2">
                      <dt className="text-xs text-[var(--text-secondary)]">{label}</dt>
                      <dd className={`font-mono text-xs font-semibold ${value < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-[var(--text-primary)]'}`}>
                        {value >= 0 ? '+' : ''}{value.toFixed(2)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-raised)] p-4 text-center text-xs text-[var(--text-secondary)]">
                No fantasy points have been recorded for this player this gameweek.
              </p>
            )}
          </section>
        )}

        {/* Unavailable Explanation Callout */}
        {player.availability_status && player.availability_status !== 'available' && (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-800 dark:text-rose-200">
            <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
              <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
              <span>Player Status: {player.availability_status.toUpperCase()}</span>
            </div>
            <p className="mt-1 leading-relaxed text-rose-800/90 dark:text-rose-200/90">
              {player.availability_reason
                ? player.availability_reason
                : 'This player is currently not listed on an active pro team roster or has no scheduled tournament matches. They are at risk of scoring 0 points if kept as an active starter.'}
            </p>
            <p className="mt-2 text-[11px] text-rose-700/80 dark:text-rose-300/80">
              Tip: Swap this player for an active starter or move them to your bench before the gameweek deadline.
            </p>
          </div>
        )}

        {/* Recent Performances */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Recent Performances
            </h3>
            <span className="text-xs text-[var(--text-muted)]">Last 5 Gameweeks</span>
          </div>

          {player.performances?.length ? (
            <div className="space-y-2">
              {player.performances.slice(0, 5).map((perf) => (
                <div
                  key={perf.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 text-sm transition hover:bg-[var(--surface-muted)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-bold text-[var(--text-secondary)]">
                      GW {perf.gameweek_id}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {perf.kills} K / {perf.deaths} D / {perf.assists} A
                    </span>
                  </div>
                  <span className="font-semibold text-[var(--accent-primary)]">
                    {perf.fantasy_points_breakdown?.total_points ?? 0} pts
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-raised)] p-6 text-center text-xs text-[var(--text-secondary)]">
              No recent match performance data recorded for this season yet.
            </div>
          )}
        </div>

        {/* View Full Profile Link */}
        <div className="mt-6 flex justify-end">
          <Link
            href={`/players/${player.id}`}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-500/20 dark:text-teal-300"
          >
            <span>View Full Player Profile</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
