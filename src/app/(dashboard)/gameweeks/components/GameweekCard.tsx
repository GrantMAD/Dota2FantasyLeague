import Link from 'next/link';
import { Activity, ChevronDown, Flame, Trophy, Zap } from 'lucide-react';
import type { GameweekRow } from '../page';
import { formatGameweekDate, formatGameweekDeadline } from '../gameweeks-utils';

interface GameweekCardProps {
  gameweek: GameweekRow;
  compact?: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onHistoryClick?: (gameweek: GameweekRow) => void;
}

export function GameweekCard({ gameweek, compact = false, expanded, onExpandedChange, onHistoryClick }: GameweekCardProps) {
  const statusLabel =
    gameweek.status === 'active'
      ? 'Active'
      : gameweek.status === 'upcoming'
        ? 'Upcoming'
        : gameweek.status === 'locked'
          ? 'Locked'
          : 'Closed';

  const borderTone =
    gameweek.status === 'active'
      ? 'border-amber-500/40 bg-[var(--surface)]'
      : gameweek.status === 'upcoming'
        ? 'border-sky-500/30 bg-[var(--surface)]'
        : 'border-[var(--border)] bg-[var(--surface)]';

  const doubleTeams = gameweek.flags.filter((flag) => flag.flag === 'double');
  const blankTeams = gameweek.flags.filter((flag) => flag.flag === 'blank');

  return (
    <div className={`overflow-hidden rounded-2xl border shadow-lg shadow-slate-950/10 transition ${borderTone}`}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`gameweek-content-${gameweek.id}`}
        onClick={() => onExpandedChange(!expanded)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[var(--surface-raised)] sm:p-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
            <span className={`h-2 w-2 rounded-full ${gameweek.status === 'active' ? 'bg-amber-400' : gameweek.status === 'upcoming' ? 'bg-sky-400' : 'bg-slate-400'}`} />
            GW {gameweek.gameweek_number}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-bold text-[var(--text-primary)]">{statusLabel}</span>
            <span className="block truncate text-xs text-[var(--text-secondary)]">
              {formatGameweekDate(gameweek.start_date)} – {formatGameweekDate(gameweek.end_date)}
            </span>
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-3">
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)] sm:px-2.5 sm:text-xs">
            {gameweek.match_count} matches
          </span>
          <ChevronDown aria-hidden="true" className={`h-5 w-5 text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <div id={`gameweek-content-${gameweek.id}`} hidden={!expanded} className="border-t border-[var(--border)] p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Activity className="h-4 w-4 text-[var(--text-muted)]" />
            <span>Deadline {formatGameweekDeadline(gameweek.deadline)}</span>
          </div>

          {(doubleTeams.length > 0 || blankTeams.length > 0) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {doubleTeams.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
                  <Zap className="h-3.5 w-3.5" />
                  Double GW
                </span>
              )}
              {blankTeams.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-800 dark:text-orange-300">
                  <Flame className="h-3.5 w-3.5" />
                  Blank GW
                </span>
              )}
            </div>
          )}

          {gameweek.tournaments.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
              {gameweek.tournaments.slice(0, 2).map((tournament, idx) => (
                <span key={`${gameweek.id}-t-${tournament.id}-${idx}`} className="gameweeks-tournament-chip rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1">
                  {tournament.name}
                </span>
              ))}
            </div>
          )}

      {gameweek.status === 'closed' || gameweek.status === 'locked' ? (
        <div className="space-y-3 border-t border-[var(--border)] pt-4">
          {(gameweek.user_score !== null || gameweek.global_average != null) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {gameweek.user_score !== null && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm">
                  <div className="text-xs text-[var(--text-muted)]">Your score</div>
                  <div className="gameweeks-closed-score-value mt-1 font-bold text-emerald-700 dark:text-emerald-300">{gameweek.user_score.toFixed(1)} pts</div>
                </div>
              )}
              {gameweek.global_average != null && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm">
                  <div className="text-xs text-[var(--text-muted)]">Global average</div>
                  <div className="mt-1 font-bold text-[var(--text-primary)]">{gameweek.global_average.toFixed(1)} pts</div>
                  {gameweek.user_score !== null && (
                    <div className={`mt-0.5 text-xs ${
                      gameweek.user_score >= gameweek.global_average
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                    }`}>
                      {gameweek.user_score >= gameweek.global_average ? '+' : ''}{(gameweek.user_score - gameweek.global_average).toFixed(1)} vs average
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {gameweek.top_scorer && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                Top Scorer
              </span>
              <span className="text-right text-[var(--text-primary)]">{gameweek.top_scorer.in_game_name || gameweek.top_scorer.name} ({gameweek.top_scorer.total_points.toFixed(1)} pts)</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 border-t border-[var(--border)] pt-4 text-sm text-[var(--text-secondary)]">
          <div className="flex items-center justify-between">
            <span>Fixture focus</span>
            <span>{gameweek.match_count} matches</span>
          </div>
          {gameweek.flags.length > 0 && (
            <div className="flex items-center justify-between">
              <span>Planning notes</span>
              <span>{doubleTeams.length > 0 ? 'DGW' : blankTeams.length > 0 ? 'BGW' : 'Standard'}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
        <div className="flex items-center gap-3">
          {gameweek.status === 'active' ? (
            <Link href="/lineups" className="text-sm font-medium text-amber-700 hover:text-amber-600 dark:text-amber-300 dark:hover:text-amber-200">
              Manage Lineup →
            </Link>
          ) : gameweek.status === 'upcoming' ? (
            <Link href="/transfers" className="text-sm font-medium text-sky-700 hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200">
              Review Transfers →
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onHistoryClick?.(gameweek)}
                className="gameweeks-closed-results text-sm font-medium text-amber-700 hover:text-amber-600 dark:text-amber-300 dark:hover:text-amber-200"
              >
                Your History →
              </button>
              <Link href={`/gameweeks/${gameweek.id}`} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                Match Results
              </Link>
            </>
          )}

          {(gameweek.status === 'active' || gameweek.status === 'upcoming') && (
            <Link href={`/gameweeks/${gameweek.id}`} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              Details
            </Link>
          )}
        </div>

        <span className={`${gameweek.status === 'closed' || gameweek.status === 'locked' ? 'gameweeks-closed-card-label' : ''} text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]`}>
          {compact ? 'Quick view' : 'Full card'}
        </span>
      </div>
      </div>
    </div>
  );
}
