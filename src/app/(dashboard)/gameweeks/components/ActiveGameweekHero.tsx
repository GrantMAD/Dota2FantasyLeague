'use client';

import { AlarmClockCheck, Flame, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import type { GameweekRow } from '../page';
import { formatGameweekDate, getDeadlineCountdown } from '../gameweeks-utils';

interface ActiveGameweekHeroProps {
  gameweek: GameweekRow;
}

export function ActiveGameweekHero({ gameweek }: ActiveGameweekHeroProps) {
  const [lineupStatus, setLineupStatus] = useState<'loading' | 'ready' | 'incomplete' | 'error'>('loading');
  const [countdown, setCountdown] = useState(() => ({
    totalMs: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isUrgent: false,
  }));

  useEffect(() => {
    const updateCountdown = () => {
      setCountdown(getDeadlineCountdown(gameweek.deadline));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [gameweek.deadline]);

  useEffect(() => {
    let cancelled = false;
    async function loadLineupStatus() {
      setLineupStatus('loading');
      try {
        const response = await fetchWithAuth(`/api/fantasy/lineup?gameweekId=${gameweek.id}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to check lineup readiness.');
        const starters = Array.isArray(body.lineup)
          ? body.lineup.filter((entry: { is_starter?: boolean }) => entry.is_starter === true).length
          : 0;
        if (!cancelled) setLineupStatus(starters >= 5 ? 'ready' : 'incomplete');
      } catch {
        if (!cancelled) setLineupStatus('error');
      }
    }
    void loadLineupStatus();
    return () => {
      cancelled = true;
    };
  }, [gameweek.id]);

  const doubleTeams = gameweek.flags.filter((flag) => flag.flag === 'double');
  const blankTeams = gameweek.flags.filter((flag) => flag.flag === 'blank');

  return (
    <div className={`relative mb-8 overflow-hidden rounded-2xl border bg-[var(--surface)] p-5 shadow-xl sm:p-6 ${
      gameweek.status === 'active'
        ? 'border-amber-500/50 shadow-amber-500/10'
        : 'border-[var(--border)]'
    }`}>
      {gameweek.status === 'active' && (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(245,158,11,0.12),transparent_58%)]" />
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500" />
        </>
      )}
      <div className="relative grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
            <AlarmClockCheck className="h-3.5 w-3.5" />
            {gameweek.status === 'active' ? 'Active gameweek' : 'Next gameweek'}
          </div>
          <h2 className="gameweeks-hero-heading text-2xl font-black tracking-tight text-[var(--text-primary)] sm:text-3xl">Gameweek {gameweek.gameweek_number}</h2>
          <p className="gameweeks-hero-dates mt-1 text-sm text-[var(--text-secondary)]">
            {formatGameweekDate(gameweek.start_date)} – {formatGameweekDate(gameweek.end_date)}
          </p>
          <div className={`mt-4 inline-flex flex-col items-start gap-1 rounded-xl border px-3 py-2 ${
            countdown.isUrgent ? 'border-rose-500/40 bg-rose-500/10' : 'border-amber-500/30 bg-amber-500/5'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Deadline</span>
              <span className={`font-mono text-lg font-black tabular-nums ${
                countdown.isUrgent ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'
              }`}>
                {countdown.days}d {String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Lineup, transfer, and chip changes lock for this gameweek.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/gameweeks/${gameweek.id}`}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 transition hover:border-rose-500/40"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Match progress</p>
            <p className="mt-2 text-2xl font-black text-[var(--text-primary)]">
              {gameweek.live_match_count ?? 0}<span className="ml-1 text-sm font-semibold text-[var(--text-secondary)]">live</span>
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{gameweek.match_count} matches this gameweek</p>
            <p className="mt-2 text-xs font-medium text-[var(--text-primary)]">View fixtures and results →</p>
          </Link>
          <Link
            href="/lineups"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 transition hover:border-emerald-500/40"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Starting lineup</p>
            <p className={`mt-2 text-lg font-black ${
              lineupStatus === 'ready'
                ? 'text-emerald-700 dark:text-emerald-300'
                : lineupStatus === 'error'
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-amber-700 dark:text-amber-300'
            }`}>
              {lineupStatus === 'loading' ? 'Checking…' : lineupStatus === 'ready' ? 'Ready · 5 starters' : lineupStatus === 'error' ? 'Status unavailable' : 'Needs attention'}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{lineupStatus === 'ready' ? 'Review or edit lineup →' : 'Set your five starters →'}</p>
          </Link>
        </div>
      </div>

      {(doubleTeams.length > 0 || blankTeams.length > 0 || gameweek.tournaments.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
          {(doubleTeams.length > 0 || blankTeams.length > 0) && (
            <>
              {doubleTeams.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                  <Zap className="h-3.5 w-3.5" />
                  Double GW
                </span>
              )}
              {blankTeams.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-800 dark:text-orange-300">
                  <Flame className="h-3.5 w-3.5" />
                  Blank GW
                </span>
              )}
            </>
          )}

          {gameweek.tournaments.map((tournament, idx) => (
            <span key={`${gameweek.id}-hero-t-${tournament.id}-${idx}`} className="gameweeks-tournament-chip rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
              {tournament.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
