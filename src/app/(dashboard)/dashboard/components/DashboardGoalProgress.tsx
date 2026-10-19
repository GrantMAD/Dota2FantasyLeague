'use client';

import { useState } from 'react';
import { Target, Trophy, Edit3, X, Flame, Award } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';

interface DashboardGoalProgressProps {
  initialTargetPoints?: number | null;
  initialTargetRank?: number | null;
  totalPoints: number;
  globalRank: number | null;
  onGoalsUpdated?: (goals: { targetPoints: number | null; targetRank: number | null }) => void;
}

export function DashboardGoalProgress({
  initialTargetPoints = null,
  initialTargetRank = null,
  totalPoints,
  globalRank,
  onGoalsUpdated,
}: DashboardGoalProgressProps) {
  const toast = useToast();
  const [targetPoints, setTargetPoints] = useState<number | null>(initialTargetPoints ?? null);
  const [targetRank, setTargetRank] = useState<number | null>(initialTargetRank ?? null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states in modal
  const [pointsInput, setPointsInput] = useState<string>(targetPoints ? String(targetPoints) : '');
  const [rankInput, setRankInput] = useState<string>(targetRank ? String(targetRank) : '');

  const openModal = () => {
    setPointsInput(targetPoints ? String(targetPoints) : '');
    setRankInput(targetRank ? String(targetRank) : '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const parsedPoints = pointsInput.trim() === '' ? null : Number(pointsInput);
    const parsedRank = rankInput.trim() === '' ? null : Number(rankInput);

    if (parsedPoints !== null && (isNaN(parsedPoints) || parsedPoints <= 0)) {
      toast.error('Target points must be a valid positive number');
      setSaving(false);
      return;
    }

    if (parsedRank !== null && (isNaN(parsedRank) || !Number.isInteger(parsedRank) || parsedRank < 1)) {
      toast.error('Target rank must be a valid positive integer');
      setSaving(false);
      return;
    }

    try {
      const response = await fetchWithAuth('/api/user/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPoints: parsedPoints,
          targetRank: parsedRank,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save goals');
      }

      const data = await response.json();
      setTargetPoints(data.targetPoints ?? null);
      setTargetRank(data.targetRank ?? null);
      if (onGoalsUpdated) {
        onGoalsUpdated({
          targetPoints: data.targetPoints ?? null,
          targetRank: data.targetRank ?? null,
        });
      }
      toast.success('Season goals updated successfully');
      setIsModalOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save goals');
    } finally {
      setSaving(false);
    }
  };

  const hasAnyGoal = targetPoints !== null || targetRank !== null;

  // Calculate Points Progress
  const pointsCompletion = targetPoints && targetPoints > 0
    ? Math.min(100, Math.max(0, Math.round((totalPoints / targetPoints) * 100)))
    : 0;

  // Calculate Rank Status
  const isRankAchieved = targetRank && globalRank ? globalRank <= targetRank : false;

  return (
    <>
      <section
        aria-labelledby="season-goals-title"
        className="mb-8 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden shadow-xs dark:shadow-md transition-all"
      >
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              >
                <Target className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Personal Milestones
                </p>
                <h2 id="season-goals-title" className="text-lg font-bold text-slate-900 dark:text-white">
                  Season Goals
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={openModal}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {hasAnyGoal ? 'Edit Goals' : 'Set Goals'}
            </button>
          </div>

          {!hasAnyGoal ? (
            <div
              className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl p-4 border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30"
            >
              <div className="flex items-center gap-3 text-center sm:text-left">
                <div
                  className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                >
                  <Trophy className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    No season goals set yet
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Set a target fantasy points or global rank goal to stay motivated and track your progress.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={openModal}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-amber-400 hover:to-orange-500 transition-all cursor-pointer"
              >
                Set Your First Goal &rarr;
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Points Goal Progress Card - Emerald/Amber Theme like Feed Row */}
              <div
                className="rounded-xl p-4 border border-slate-200/90 dark:border-slate-800 border-l-4 border-l-emerald-500/90 bg-linear-to-r from-emerald-500/[0.04] to-transparent bg-white dark:bg-slate-900/60 shadow-2xs transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <Flame className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Points Target
                    </span>
                  </div>
                  {targetPoints !== null ? (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        pointsCompletion >= 100
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {pointsCompletion}% Complete
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      Not set
                    </span>
                  )}
                </div>

                {targetPoints !== null ? (
                  <>
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                          {totalPoints.toFixed(1)}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          / {targetPoints.toFixed(1)} pts
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {totalPoints >= targetPoints
                          ? '🎉 Goal Reached!'
                          : `${(targetPoints - totalPoints).toFixed(1)} pts needed`}
                      </span>
                    </div>

                    {/* Progress Bar Container */}
                    <div
                      className="w-full h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800/80"
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${pointsCompletion}%`,
                          background:
                            pointsCompletion >= 100
                              ? 'linear-gradient(90deg, #10b981, #059669)'
                              : 'linear-gradient(90deg, #10b981, #34d399)',
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      No points goal active
                    </span>
                    <button
                      type="button"
                      onClick={openModal}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      + Add points goal
                    </button>
                  </div>
                )}
              </div>

              {/* Rank Goal Progress Card - Cyan/Blue Theme like Feed Row */}
              <div
                className="rounded-xl p-4 border border-slate-200/90 dark:border-slate-800 border-l-4 border-l-cyan-500/90 bg-linear-to-r from-cyan-500/[0.04] to-transparent bg-white dark:bg-slate-900/60 shadow-2xs transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                      <Award className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Rank Target
                    </span>
                  </div>
                  {targetRank !== null ? (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isRankAchieved
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                      }`}
                    >
                      {isRankAchieved ? 'Target Achieved' : 'In Progress'}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      Not set
                    </span>
                  )}
                </div>

                {targetRank !== null ? (
                  <>
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                          {globalRank !== null ? `#${globalRank}` : 'Unranked'}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          / Target: Top {targetRank.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {globalRank !== null
                          ? globalRank <= targetRank
                            ? '🏆 Inside Target Range!'
                            : `${(globalRank - targetRank).toLocaleString()} spots to go`
                          : 'Rank pending'}
                      </span>
                    </div>

                    {/* Progress Bar Container for Rank */}
                    <div
                      className="w-full h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800/80"
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: isRankAchieved
                            ? '100%'
                            : globalRank
                            ? `${Math.min(95, Math.max(10, Math.round((targetRank / globalRank) * 100)))}%`
                            : '5%',
                          background: isRankAchieved
                            ? 'linear-gradient(90deg, #10b981, #059669)'
                            : 'linear-gradient(90deg, #06b6d4, #38bdf8)',
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      No rank target active
                    </span>
                    <button
                      type="button"
                      onClick={openModal}
                      className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      + Add rank target
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Goal Setting Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="goal-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    background: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <Target className="h-4 w-4" />
                </div>
                <h3 id="goal-modal-title" className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  Set Season Goals
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-1.5 transition hover:opacity-70 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              {/* Points Goal Input */}
              <div>
                <label
                  htmlFor="target-points-input"
                  className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Target Points Goal
                </label>
                <div className="relative">
                  <input
                    id="target-points-input"
                    type="number"
                    step="any"
                    min="1"
                    max="100000"
                    placeholder="e.g. 500"
                    value={pointsInput}
                    onChange={(e) => setPointsInput(e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-hidden transition border"
                    style={{
                      background: 'var(--surface-raised)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    pts
                  </span>
                </div>
                {/* Presets */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Presets:
                  </span>
                  {[300, 500, 750, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPointsInput(String(preset))}
                      className="rounded-md px-2 py-0.5 text-xs font-medium transition cursor-pointer"
                      style={{
                        background: 'var(--surface-muted)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rank Goal Input */}
              <div>
                <label
                  htmlFor="target-rank-input"
                  className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Target Global Rank
                </label>
                <div className="relative">
                  <input
                    id="target-rank-input"
                    type="number"
                    step="1"
                    min="1"
                    max="10000000"
                    placeholder="e.g. 100 (for Top 100)"
                    value={rankInput}
                    onChange={(e) => setRankInput(e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-hidden transition border"
                    style={{
                      background: 'var(--surface-raised)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    rank
                  </span>
                </div>
                {/* Presets */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Presets:
                  </span>
                  {[50, 100, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRankInput(String(preset))}
                      className="rounded-md px-2 py-0.5 text-xs font-medium transition cursor-pointer"
                      style={{
                        background: 'var(--surface-muted)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Top {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPointsInput('');
                    setRankInput('');
                  }}
                  disabled={saving}
                  className="text-xs font-semibold transition hover:underline cursor-pointer"
                  style={{ color: 'var(--danger)' }}
                >
                  Clear All Goals
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="rounded-xl px-4 py-2 text-xs font-semibold transition hover:opacity-80 cursor-pointer"
                    style={{
                      background: 'var(--surface-raised)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:opacity-90 cursor-pointer inline-flex items-center gap-1.5"
                    style={{ background: 'var(--accent-primary)' }}
                  >
                    {saving ? 'Saving...' : 'Save Goals'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
