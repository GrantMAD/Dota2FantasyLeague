'use client';

import { useState } from 'react';
import { Award, Lock, CheckCircle2, Sparkles } from 'lucide-react';
import type { Achievement } from './achievementsData';

interface ProfileAchievementsProps {
  achievements: Achievement[];
}

const TIER_STYLES = {
  bronze: {
    border: 'border-amber-700/30',
    badge: 'bg-amber-950/60 text-amber-300 border-amber-600/40',
    pill: 'bg-amber-500/10 text-amber-300',
  },
  silver: {
    border: 'border-slate-500/40',
    badge: 'bg-slate-800/80 text-slate-200 border-slate-400/40',
    pill: 'bg-slate-400/10 text-slate-300',
  },
  gold: {
    border: 'border-yellow-500/40',
    badge: 'bg-yellow-950/60 text-yellow-300 border-yellow-500/50',
    pill: 'bg-yellow-500/10 text-yellow-300',
  },
  mythic: {
    border: 'border-purple-500/40',
    badge: 'bg-purple-950/60 text-purple-300 border-purple-500/50',
    pill: 'bg-purple-500/10 text-purple-300',
  },
};

export function ProfileAchievements({ achievements }: ProfileAchievementsProps) {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'in-progress'>('all');

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const completionPercentage = Math.round((unlockedCount / totalCount) * 100);

  const filteredAchievements = achievements.filter((item) => {
    if (filter === 'unlocked') return item.unlocked;
    if (filter === 'in-progress') return !item.unlocked;
    return true;
  });

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Achievements & Badges</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Manager milestones earned throughout competitive fantasy seasons.
          </p>
        </div>

        {/* Milestone counter summary */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2.5">
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-400">Milestones Earned</p>
            <p className="text-sm font-black text-amber-400">
              {unlockedCount} / {totalCount} <span className="text-xs font-medium text-slate-400">({completionPercentage}%)</span>
            </p>
          </div>
          <div className="h-9 w-9 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        {(['all', 'unlocked', 'in-progress'] as const).map((tabKey) => {
          const isActive = filter === tabKey;
          const label = tabKey === 'all' ? `All (${totalCount})` : tabKey === 'unlocked' ? `Unlocked (${unlockedCount})` : `In Progress (${totalCount - unlockedCount})`;
          return (
            <button
              key={tabKey}
              type="button"
              onClick={() => setFilter(tabKey)}
              className={`rounded-lg px-3 py-1.5 transition ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-950/40 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Grid of badges */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAchievements.map((badge) => {
          const style = TIER_STYLES[badge.tier];

          return (
            <div
              key={badge.id}
              className={`relative flex flex-col justify-between overflow-hidden rounded-xl border p-4 transition ${
                badge.unlocked
                  ? `bg-slate-950/70 ${style.border} hover:border-slate-600`
                  : 'bg-slate-950/30 border-slate-800/80 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-xl shadow-inner">
                      {badge.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-white">{badge.title}</h3>
                      </div>
                      <span className={`inline-block mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${style.badge}`}>
                        {badge.tier}
                      </span>
                    </div>
                  </div>

                  {badge.unlocked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs leading-relaxed text-slate-300">
                  {badge.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{badge.progressText}</span>
                  {badge.unlocked && badge.unlockedAtLabel && (
                    <span className="font-semibold text-emerald-400">{badge.unlockedAtLabel}</span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                  <div
                    className={`h-full transition-all duration-500 ${
                      badge.unlocked ? 'bg-linear-to-r from-emerald-500 to-teal-400' : 'bg-linear-to-r from-cyan-500 to-blue-500'
                    }`}
                    style={{ width: `${badge.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
