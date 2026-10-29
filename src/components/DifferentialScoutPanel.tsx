'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';
import {
  Sparkles,
  Flame,
  Target,
  Anchor,
  TrendingUp,
  Lock,
  Plus,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowDownCircle,
} from 'lucide-react';

export interface RecommendationItem {
  id: number;
  name: string;
  in_game_name?: string | null;
  primary_role: string;
  current_price: number;
  ownership_percentage: number;
  recommendation_type: 'differential' | 'value_momentum' | 'high_ceiling' | 'consistent_anchor';
  reason: string;
  confidence: number;
  projected_points: number;
}

interface DifferentialScoutPanelProps {
  selectedPlayerInId?: number | null;
  onSelectPlayerIn?: (playerId: number) => void;
  defaultCollapsed?: boolean;
}

export function DifferentialScoutPanel({
  selectedPlayerInId,
  onSelectPlayerIn,
  defaultCollapsed = false,
}: DifferentialScoutPanelProps) {
  const toast = useToast();
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [lastSelectedPlayer, setLastSelectedPlayer] = useState<RecommendationItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      setLoading(true);
      try {
        const res = await fetchWithAuth('/api/players/recommendations');
        if (cancelled) return;

        if (res.status === 403) {
          setIsPremium(false);
          setLoading(false);
          return;
        }

        if (!res.ok) {
          setIsPremium(false);
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (!cancelled && Array.isArray(data.recommendations)) {
          setRecommendations(data.recommendations);
          setIsPremium(true);
        }
      } catch {
        if (!cancelled) setIsPremium(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (rec: RecommendationItem) => {
    setLastSelectedPlayer(rec);
    if (onSelectPlayerIn) {
      onSelectPlayerIn(rec.id);
    }
    toast.success(
      `${rec.in_game_name || rec.name} added to Transfer In!`,
      'Scroll down to Trade Review to review and confirm your swap.'
    );
  };

  const scrollToReview = () => {
    const el = document.getElementById('trade-review-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const filteredItems = recommendations.filter((item) => {
    if (selectedFilter === 'all') return true;
    return item.recommendation_type === selectedFilter;
  });

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-cyan-500/30 bg-[var(--surface)] shadow-md shadow-cyan-500/5 transition-all">
      {/* Header bar - Clickable to toggle collapse */}
      <div
        className={`relative overflow-hidden bg-gradient-to-r from-cyan-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 transition-colors ${
          !isCollapsed ? 'border-b border-[var(--border)]' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-expanded={!isCollapsed}
          className="flex w-full items-center justify-between gap-4 text-left transition hover:opacity-95 focus:outline-none"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-amber-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20">
              <Flame className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-[var(--text-primary)]">
                  Differential Scout &amp; Recommendations
                </h2>
                <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                  Premium
                </span>
                {isPremium && recommendations.length > 0 && (
                  <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-300">
                    {recommendations.length} Active Targets
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)] truncate sm:whitespace-normal">
                {isCollapsed
                  ? 'Click to expand AI-analyzed differential targets and projections.'
                  : 'AI-ranked targets, sub-15% differential gems, and form-momentum picks to outscore league rivals.'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden sm:inline text-xs font-semibold text-cyan-700 dark:text-cyan-400">
              {isCollapsed ? 'Expand Scout' : 'Collapse'}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </span>
          </div>
        </button>

        {/* Filter pills when expanded and premium */}
        {!isCollapsed && isPremium && (
          <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]/60">
            {[
              { id: 'all', label: 'All Targets', icon: Sparkles },
              { id: 'differential', label: 'Differentials (<15%)', icon: Flame },
              { id: 'high_ceiling', label: 'High Ceiling', icon: Target },
              { id: 'value_momentum', label: 'Value Momentum', icon: TrendingUp },
              { id: 'consistent_anchor', label: 'Consistent Anchors', icon: Anchor },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = selectedFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedFilter(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    active
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-cyan-500/40'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Persistent Selection Banner when a recommendation is chosen */}
      {!isCollapsed && lastSelectedPlayer && (
        <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-500/15 via-[var(--surface-raised)] to-[var(--surface-raised)] flex flex-wrap items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500 text-slate-950">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div className="text-xs">
              <span className="font-bold text-[var(--text-primary)]">
                {lastSelectedPlayer.in_game_name || lastSelectedPlayer.name}
              </span>
              <span className="text-[var(--text-secondary)]"> selected as Transfer In. Once you are done selecting, please scroll down to the </span>
              <span className="font-bold text-cyan-600 dark:text-cyan-400">Trade Review</span>
              <span className="text-[var(--text-secondary)]"> area to confirm your move.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={scrollToReview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-xs shrink-0"
          >
            <span>Scroll to Trade Review</span>
            <ArrowDownCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Expanded body */}
      {!isCollapsed && (
        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)]" />
              ))}
            </div>
          ) : isPremium === false ? (
            <div className="p-8 text-center bg-[var(--surface-raised)]/50 rounded-xl border border-dashed border-amber-500/30">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-3">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Unlock Differential Scout &amp; Recommendations
              </h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
                Gain access to AI-analyzed differential gems, projected gameweek output, and category momentum signals to win your private leagues.
              </p>
              <div className="mt-5">
                <Link
                  href="/premium"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs px-5 py-2.5 shadow-md shadow-amber-500/20 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Explore Premium Access</span>
                </Link>
              </div>
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((rec) => {
                const isSelected = selectedPlayerInId === rec.id;

                const badgeStyle =
                  rec.recommendation_type === 'differential'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    : rec.recommendation_type === 'high_ceiling'
                      ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                      : rec.recommendation_type === 'value_momentum'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30';

                const badgeLabel =
                  rec.recommendation_type === 'differential'
                    ? 'Differential'
                    : rec.recommendation_type === 'high_ceiling'
                      ? 'High Ceiling'
                      : rec.recommendation_type === 'value_momentum'
                        ? 'Value Momentum'
                        : 'Anchor';

                return (
                  <article
                    key={rec.id}
                    className={`flex flex-col justify-between rounded-xl border p-4 sm:p-4.5 transition-all ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/10 ring-2 ring-cyan-500/50 shadow-lg shadow-cyan-500/15'
                        : 'border-[var(--border)] bg-[var(--surface-raised)] hover:border-cyan-500/50 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-[var(--text-primary)]">
                              {rec.in_game_name || rec.name}
                            </h4>
                            <span className="text-[10px] uppercase font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                              {rec.primary_role}
                            </span>
                          </div>
                          <span className="text-xs font-mono font-semibold text-[var(--text-muted)]">
                            ${rec.current_price.toFixed(1)}M
                          </span>
                        </div>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeStyle}`}>
                          {badgeLabel}
                        </span>
                      </div>

                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-2.5">
                        {rec.reason}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[var(--border)]">
                      <div className="flex items-center justify-between text-xs mb-3 font-mono">
                        <div>
                          <span className="text-[10px] text-[var(--text-muted)] block font-sans">Ownership</span>
                          <span className="font-bold text-[var(--text-primary)]">{rec.ownership_percentage}%</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[var(--text-muted)] block font-sans">Projected</span>
                          <span className="font-bold text-cyan-600 dark:text-cyan-400">{rec.projected_points} pts</span>
                        </div>
                      </div>

                      {onSelectPlayerIn && (
                        <button
                          type="button"
                          onClick={() => handleSelect(rec)}
                          className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition shadow-xs ${
                            isSelected
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-1 ring-emerald-400'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Selected for Transfer In</span>
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" />
                              <span>Select as Transfer In</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-[var(--text-muted)]">
              No recommendations found for this category filter.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
