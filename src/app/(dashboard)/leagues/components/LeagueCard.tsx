'use client';

import { Users, ChevronRight, Shield, Swords, Trophy } from 'lucide-react';
import Image from 'next/image';
import { canOptimizeImage } from '@/lib/optimized-image';
import type { LeagueRecord, StandingEntry } from '@/app/(dashboard)/leagues/types';

interface LeagueCardProps {
  league: LeagueRecord;
  onClick: () => void;
}

export function LeagueCard({ league, onClick }: LeagueCardProps) {
  const isH2H = league.type === 'h2h';
  const topEntries = [...(league.standings ?? [])]
    .sort((a: StandingEntry, b: StandingEntry) => (a.rank ?? 999) - (b.rank ?? 999))
    .slice(0, 3);
  const fillPct = Math.min(100, (league.currentParticipants / league.maxParticipants) * 100);
  const accent = isH2H ? '#a78bfa' : '#f59e0b';

  return (
    <div
      data-tour="leagues-card"
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
      style={{
        borderColor: `color-mix(in srgb, ${accent} 35%, var(--border))`,
        boxShadow: `0 12px 32px color-mix(in srgb, ${accent} 8%, transparent)`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 opacity-80 transition-opacity group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 15%, transparent))` }}
      />
      {/* Header Row */}
      <div className="mb-4 flex items-start justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            isH2H ? 'border-sky-500/30 bg-sky-500/10 text-sky-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          }`}>
            {isH2H ? <Swords className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-bold leading-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
              {league.name}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">
              {league.description || 'No description provided'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            isH2H
              ? 'border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-300'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
          }`}>
            {isH2H ? 'H2H' : 'Classic'}
          </span>
          <span className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--text-secondary)]">
            <Shield className="h-3 w-3" />
            {league.privacyLevel}
          </span>
        </div>
      </div>

      {/* Participant bar */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-[var(--text-secondary)]">
            <Users className="h-3.5 w-3.5" />
            {league.currentParticipants} / {league.maxParticipants} managers
          </span>
          <span className="text-[var(--text-muted)]">{Math.round(fillPct)}% full</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${fillPct}%`, backgroundColor: accent }}
          />
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Top managers</span>
          <span className="text-[10px] text-[var(--text-muted)]">Total points</span>
        </div>
        {topEntries.length > 0 ? (
          <ol className="space-y-1.5">
            {topEntries.map((entry, index) => (
              <li key={`${entry.manager}-${entry.rank ?? index}`} className="flex items-center gap-2">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${
                  index === 0
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : index === 1
                      ? 'border-slate-400/40 bg-slate-400/15 text-slate-700 dark:text-slate-300'
                      : 'border-orange-700/40 bg-orange-700/15 text-orange-800 dark:text-orange-300'
                }`}>
                  {entry.rank ?? index + 1}
                </span>
                <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-raised)]">
                  {entry.avatarUrl ? (
                    <Image src={entry.avatarUrl} alt="" width={24} height={24} unoptimized={!canOptimizeImage(entry.avatarUrl)} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[9px] font-bold text-[var(--text-secondary)]">{entry.manager.substring(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--text-primary)]">{entry.manager}</span>
                <span className="shrink-0 font-mono text-xs font-bold text-[var(--text-secondary)]">{entry.points} pts</span>
              </li>
            ))}
          </ol>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">No standings yet</span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end border-t border-[var(--border)] pt-3">
        <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 transition-colors group-hover:text-amber-400">
          View <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}
