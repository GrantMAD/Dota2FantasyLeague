'use client';

import Link from 'next/link';
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
  const isEligible = tournament.status === 'eligible';

  const startDate = new Date(tournament.start_date);
  const endDate = new Date(tournament.end_date);
  const now = new Date();
  const isLive = now >= startDate && now <= endDate;

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className={`group relative flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden ${
        isTier1
          ? 'bg-slate-900/80 border-amber-500/30 hover:border-amber-500/70 hover:shadow-xl hover:shadow-amber-500/10'
          : 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700 hover:bg-slate-800/50'
      } hover:-translate-y-1`}
    >
      {/* Subtle top glow */}
      {isTier1 && (
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      )}

      {/* Header Badges */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-800/70">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
              isTier1
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : isTier2
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {tournament.tier || 'Tier 1'}
          </span>

          {tournament.eligible && (
            <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase">
              Fantasy Eligible
            </span>
          )}
        </div>

        <div>
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Active
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-mono capitalize">
              {tournament.status}
            </span>
          )}
        </div>
      </div>

      {/* Main Info */}
      <div className="p-6 flex-1 flex flex-col">
        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
          {tournament.name}
        </h3>

        {/* Date Range */}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mb-5">
          <svg className="w-4 h-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>
            {startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} &mdash;{' '}
            {endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        {/* Participating Teams Preview */}
        {tournament.participating_teams && tournament.participating_teams.length > 0 && (
          <div className="mt-auto pt-4 border-t border-slate-800/60">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              Competing Teams ({tournament.participating_teams.length})
            </div>
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
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400">
                  +{tournament.participating_teams.length - 5}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-6 py-3 bg-slate-950/40 border-t border-slate-800/60 flex items-center justify-between text-xs">
        <span className="text-slate-400 text-[11px] font-mono">
          {tournament.series_count !== undefined ? `${tournament.series_count} Series` : 'Schedule Available'}
        </span>
        <span className="text-amber-400 group-hover:text-amber-300 font-medium flex items-center gap-1 transition-colors">
          View Event Hub
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
