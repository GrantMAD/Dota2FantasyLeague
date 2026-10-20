'use client';

import Link from 'next/link';
import { CalendarDays, ChevronRight, Gamepad2, Trophy, Users } from 'lucide-react';
import { TournamentData } from './TournamentCard';

interface TournamentHeroProps {
  tournament: TournamentData;
}

function formatDateRange(start: Date, end: Date) {
  const startLabel = start.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

export function TournamentHero({ tournament }: TournamentHeroProps) {
  const startDate = new Date(tournament.start_date);
  const endDate = new Date(tournament.end_date);
  const tier = tournament.tier?.toLowerCase() ?? '';
  const tierStyle = tier.includes('tier 1') || tier.includes('major')
    ? 'border-amber-400/60 bg-gradient-to-r from-amber-400/25 to-yellow-500/10 text-amber-800 dark:text-amber-200'
    : tier.includes('tier 2') || tier.includes('minor')
      ? 'border-cyan-400/60 bg-gradient-to-r from-slate-300/20 to-cyan-500/15 text-cyan-800 dark:text-cyan-200'
      : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)]';
  const matchCount = tournament.match_count ?? 0;

  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl border border-amber-500/40 bg-[var(--surface)] p-5 shadow-xl shadow-amber-500/10 sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.14),transparent_55%)]" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500" />
      <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
              <Trophy className="h-3.5 w-3.5" /> Featured tournament
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${tierStyle}`}>
              {tournament.tier || 'Unranked'}
            </span>
            {tournament.eligible && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Fantasy points eligible
              </span>
            )}
          </div>

          <h2 className="max-w-3xl text-2xl font-black tracking-tight text-[var(--text-primary)] sm:text-3xl">
            {tournament.name}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-amber-600 dark:text-amber-300" />{formatDateRange(startDate, endDate)}</span>
            {tournament.participating_teams?.length ? (
              <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-[var(--text-muted)]" />{tournament.participating_teams.length} competing teams</span>
            ) : null}
            {tournament.best_of_formats?.length ? (
              <span className="inline-flex items-center gap-1.5"><Gamepad2 className="h-4 w-4 text-[var(--text-muted)]" />{tournament.best_of_formats.map((format) => `Bo${format}`).join(' · ')} format</span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 lg:min-w-64">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 text-center">
            <Users className="mx-auto h-4 w-4 text-cyan-700 dark:text-cyan-300" />
            <div className="mt-1 text-lg font-black text-[var(--text-primary)]">{tournament.participating_teams?.length ?? 0}</div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Teams</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 text-center">
            <Trophy className="mx-auto h-4 w-4 text-amber-600 dark:text-amber-300" />
            <div className="mt-1 text-lg font-black text-[var(--text-primary)]">{tournament.series_count ?? 0}</div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Series</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 text-center">
            <Gamepad2 className="mx-auto h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            <div className="mt-1 text-lg font-black text-[var(--text-primary)]">{matchCount}</div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Matches</div>
          </div>
        </div>
      </div>

      {tournament.upcoming_series && (
        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2.5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">Next scheduled series</div>
            <div className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
              {tournament.upcoming_series.team_a ?? 'TBD'} vs {tournament.upcoming_series.team_b ?? 'TBD'}
            </div>
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            {new Date(tournament.upcoming_series.scheduled_time).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>
      )}

      <div className="relative mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
        <Link
          href={`/tournaments/${tournament.id}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-amber-400"
        >
          Enter Tournament Hub <ChevronRight className="h-4 w-4" />
        </Link>
        <Link
          href="/matches"
          className="tournament-live-matches-link inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
        >
          Live Pro Match Center
        </Link>
      </div>
    </section>
  );
}
