'use client';

import Link from 'next/link';
import { CalendarDays, Check, ChevronRight, Gamepad2, Trophy, Users } from 'lucide-react';
import { TeamLogo } from '../../matches/components/TeamLogo';

export interface TournamentData {
  id: number;
  name: string;
  slug: string;
  status: 'eligible' | 'excluded' | 'provisional' | 'archived' | string;
  tier: string | null;
  start_date: string;
  end_date: string;
  eligible?: boolean;
  series_count?: number;
  match_count?: number;
  completed_match_count?: number;
  live_match_count?: number;
  best_of_formats?: number[];
  upcoming_series?: {
    series_number: number;
    scheduled_time: string;
    team_a: string | null;
    team_b: string | null;
  } | null;
  participating_teams?: Array<{
    id: number;
    name: string;
    logo_url: string | null;
  }>;
}

interface TournamentCardProps {
  tournament: TournamentData;
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const isTier1 = tournament.tier?.toLowerCase().includes('tier 1') || tournament.tier?.toLowerCase().includes('major');
  const isTier2 = tournament.tier?.toLowerCase().includes('tier 2') || tournament.tier?.toLowerCase().includes('minor');
  const startDate = new Date(tournament.start_date);
  const endDate = new Date(tournament.end_date);
  const now = new Date();
  const isLive = now >= startDate && now <= endDate;
  const totalMatches = tournament.match_count ?? 0;
  const completedMatches = tournament.completed_match_count ?? 0;
  const matchProgress = totalMatches > 0 ? Math.min(100, (completedMatches / totalMatches) * 100) : 0;
  const tierBadge = isTier1
    ? 'border-amber-400/60 bg-gradient-to-r from-amber-400/25 to-yellow-500/10 text-amber-800 shadow-[0_0_16px_rgba(245,158,11,0.12)] dark:text-amber-200'
    : isTier2
      ? 'border-cyan-400/60 bg-gradient-to-r from-slate-300/20 to-cyan-500/15 text-cyan-800 shadow-[0_0_16px_rgba(34,211,238,0.1)] dark:text-cyan-200'
      : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)]';

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--surface)] transition-all duration-300 hover:-translate-y-1 ${
        isTier1
          ? 'border-amber-500/30 hover:border-amber-500/70 hover:shadow-xl hover:shadow-amber-500/10'
          : 'border-[var(--border)] hover:border-cyan-500/40 hover:shadow-lg'
      }`}
    >
      {isTier1 && (
        <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-amber-500/10 blur-3xl" />
      )}

      <div className="relative flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 pb-4 pt-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${tierBadge}`}
          >
            <Trophy className="h-3 w-3" />
            {tournament.tier || 'Unranked'}
          </span>

          {tournament.eligible && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300">
              <Check className="h-3 w-3" /> Fantasy points
            </span>
          )}
        </div>

        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
          isLive || (tournament.live_match_count ?? 0) > 0
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            : tournament.status === 'archived'
              ? 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)]'
              : 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300'
        }`}>
          {(isLive || (tournament.live_match_count ?? 0) > 0) && <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
          {isLive || (tournament.live_match_count ?? 0) > 0 ? `Live${(tournament.live_match_count ?? 0) > 0 ? ` · ${tournament.live_match_count}` : ''}` : tournament.status}
        </span>
      </div>

      <div className="relative flex flex-1 flex-col p-5">
        <h3 className="mb-3 text-lg font-bold text-[var(--text-primary)] transition-colors group-hover:text-amber-600 dark:group-hover:text-amber-300">
          {tournament.name}
        </h3>

        <div className="mb-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <CalendarDays className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          <span className="tabular-nums">
            {startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} &mdash;{' '}
            {endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]"><Users className="h-3 w-3" /> Teams</div>
            <div className="mt-1 text-sm font-bold text-[var(--text-primary)]">{tournament.participating_teams?.length ?? 0}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]"><Trophy className="h-3 w-3" /> Series</div>
            <div className="mt-1 text-sm font-bold text-[var(--text-primary)]">{tournament.series_count ?? 0}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--text-muted)]"><Gamepad2 className="h-3 w-3" /> Matches</div>
            <div className="mt-1 text-sm font-bold text-[var(--text-primary)]">{totalMatches}</div>
          </div>
        </div>

        {totalMatches > 0 && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-secondary)]">Schedule progress</span>
              <span className="font-semibold tabular-nums text-[var(--text-primary)]">{completedMatches} / {totalMatches} complete</span>
            </div>
            <div
              role="progressbar"
              aria-label={`${completedMatches} of ${totalMatches} tournament matches complete`}
              aria-valuemin={0}
              aria-valuemax={totalMatches}
              aria-valuenow={completedMatches}
              className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
            >
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400" style={{ width: `${matchProgress}%` }} />
            </div>
          </div>
        )}

        {tournament.upcoming_series && (
          <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">Next scheduled series</div>
            <div className="mt-1 truncate text-xs font-semibold text-[var(--text-primary)]">
              {tournament.upcoming_series.team_a ?? 'TBD'} vs {tournament.upcoming_series.team_b ?? 'TBD'}
            </div>
            <div className="mt-1 text-[10px] text-[var(--text-secondary)]">
              {new Date(tournament.upcoming_series.scheduled_time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </div>
          </div>
        )}

        {tournament.participating_teams && tournament.participating_teams.length > 0 && (
          <div className="mt-auto border-t border-[var(--border)] pt-4">
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Competing teams</div>
            <div className="flex items-center gap-2 overflow-hidden">
              {tournament.participating_teams.slice(0, 5).map((team) => (
                <TeamLogo
                  key={team.id}
                  name={team.name}
                  logoUrl={team.logo_url}
                  size="sm"
                />
              ))}
              {tournament.participating_teams.length > 5 && (
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] text-[10px] font-bold text-[var(--text-secondary)]">
                  +{tournament.participating_teams.length - 5}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3 text-xs">
        <span className="text-[var(--text-muted)]">
          {tournament.best_of_formats?.length
            ? tournament.best_of_formats.map((format) => `Bo${format}`).join(' · ')
            : 'Tournament schedule'}
        </span>
        <span className="flex items-center gap-1 font-semibold text-amber-700 transition-colors group-hover:text-amber-600 dark:text-amber-300">
          Event hub <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
