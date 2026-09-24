'use client';

import { Trophy, Users, Star, Copy, Check, Swords } from 'lucide-react';
import { useState } from 'react';
import type { LeagueRecord, StandingEntry } from '@/app/(dashboard)/leagues/types';

interface LeagueHeroProps {
  league: LeagueRecord;
  onOpen: () => void;
}

export function LeagueHero({ league, onOpen }: LeagueHeroProps) {
  const [copied, setCopied] = useState(false);

  const topEntry = league.standings?.sort((a: StandingEntry, b: StandingEntry) => (a.rank ?? 999) - (b.rank ?? 999))[0];
  const isH2H = league.type === 'h2h';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (league.inviteCode) {
      void navigator.clipboard.writeText(league.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="mb-8 overflow-hidden rounded-3xl border border-amber-500/30 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-2xl shadow-amber-500/10">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
            <Trophy className="h-3.5 w-3.5" />
            {isH2H ? 'Head-to-Head League' : 'Classic League'}
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white">{league.name}</h2>
          {league.description && (
            <p className="mt-1 text-sm text-slate-400">{league.description}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {league.inviteCode && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="font-mono text-emerald-400 text-xs">{league.inviteCode}</span>
                  <span className="text-emerald-400 text-xs">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span className="font-mono text-xs">{league.inviteCode}</span>
                  <span className="text-xs text-slate-400">Copy Invite</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:border-amber-400 hover:bg-amber-500/20"
          >
            View League
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
            <Users className="h-3.5 w-3.5" />
            Managers
          </div>
          <div className="mt-2 text-2xl font-black text-white">{league.currentParticipants}</div>
          <div className="mt-0.5 text-xs text-slate-500">of {league.maxParticipants} spots</div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-amber-500/60"
              style={{ width: `${Math.min(100, (league.currentParticipants / league.maxParticipants) * 100)}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
            {isH2H ? <Swords className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />}
            Format
          </div>
          <div className="mt-2 text-lg font-bold text-white">{isH2H ? 'Head-to-Head' : 'Classic'}</div>
          <div className="mt-0.5 text-xs text-slate-500">{isH2H ? '3pts Win / 1pt Draw' : 'Total Points'}</div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
            <Star className="h-3.5 w-3.5" />
            Privacy
          </div>
          <div className="mt-2 text-lg font-bold capitalize text-white">{league.privacyLevel}</div>
          <div className="mt-0.5 text-xs text-slate-500">{league.privacyLevel === 'private' ? 'Invite code required' : 'Open to all'}</div>
        </div>

        {topEntry && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80">League Leader</div>
            <div className="mt-2 truncate text-base font-bold text-white">{topEntry.manager}</div>
            <div className="mt-0.5 font-mono text-2xl font-black text-amber-400">{topEntry.points}<span className="ml-1 text-xs font-sans text-amber-300/70">pts</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
