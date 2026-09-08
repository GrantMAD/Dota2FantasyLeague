'use client';

import Link from 'next/link';
import { TournamentData } from './TournamentCard';

interface TournamentHeroProps {
  tournament: TournamentData;
}

export function TournamentHero({ tournament }: TournamentHeroProps) {
  const startDate = new Date(tournament.start_date);
  const endDate = new Date(tournament.end_date);

  return (
    <div className="relative mb-12 rounded-3xl border border-amber-500/40 bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/30 p-8 sm:p-10 shadow-2xl overflow-hidden">
      {/* Decorative ambient background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Featured Tournament
            </span>

            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {tournament.tier || 'Tier 1 Event'}
            </span>

            {tournament.eligible && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ⭐ Official Fantasy Scoring
              </span>
            )}
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-3">
            {tournament.name}
          </h2>

          <p className="text-slate-400 text-sm mb-4 leading-relaxed">
            The world&apos;s best professional teams collide. Matches contribute directly to your active fantasy gameweek scores.
          </p>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1.5">
              <span>📅</span>
              <span>
                {startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} &mdash;{' '}
                {endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </span>
            {tournament.participating_teams && tournament.participating_teams.length > 0 && (
              <span className="text-amber-400 font-bold">
                · {tournament.participating_teams.length} Competing Teams
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-col gap-3">
          <Link
            href={`/tournaments/${tournament.id}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 group"
          >
            <span>Enter Tournament Hub</span>
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>

          <Link
            href="/matches"
            className="tournament-live-matches-link inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
          >
            <span>View All Live Matches</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
