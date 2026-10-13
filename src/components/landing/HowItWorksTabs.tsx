'use client';

import { useState } from 'react';

const TABS = [
  {
    id: 'build',
    label: 'Build Squad',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    step: '01',
    title: 'Assemble your 8-player roster',
    description:
      'Browse hundreds of professional players across every region. Balance your $50M budget between star carries and consistent supports to maximise your weekly return.',
    bullets: ['Live player pricing based on form', '$50M budget with strategic transfers', 'Regional coverage — DPC, ESL, Majors'],
    color: 'amber',
  },
  {
    id: 'lineup',
    label: 'Set Lineup',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
    step: '02',
    title: 'Lock in before the deadline',
    description:
      'Choose your 5 starting players, appoint a captain (2× points) and vice-captain (1.5× points). Swap in bench players for any inactive starters before the gameweek locks.',
    bullets: ['Captain earns 2× points', 'Auto-sub system covers inactive starters', 'Deadline alerts via notification'],
    color: 'cyan',
  },
  {
    id: 'earn',
    label: 'Earn Points',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
    step: '03',
    title: 'Watch the leaderboard climb',
    description:
      'Points are calculated live as matches finish — kills, assists, CS, net worth, and more. Climb your league table and challenge rivals in head-to-head cups.',
    bullets: ['15+ scoring metrics per player', 'Live leaderboard updates', 'Private leagues & global rankings'],
    color: 'emerald',
  },
];

const COLOR_MAP: Record<string, { tab: string; badge: string; bullet: string; border: string; glow: string }> = {
  amber: {
    tab: 'text-amber-400 border-amber-400 bg-amber-500/10',
    badge: 'text-amber-400 bg-amber-500/10 ring-amber-500/20',
    bullet: 'bg-amber-500',
    border: 'border-amber-500/40',
    glow: 'shadow-[0_0_40px_rgba(245,158,11,0.12)]',
  },
  cyan: {
    tab: 'text-cyan-400 border-cyan-400 bg-cyan-500/10',
    badge: 'text-cyan-400 bg-cyan-500/10 ring-cyan-500/20',
    bullet: 'bg-cyan-500',
    border: 'border-cyan-500/40',
    glow: 'shadow-[0_0_40px_rgba(6,182,212,0.12)]',
  },
  emerald: {
    tab: 'text-emerald-400 border-emerald-400 bg-emerald-500/10',
    badge: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20',
    bullet: 'bg-emerald-500',
    border: 'border-emerald-500/40',
    glow: 'shadow-[0_0_40px_rgba(52,211,153,0.12)]',
  },
};

export function HowItWorksTabs() {
  const [active, setActive] = useState('build');
  const tab = TABS.find((t) => t.id === active)!;
  const c = COLOR_MAP[tab.color];

  return (
    <div className="w-full">
      {/* Tab pills */}
      <div className="mb-8 flex justify-center gap-3 flex-wrap">
        {TABS.map((t) => {
          const isActive = t.id === active;
          const colors = COLOR_MAP[t.color];
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-all duration-200
                ${isActive
                  ? colors.tab
                  : 'border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-200 bg-transparent'
                }`}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content panel */}
      <div
        className={`relative overflow-hidden rounded-2xl border ${c.border} ${c.glow} bg-slate-900/70 backdrop-blur-sm`}
        key={active}
      >
        <div className="grid gap-8 p-8 md:grid-cols-2 md:items-center">
          {/* Text */}
          <div>
            <div className={`mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ring-1 ${c.badge}`}>
              Step {tab.step}
            </div>
            <h3 className="mb-3 text-2xl font-black text-white">{tab.title}</h3>
            <p className="mb-6 leading-relaxed text-slate-400">{tab.description}</p>
            <ul className="space-y-2.5">
              {tab.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${c.bullet}`} />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* Visual panel */}
          <div className="flex items-center justify-center">
            <div className={`flex h-40 w-40 items-center justify-center rounded-3xl border ${c.border} bg-slate-800/50`}>
              <span className="text-7xl font-black opacity-20 text-white">{tab.step}</span>
              <div className={`absolute text-3xl ${tab.color === 'amber' ? 'text-amber-400' : tab.color === 'cyan' ? 'text-cyan-400' : 'text-emerald-400'}`}>
                {tab.icon && (
                  <span className="scale-[3] block">
                    {tab.icon}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
