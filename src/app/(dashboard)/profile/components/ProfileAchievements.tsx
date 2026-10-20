'use client';

import { useState } from 'react';
import { Award, Lock, CheckCircle2, Sparkles } from 'lucide-react';
import type { Achievement } from './achievementsData';

interface ProfileAchievementsProps {
  achievements: Achievement[];
}

const TIER_STYLES = {
  bronze: {
    border: 'border-orange-500/40',
    badge: 'border-orange-500/40 bg-orange-500/10 text-orange-800 dark:text-orange-300',
    icon: 'bg-orange-500/10 text-orange-800 dark:text-orange-300',
    progress: 'bg-orange-500',
  },
  silver: {
    border: 'border-slate-400/60',
    badge: 'border-slate-400/50 bg-slate-400/15 text-slate-700 dark:text-slate-200',
    icon: 'bg-slate-400/15 text-slate-700 dark:text-slate-200',
    progress: 'bg-slate-500',
  },
  gold: {
    border: 'border-yellow-500/50',
    badge: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300',
    icon: 'bg-yellow-500/10 text-yellow-800 dark:text-yellow-300',
    progress: 'bg-yellow-500',
  },
  platinum: {
    border: 'border-cyan-500/50',
    badge: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-800 dark:text-cyan-300',
    icon: 'bg-cyan-500/10 text-cyan-800 dark:text-cyan-300',
    progress: 'bg-cyan-500',
  },
};

export function ProfileAchievements({ achievements }: ProfileAchievementsProps) {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'in-progress'>('all');

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const completionPercentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const filteredAchievements = achievements.filter((item) => {
    if (filter === 'unlocked') return item.unlocked;
    if (filter === 'in-progress') return !item.unlocked;
    return true;
  });

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl sm:p-6">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Achievements & Badges</h2>
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Manager milestones earned throughout competitive fantasy seasons.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5">
          <div className="text-right">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Milestones Earned</p>
            <p className="text-sm font-black text-amber-700 dark:text-amber-300">
              {unlockedCount} / {totalCount} <span className="text-xs font-medium text-[var(--text-muted)]">({completionPercentage}%)</span>
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div role="group" aria-label="Filter achievements" className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        {(['all', 'unlocked', 'in-progress'] as const).map((tabKey) => {
          const isActive = filter === tabKey;
          const label = tabKey === 'all' ? `All (${totalCount})` : tabKey === 'unlocked' ? `Unlocked (${unlockedCount})` : `In Progress (${totalCount - unlockedCount})`;
          return (
            <button
              key={tabKey}
              type="button"
              onClick={() => setFilter(tabKey)}
              aria-pressed={isActive}
              className={`rounded-lg px-3 py-1.5 transition ${
                isActive
                  ? 'border border-cyan-500/40 bg-cyan-500/10 text-cyan-800 dark:text-cyan-300'
                  : 'border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAchievements.map((badge) => {
          const style = TIER_STYLES[badge.tier];
          const progressPercent = Math.min(100, Math.max(0, badge.progressPercent));

          return (
            <div
              key={badge.id}
              className={`relative flex flex-col justify-between overflow-hidden rounded-xl border bg-[var(--surface-raised)] p-4 transition hover:-translate-y-0.5 ${
                badge.unlocked
                  ? style.border
                  : 'border-[var(--border)]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] text-xl ${badge.unlocked ? style.icon : 'bg-[var(--surface)] text-[var(--text-muted)] grayscale'}`}>
                      {badge.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">{badge.title}</h3>
                      </div>
                      <span className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${style.badge}`}>
                        {badge.tier === 'platinum' ? 'Platinum' : badge.tier}
                      </span>
                    </div>
                  </div>

                  {badge.unlocked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300" aria-label="Unlocked">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)]" aria-label="Locked">
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>

                <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {badge.description}
                </p>
              </div>

              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                  <span>{badge.progressText}</span>
                  {badge.unlocked && badge.unlockedAtLabel && (
                    <span className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-300">{badge.unlockedAtLabel}</span>
                  )}
                </div>

                <div
                  className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface)]"
                  role="progressbar"
                  aria-label={`${badge.title} progress`}
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${badge.unlocked ? 'bg-emerald-500' : style.progress}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {filteredAchievements.length === 0 && (
        <p className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 text-center text-sm text-[var(--text-secondary)]">
          No achievements have been unlocked yet. Keep playing to earn your first badge.
        </p>
      )}
    </section>
  );
}
