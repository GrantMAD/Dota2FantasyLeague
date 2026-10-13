'use client';

import { useState } from 'react';

type StatCardProps = {
  value: number;
  label: string;
  suffix?: string;
  valueClassName?: string;
};

function StatCard({ value, label, suffix = '', valueClassName = 'text-amber-500' }: StatCardProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-800/20 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
      <p className={`mb-2 text-4xl font-bold md:text-5xl ${valueClassName}`}>
        {value.toLocaleString()}
        {suffix}
      </p>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
    </div>
  );
}

export function LandingStats({ playerCount, teamCount }: { playerCount: number; teamCount: number }) {
  const [playerValue] = useState(playerCount);
  const [teamValue] = useState(teamCount);

  return (
    <div className="mt-16 grid grid-cols-1 gap-8 border-t border-slate-700/50 py-12 sm:grid-cols-3">
      <StatCard value={playerValue} label="Pro Players" suffix="+" />
      <StatCard value={teamValue} label="Pro Teams" />
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-800/20 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
        <div className="mb-2 flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse" />
          <p className="text-4xl font-bold text-amber-500 md:text-5xl">Live</p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Match Data</p>
      </div>
    </div>
  );
}
