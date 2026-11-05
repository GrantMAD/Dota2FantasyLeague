'use client';

import { ArrowLeftRight, CheckCircle2, ChevronDown, ChevronUp, Sparkles, Zap } from 'lucide-react';
import { ROLE_ACCENTS, type TransferSuggestion, type TransferSuggestionSummary } from '../transfer-types';

interface TransferSuggestionsPanelProps {
  suggestions: TransferSuggestion[];
  summary: TransferSuggestionSummary | null;
  loading: boolean;
  error: string | null;
  actionLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (suggestion: TransferSuggestion) => void;
}

function SuggestedSwapCard({
  suggestion,
  actionLoading,
  onSelect,
}: {
  suggestion: TransferSuggestion;
  actionLoading: boolean;
  onSelect: (suggestion: TransferSuggestion) => void;
}) {
  const accent = ROLE_ACCENTS[suggestion.player_in_role] || 'var(--accent-primary)';

  return (
    <article className="group flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 shadow-xs transition hover:border-indigo-500/40 hover:shadow-md">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
              color: accent,
              border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
            }}
          >
            {suggestion.player_in_role}
          </span>
          <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
            Bank after: <span className="font-bold text-[var(--text-primary)]">${suggestion.budget_after.toFixed(1)}M</span>
          </span>
        </div>

        <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">SELL</span>
            <span className="block truncate text-sm font-bold text-[var(--text-primary)]" title={suggestion.player_out_name}>
              {suggestion.player_out_name}
            </span>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 text-right">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-500 dark:text-emerald-400">
              BUY (${suggestion.player_in_current_price.toFixed(1)}M)
            </span>
            <span className="block truncate text-sm font-bold text-[var(--text-primary)]" title={suggestion.player_in_name}>
              {suggestion.player_in_name}
            </span>
          </div>
        </div>

        <div className="mt-3.5 space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Why this swap</span>
          <ul className="space-y-1 pl-1">
            {suggestion.reasons.map((reason, index) => (
              <li key={`${suggestion.player_out_id}-${suggestion.player_in_id}-${index}`} className="flex items-start gap-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                <span className="mt-1 shrink-0 text-indigo-500">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        type="button"
        disabled={actionLoading}
        onClick={() => onSelect(suggestion)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50"
      >
        <Zap className="h-3.5 w-3.5" />
        <span>Load Swap into Transfer Staging</span>
      </button>
    </article>
  );
}

function NoSuggestionsMessage({ summary }: { summary: TransferSuggestionSummary | null }) {
  const showHistoryContext = summary
    && summary.status !== 'no_fantasy_season'
    && summary.status !== 'no_open_gameweek'
    && summary.status !== 'no_squad';

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-6 text-center">
      <Sparkles className="mx-auto mb-2 h-8 w-8 text-indigo-400/60" />
      <h3 className="text-sm font-bold text-[var(--text-primary)]">No Active Recommendations</h3>
      <div className="mx-auto mt-1 max-w-md space-y-1 text-xs text-[var(--text-secondary)]">
        {showHistoryContext && summary.completed_gameweeks < summary.required_gameweeks && (
          <p>
            More scoring history is needed: {summary.completed_gameweeks} of {summary.required_gameweeks} gameweeks are complete.
          </p>
        )}
        {showHistoryContext && summary.priced_role_matched_candidates === 0 && (
          <p>No available same-role replacements have a price recorded for the upcoming gameweek yet.</p>
        )}
        {summary?.status === 'no_squad' && <p>Build your squad before getting transfer suggestions.</p>}
        {summary?.status === 'no_open_gameweek' && <p>Suggestions are unavailable because there is no gameweek currently open for transfers.</p>}
        {summary?.status === 'no_fantasy_season' && <p>Join a fantasy season and build your squad to get transfer suggestions.</p>}
        {summary?.status === 'no_recommendations' && <p>No swaps currently meet the budget, form, price-trend, and team-limit criteria.</p>}
      </div>
    </div>
  );
}

export function TransferSuggestionsPanel({
  suggestions,
  summary,
  loading,
  error,
  actionLoading,
  isOpen,
  onToggle,
  onSelect,
}: TransferSuggestionsPanelProps) {
  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-indigo-500/25 bg-[var(--surface)] shadow-md shadow-indigo-500/5 transition-all">
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent p-5 sm:p-6">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex w-full items-center justify-between gap-4 text-left transition hover:opacity-95"
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight text-[var(--text-primary)]">Smart Transfer Suggestions</h2>
                <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">AI Assist</span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {loading
                  ? 'Analyzing recent performance, price swings, and squad limits…'
                  : error
                    ? 'Suggestions need attention'
                    : suggestions.length > 0
                      ? `${suggestions.length} role-matched recommended swap${suggestions.length === 1 ? '' : 's'} available`
                      : 'Algorithmic recommendations based on recent form and budget'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs font-semibold text-indigo-600 dark:text-indigo-400 sm:inline">
              {isOpen ? 'Collapse' : 'Expand Recommendations'}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-[var(--border)] p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-xs leading-relaxed text-[var(--text-muted)]">
              Recommended swaps are calculated from the last three completed gameweeks, price trajectory, remaining budget, and team limit constraints.
            </p>
            {suggestions.length > 0 && (
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Budget verified
              </span>
            )}
          </div>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-5">
                  <div className="mb-4 h-4 w-28 rounded bg-[var(--surface)]" />
                  <div className="mb-3 h-8 w-full rounded bg-[var(--surface)]" />
                  <div className="h-16 rounded bg-[var(--surface)]" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300">
              {error}
            </div>
          ) : suggestions.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {suggestions.map((suggestion) => (
                <SuggestedSwapCard
                  key={`${suggestion.player_out_id}-${suggestion.player_in_id}`}
                  suggestion={suggestion}
                  actionLoading={actionLoading}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ) : (
            <NoSuggestionsMessage summary={summary} />
          )}
        </div>
      )}
    </section>
  );
}
