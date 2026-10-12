'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, Clock, Wallet } from 'lucide-react';
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

  let deadlineCountdown: string | null = null;
  if (quickStats?.gameweek?.deadline && currentTime) {
    const deadlineMs = new Date(quickStats.gameweek.deadline).getTime();
    const diff = deadlineMs - currentTime;
    if (diff <= 0) {
      deadlineCountdown = 'Deadline passed';
    } else {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      deadlineCountdown = hours < 24
        ? `${hours}h ${mins}m`
        : `${Math.floor(hours / 24)}d ${hours % 24}h`;
    }
  }

  return (
    <div className="hidden sm:flex items-center gap-2">
      {quickStats?.gameweek && (
        <Link
          href="/gameweeks"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-medium text-amber-400 transition-colors"
          title={`GW${quickStats.gameweek.gameweek_number} Deadline`}
        >
          <Clock className="h-3.5 w-3.5 animate-pulse" />
          <span>GW{quickStats.gameweek.gameweek_number}:</span>
          <span className="font-semibold text-white">{deadlineCountdown || 'Active'}</span>
        </Link>
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
