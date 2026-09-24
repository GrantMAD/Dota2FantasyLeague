'use client';

import { Users, ChevronRight, Shield, Swords, Trophy } from 'lucide-react';
import type { LeagueRecord, StandingEntry } from '@/app/(dashboard)/leagues/types';

interface LeagueCardProps {
  league: LeagueRecord;
  onClick: () => void;
}

export function LeagueCard({ league, onClick }: LeagueCardProps) {
  const isH2H = league.type === 'h2h';
  const topEntry = league.standings?.sort((a: StandingEntry, b: StandingEntry) => (a.rank ?? 999) - (b.rank ?? 999))[0];
  const fillPct = Math.min(100, (league.currentParticipants / league.maxParticipants) * 100);

  const borderTone = isH2H
    ? 'border-sky-500/30 hover:border-sky-400/60 hover:shadow-sky-500/5'
    : 'border-amber-500/20 hover:border-amber-500/50 hover:shadow-amber-500/5';

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-2xl border p-5 shadow-lg shadow-slate-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl bg-slate-950/60 ${borderTone}`}
    >
      {/* Header Row */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            isH2H ? 'border-sky-500/30 bg-sky-500/10 text-sky-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          }`}>
            {isH2H ? <Swords className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-bold text-white transition-colors group-hover:text-amber-400 leading-tight">
              {league.name}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
              {league.description || 'No description provided'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            isH2H
              ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
          }`}>
            {isH2H ? 'H2H' : 'Classic'}
          </span>
          <span className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-slate-300">
            <Shield className="h-3 w-3" />
            {league.privacyLevel}
          </span>
        </div>
      </div>

      {/* Participant bar */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-slate-400">
            <Users className="h-3.5 w-3.5" />
            {league.currentParticipants} / {league.maxParticipants} managers
          </span>
          <span className="text-slate-500">{Math.round(fillPct)}% full</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all ${isH2H ? 'bg-sky-500/50' : 'bg-amber-500/50'}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      {/* Leader preview */}
      <div className="flex items-center justify-between border-t border-slate-800/60 pt-3">
        {topEntry ? (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400 border border-amber-500/30">
              #1
            </div>
            <span className="truncate text-xs text-slate-300 max-w-[120px]">{topEntry.manager}</span>
            <span className="font-mono text-xs font-bold text-amber-400">{topEntry.points}pts</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500">No standings yet</span>
        )}
        <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 transition-colors group-hover:text-amber-400">
          View <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}
