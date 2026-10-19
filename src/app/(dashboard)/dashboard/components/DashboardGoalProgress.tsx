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

  // Calculate Rank Status & Progress
  const isRankAchieved = targetRank && globalRank ? globalRank <= targetRank : false;
  const rankCompletion = isRankAchieved
    ? 100
    : targetRank && globalRank
    ? Math.min(95, Math.max(10, Math.round((targetRank / globalRank) * 100)))
    : 10;

  return (
    <>
      <section
        aria-labelledby="season-goals-title"
        className="rounded-2xl p-5 shadow-sm transition-all"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{
                  background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)',
                  color: 'var(--accent-primary)',
                }}
              >
                <Target className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
                  Personal Milestones
                </p>
                <h2 id="season-goals-title" className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  Season Goals
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={openModal}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition-all hover:opacity-80 cursor-pointer"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              <Edit3 className="h-3 w-3" />
              {hasAnyGoal ? 'Edit' : 'Set'}
            </button>
          </div>

          {!hasAnyGoal ? (
            <div
              className="flex flex-col items-center justify-center text-center gap-3 rounded-xl p-4 border border-dashed"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface-muted)',
              }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}
              >
                <Trophy className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  No season goals set yet
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Set target points or rank to track your season climb.
                </p>
              </div>
              <button
                type="button"
                onClick={openModal}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:opacity-90 cursor-pointer"
                style={{ background: 'var(--accent-primary)' }}
              >
                Set Goals &rarr;
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Points Goal Progress Card - 1 card per row */}
              <div
                className="rounded-xl p-3.5 shadow-2xs transition-all"
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderLeft: '4px solid #10b981',
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-emerald-500"
                      style={{ background: 'rgba(16, 185, 129, 0.12)' }}
                    >
                      <Flame className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Points Target
                    </span>
                  </div>
                  {targetPoints !== null ? (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-500"
                      style={{ background: 'rgba(16, 185, 129, 0.12)' }}
                    >
                      {pointsCompletion}% Complete
                    </span>
                  ) : (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      Not set
                    </span>
                  )}
                </div>

                {targetPoints !== null ? (
                  <>
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black font-mono" style={{ color: 'var(--text-primary)' }}>
                          {totalPoints.toFixed(1)}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                          / {targetPoints.toFixed(1)} pts
                        </span>
                      </div>
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        {totalPoints >= targetPoints
                          ? '🎉 Goal Reached!'
                          : `${(targetPoints - totalPoints).toFixed(1)} pts needed`}
                      </span>
                    </div>

                    {/* Progress Bar Container */}
                    <div
                      className="w-full h-2 rounded-full overflow-hidden"
                      style={{ background: 'var(--surface-muted)' }}
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
                  <div className="py-1 flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      No points goal active
                    </span>
                    <button
                      type="button"
                      onClick={openModal}
                      className="text-xs font-semibold text-emerald-500 hover:underline cursor-pointer"
                    >
                      + Add points goal
                    </button>
                  </div>
                )}
              </div>

              {/* Rank Goal Progress Card - 1 card per row */}
              <div
                className="rounded-xl p-3.5 shadow-2xs transition-all"
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderLeft: '4px solid #06b6d4',
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-cyan-500"
                      style={{ background: 'rgba(6, 182, 212, 0.12)' }}
                    >
                      <Award className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Rank Target
                    </span>
                  </div>
                  {targetRank !== null ? (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        background: isRankAchieved ? 'rgba(16, 185, 129, 0.12)' : 'rgba(6, 182, 212, 0.12)',
                        color: isRankAchieved ? '#10b981' : '#06b6d4',
                      }}
                    >
                      {isRankAchieved ? 'Target Achieved' : 'In Progress'}
                    </span>
                  ) : (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      Not set
                    </span>
                  )}
                </div>

                {targetRank !== null ? (
                  <>
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black font-mono" style={{ color: 'var(--text-primary)' }}>
                          {globalRank !== null ? `#${globalRank}` : 'Unranked'}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                          / Target: Top {targetRank.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        {globalRank !== null
                          ? globalRank <= targetRank
                            ? '🏆 Inside Target Range!'
                            : `${(globalRank - targetRank).toLocaleString()} spots to go`
                          : 'Rank pending'}
                      </span>
                    </div>

                    {/* Progress Bar Container for Rank */}
                    <div
                      className="w-full h-2 rounded-full overflow-hidden"
                      style={{ background: 'var(--surface-muted)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${isRankAchieved ? 100 : rankCompletion}%`,
                          background: isRankAchieved
                            ? 'linear-gradient(90deg, #10b981, #059669)'
                            : 'linear-gradient(90deg, #06b6d4, #3b82f6)',
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="py-1 flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      No rank goal active
                    </span>
                    <button
                      type="button"
                      onClick={openModal}
                      className="text-xs font-semibold text-cyan-500 hover:underline cursor-pointer"
                    >
                      + Add rank goal
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
