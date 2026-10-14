'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, Clock, Lock, Wallet } from 'lucide-react';
import type { QuickStats } from './header-types';

export function QuickStatsBar({ quickStats }: { quickStats: QuickStats | null }) {
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

  const gw = quickStats?.gameweek;
  let isDeadlinePassed = false;
  let deadlineCountdown: string | null = null;
  let tooltipText = '';

  if (gw?.deadline && currentTime) {
    const deadlineMs = new Date(gw.deadline).getTime();
    const diff = deadlineMs - currentTime;
    if (diff <= 0) {
      isDeadlinePassed = true;
      tooltipText = `Gameweek ${gw.gameweek_number} deadline has passed. Lineup changes and transfers for this gameweek are locked. Matches are currently live and scoring.`;
    } else {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      deadlineCountdown = hours < 24
        ? `${hours}h ${mins}m`
        : `${Math.floor(hours / 24)}d ${hours % 24}h`;
      tooltipText = `Gameweek ${gw.gameweek_number} deadline locks in ${deadlineCountdown}. Finalize your starters, captain, and transfers before the deadline.`;
    }
  } else if (gw) {
    tooltipText = `Gameweek ${gw.gameweek_number} · View fixtures and standings`;
  }

  return (
    <div className="hidden sm:flex items-center gap-2">
      {gw && (
        <div className="relative group">
          <Link
            href="/gameweeks"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-medium text-amber-400 transition-colors"
            aria-label={`Gameweek ${gw.gameweek_number}: ${isDeadlinePassed ? 'Live (Deadline passed)' : deadlineCountdown || 'Active'}`}
          >
            <Clock className="h-3.5 w-3.5 animate-pulse text-amber-400" />
            <span>GW{gw.gameweek_number}:</span>
            {isDeadlinePassed ? (
              <span className="flex items-center gap-1">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Live</span>
                <span className="flex items-center justify-center rounded-full bg-amber-500/20 p-0.5 text-amber-800 dark:bg-slate-800/90 dark:text-amber-400" title="Lineups & transfers locked">
                  <Lock className="h-3 w-3" />
                </span>
              </span>
            ) : (
              <span className="font-semibold text-amber-900 dark:text-white">{deadlineCountdown || 'Active'}</span>
            )}
          </Link>

          {/* Explanatory Tooltip on Hover / Focus */}
          <div
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full mt-2 z-70 hidden w-64 rounded-lg border border-slate-700 bg-slate-900/95 p-2.5 text-xs text-slate-300 shadow-2xl backdrop-blur-md group-hover:block group-focus-within:block transition-all"
          >
            <div className="flex items-center gap-1.5 font-semibold text-white mb-1">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span>Gameweek {gw.gameweek_number} {isDeadlinePassed ? '· Live (Locked)' : '· Deadline'}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {tooltipText}
            </p>
            {isDeadlinePassed && (
              <p className="mt-1.5 border-t border-slate-800 pt-1 text-[10px] text-amber-400/90">
                Lineup edits and transfer points hits are locked for this round.
              </p>
            )}
          </div>
        </div>
      )}
      <Link
        href="/transfers"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-xs text-slate-300 transition-colors"
        title="Remaining Transfer Budget"
      >
        <Wallet className="h-3.5 w-3.5 text-emerald-400" />
        <span className="font-semibold text-emerald-400">
          ${Number(quickStats?.bankBalance ?? 100).toFixed(1)}M
        </span>
      </Link>
      <Link
        href="/transfers"
        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-xs text-slate-300 transition-colors"
        title="Available Free Transfers"
      >
        <ArrowLeftRight className="h-3 w-3 text-cyan-400" />
        <span>
          <span className="font-semibold text-white">{quickStats?.freeTransfers ?? 2}</span> FT
        </span>
      </Link>
    </div>
  );
}
