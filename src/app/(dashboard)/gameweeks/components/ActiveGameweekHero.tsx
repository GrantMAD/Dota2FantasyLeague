'use client';

import Link from 'next/link';
import { AlarmClockCheck, Flame, ShieldAlert, Trophy, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { GameweekRow } from '../page';
import { formatGameweekDate, getDeadlineCountdown } from '../gameweeks-utils';

interface ActiveGameweekHeroProps {
  gameweek: GameweekRow;
}

export function ActiveGameweekHero({ gameweek }: ActiveGameweekHeroProps) {
  const [countdown, setCountdown] = useState(() => ({
    totalMs: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isUrgent: false,
  }));

  useEffect(() => {
    const updateCountdown = () => {
      setCountdown(getDeadlineCountdown(gameweek.deadline));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [gameweek.deadline]);

  const doubleTeams = gameweek.flags.filter((flag) => flag.flag === 'double');
  const blankTeams = gameweek.flags.filter((flag) => flag.flag === 'blank');

  return (
    <div className="mb-8 overflow-hidden rounded-3xl border border-amber-500/30 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-2xl shadow-amber-500/10">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300">
            <AlarmClockCheck className="h-3.5 w-3.5" />
            Active Gameweek
          </div>
          <h2 className="text-3xl font-black tracking-tight text-white">Gameweek {gameweek.gameweek_number}</h2>
          <p className="mt-1 text-sm text-slate-300">
            {formatGameweekDate(gameweek.start_date)} - {formatGameweekDate(gameweek.end_date)}
          </p>
        </div>

        <div className={`rounded-2xl border px-4 py-3 ${countdown.isUrgent ? 'border-rose-500/40 bg-rose-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">Deadline Countdown</div>
          <div className={`mt-2 font-mono text-2xl font-black ${countdown.isUrgent ? 'text-rose-300' : 'text-amber-300'}`}>
            {countdown.days} : {String(countdown.hours).padStart(2, '0')} : {String(countdown.minutes).padStart(2, '0')} : {String(countdown.seconds).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Matches</div>
              <div className="mt-2 text-2xl font-black text-white">{gameweek.match_count}</div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Tournaments</div>
              <div className="mt-2 text-lg font-bold text-white">{gameweek.tournaments.length || 0}</div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Your Score</div>
              <div className="mt-2 text-lg font-bold text-emerald-300">{gameweek.user_score != null ? `${gameweek.user_score.toFixed(1)} pts` : '—'}</div>
            </div>
          </div>

          {(doubleTeams.length > 0 || blankTeams.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {doubleTeams.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                  <Zap className="h-3.5 w-3.5" />
                  Double GW
                </span>
              )}
              {blankTeams.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300">
                  <Flame className="h-3.5 w-3.5" />
                  Blank GW
                </span>
              )}
            </div>
          )}

          {gameweek.tournaments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {gameweek.tournaments.map((tournament) => (
                <span key={tournament.id} className="rounded-full border border-slate-700 bg-slate-900/50 px-2.5 py-1 text-xs text-slate-200">
                  {tournament.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950/55 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            Quick actions
          </div>
          <Link href="/lineups" className="block rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/15">
            Set / Edit Lineup
          </Link>
          <Link href="/transfers" className="block rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-500/15">
            Transfer Market
          </Link>
          <Link href={`/matches?gameweekId=${gameweek.id}`} className="block rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white">
            Gameweek Matches
          </Link>
          {gameweek.top_scorer && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-100">
              <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-amber-300">
                <Trophy className="h-3.5 w-3.5" />
                Top scorer
              </div>
              <div className="font-medium text-white">
                {gameweek.top_scorer.in_game_name || gameweek.top_scorer.name} · {gameweek.top_scorer.total_points.toFixed(1)} pts
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
