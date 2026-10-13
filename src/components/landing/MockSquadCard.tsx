'use client';

import { useState } from 'react';

const MOCK_PLAYERS = [
  { name: 'Yatoro', role: 'Carry', team: 'Spirit', pts: 184, trend: '+12', isCaptain: true },
  { name: 'Collapse', role: 'Offlane', team: 'Spirit', pts: 147, trend: '+8', isCaptain: false },
  { name: 'Tobi', role: 'Support', team: 'OG', pts: 139, trend: '+5', isCaptain: false },
  { name: 'Skiter', role: 'Carry', team: 'Tundra', pts: 122, trend: '+3', isCaptain: false },
  { name: 'Ghost', role: 'Mid', team: 'Spirit', pts: 118, trend: '+9', isCaptain: false },
];

const BENCH = [
  { name: 'Miposhka', role: 'Support', team: 'Spirit', pts: 95, trend: '+2', isCaptain: false },
  { name: 'Nine', role: 'Mid', team: 'OG', pts: 88, trend: '+4', isCaptain: false },
  { name: 'Sneyking', role: 'Support', team: 'Quest', pts: 72, trend: '-1', isCaptain: false },
];

const ROLE_COLORS: Record<string, string> = {
  Carry: 'text-amber-400 bg-amber-500/10 ring-amber-500/30',
  Mid: 'text-cyan-400 bg-cyan-500/10 ring-cyan-500/30',
  Offlane: 'text-violet-400 bg-violet-500/10 ring-violet-500/30',
  Support: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/30',
};

function PlayerRow({ player, bench = false }: { player: typeof MOCK_PLAYERS[0]; bench?: boolean }) {
  const roleStyle = ROLE_COLORS[player.role] ?? 'text-slate-400 bg-slate-500/10 ring-slate-500/30';
  const trendPositive = player.trend.startsWith('+');

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-all duration-200
        ${bench
          ? 'border-slate-800/60 bg-slate-900/30 opacity-60 hover:opacity-80'
          : 'border-slate-700/50 bg-slate-900/60 hover:border-amber-500/40 hover:bg-slate-800/60'
        }
        ${player.isCaptain ? 'ring-1 ring-amber-500/40 shadow-[0_0_18px_rgba(245,158,11,0.12)]' : ''}
      `}
    >
      {/* Captain badge */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 ring-1 ring-slate-700/60">
        {player.isCaptain ? (
          <span className="text-xs font-black text-amber-400">C</span>
        ) : (
          <span className="h-2 w-2 rounded-full bg-slate-600" />
        )}
      </div>

      {/* Avatar placeholder */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 ring-1 ring-slate-600/50 text-xs font-bold text-slate-300">
        {player.name.slice(0, 2)}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{player.name}</p>
        <p className="text-xs text-slate-500">{player.team}</p>
      </div>

      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${roleStyle}`}>
        {player.role}
      </span>

      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-white">{player.pts}</p>
        <p className={`text-[10px] font-semibold ${trendPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {player.trend}
        </p>
      </div>
    </div>
  );
}

export function MockSquadCard() {
  const [showBench, setShowBench] = useState(false);

  const totalPts = MOCK_PLAYERS.reduce((sum, p) => sum + p.pts, 0) + (MOCK_PLAYERS[0].pts); // captain doubled

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Glow backdrop */}
      <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-amber-500/5 blur-2xl" />

      <div className="relative rounded-2xl border border-slate-700/60 bg-slate-900/80 shadow-[0_30px_70px_rgba(0,0,0,0.5)] backdrop-blur-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 px-5 py-3.5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">My Squad</p>
            <p className="text-base font-bold text-white">Gameweek 14</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Total Pts</p>
            <p className="text-xl font-black text-amber-400">{totalPts}</p>
          </div>
        </div>

        {/* Starters */}
        <div className="space-y-2 p-4">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Starters</p>
          {MOCK_PLAYERS.map((p) => (
            <PlayerRow key={p.name} player={p} />
          ))}
        </div>

        {/* Bench toggle */}
        <button
          onClick={() => setShowBench((v) => !v)}
          className="w-full border-t border-slate-800/60 bg-slate-950/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-slate-500 transition-colors hover:text-amber-400"
        >
          {showBench ? '▲ Hide Bench' : '▼ Show Bench'}
        </button>

        {showBench && (
          <div className="space-y-2 p-4 pt-0">
            {BENCH.map((p) => (
              <PlayerRow key={p.name} player={p} bench />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
