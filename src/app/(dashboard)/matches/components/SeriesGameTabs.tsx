'use client';

interface SeriesGameTab {
  id: number;
  status: string;
  scheduled_at: string;
  match_number?: number;
}

interface SeriesGameTabsProps {
  games: SeriesGameTab[];
  activeMatchId: number;
  onSelect: (matchId: number) => void;
}

export function SeriesGameTabs({ games, activeMatchId, onSelect }: SeriesGameTabsProps) {
  if (games.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Games in this series"
      className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800/70 px-4 py-2"
    >
      {games.map((game, index) => {
        const isActive = game.id === activeMatchId;
        const number = game.match_number ?? index + 1;
        const status = game.status === 'live' || game.status === 'in_progress'
          ? 'Live'
          : game.status === 'completed' ? 'Final' : 'Scheduled';
        const scheduledAt = new Date(game.scheduled_at);
        const timeLabel = scheduledAt.toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        return (
          <button
            key={game.id}
            id={`series-game-tab-${game.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`series-game-panel-${game.id}`}
            aria-label={`Game ${number}, ${game.scheduled_at}, ${status}`}
            onClick={() => onSelect(game.id)}
            className={`flex shrink-0 flex-col items-start rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              isActive
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            <span>Game {number} · {status}</span>
            <time suppressHydrationWarning dateTime={game.scheduled_at} className="text-[10px] font-normal text-[var(--text-muted)]">
              {timeLabel}
            </time>
          </button>
        );
      })}
    </div>
  );
}
