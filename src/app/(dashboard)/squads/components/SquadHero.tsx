'use client';

import { AlarmClockCheck, DollarSign, Trophy, UserCheck, Wallet, ArrowRight, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDeadlineCountdown, formatGameweekDeadline } from '../../gameweeks/gameweeks-utils';

interface SquadHeroProps {
  gameweek: {
    id: number;
    gameweekNumber: number;
    deadline?: string | null;
    isLocked?: boolean;
  } | null;
  budget: number;
  totalSquadValue: number;
  totalPoints: number;
  globalRank: number | null;
  captainName: string | null;
  viceCaptainName: string | null;
  startersCount: number;
  totalPlayersCount: number;
}

export function SquadHero({
  gameweek,
  budget,
  totalSquadValue,
  totalPoints,
  globalRank,
  captainName,
  viceCaptainName,
  startersCount,
  totalPlayersCount,
}: SquadHeroProps) {
  const [countdown, setCountdown] = useState(() => ({
    totalMs: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isUrgent: false,
  }));

  useEffect(() => {
    if (!gameweek?.deadline) return;

    const updateCountdown = () => {
      setCountdown(getDeadlineCountdown(gameweek.deadline!));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [gameweek?.deadline]);

  const hasDeadline = Boolean(gameweek?.deadline && !gameweek.isLocked && countdown.totalMs > 0);

  return (
    <div className="squad-hero-card mb-8 overflow-hidden rounded-3xl border border-teal-500/30 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.12),transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-2xl shadow-teal-500/10">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-teal-500/40 bg-teal-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-300">
            <AlarmClockCheck className="h-3.5 w-3.5" />
            {gameweek ? `Gameweek ${gameweek.gameweekNumber}` : 'Fantasy Season'}
          </div>
          <h1 className="squad-hero-title text-3xl font-black tracking-tight text-white">My Squad</h1>
          <p className="squad-hero-subtitle mt-1 text-sm text-slate-300">
            {gameweek?.deadline ? (
              <span>
                Lineup deadline: <span className="font-semibold text-white">{formatGameweekDeadline(gameweek.deadline)}</span>
              </span>
            ) : (
              'Manage your core starters, substitute bench, and fantasy captaincy.'
            )}
          </p>
        </div>

        {hasDeadline ? (
          <div
            className={`rounded-2xl border px-4 py-3 ${
              countdown.isUrgent
                ? 'border-rose-500/40 bg-rose-500/10'
                : 'border-teal-500/40 bg-teal-500/10'
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
              Deadline Countdown
            </div>
            <div
              className={`mt-1 font-mono text-2xl font-black ${
                countdown.isUrgent ? 'text-rose-300' : 'text-teal-300'
              }`}
            >
              {countdown.days}d : {String(countdown.hours).padStart(2, '0')}h :{' '}
              {String(countdown.minutes).padStart(2, '0')}m :{' '}
              {String(countdown.seconds).padStart(2, '0')}s
            </div>
          </div>
        ) : gameweek?.isLocked ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-300">
            <ShieldAlert className="h-4 w-4" />
            Gameweek Locked
          </div>
        ) : null}
      </div>

      {/* Metric Cards Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Squad Value */}
        <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 transition hover:border-slate-600">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Squad Value
            </span>
            <DollarSign className="h-4 w-4 text-teal-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            ${totalSquadValue.toFixed(1)}M
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {totalPlayersCount}/8 players signed
          </p>
        </div>

        {/* Bank In Hand */}
        <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 transition hover:border-slate-600">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Bank Balance
            </span>
            <Wallet className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-300">
            ${budget.toFixed(1)}M
          </div>
          <p className="mt-1 text-xs text-slate-400">Remaining to spend</p>
        </div>

        {/* Total Points / Rank */}
        <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 transition hover:border-slate-600">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Season Points
            </span>
            <Trophy className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {totalPoints.toFixed(1)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {globalRank ? `Global Rank #${globalRank}` : 'Unranked'}
          </p>
        </div>

        {/* Captain & Starters */}
        <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4 transition hover:border-slate-600">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Active Captain
            </span>
            <UserCheck className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 truncate text-lg font-bold text-white">
            {captainName || 'Not Designated'}
          </div>
          <p className="mt-1 truncate text-xs text-slate-400">
            {startersCount}/5 starters active {viceCaptainName ? `• VC: ${viceCaptainName}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
