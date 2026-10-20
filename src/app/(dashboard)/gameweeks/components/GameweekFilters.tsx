import { CalendarRange, ListFilter } from 'lucide-react';

export type GameweekTab = 'all' | 'planning' | 'past';

interface GameweekFiltersProps {
  activeTab: GameweekTab;
  onTabChange: (tab: GameweekTab) => void;
  viewMode: 'compact' | 'detailed';
  onViewModeChange: (mode: 'compact' | 'detailed') => void;
}

export function GameweekFilters({ activeTab, onTabChange, viewMode, onViewModeChange }: GameweekFiltersProps) {
  const tabs: Array<{ key: GameweekTab; label: string }> = [
    { key: 'all', label: 'All Gameweeks' },
    { key: 'planning', label: 'Active & Upcoming' },
    { key: 'past', label: 'Past Results' },
  ];

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={[
              'rounded-xl border px-3 py-2 text-sm font-medium transition',
              activeTab === tab.key
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1.5 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
          <CalendarRange className="h-3.5 w-3.5" />
          Season View
        </div>
        <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-1">
          <button
            type="button"
            onClick={() => onViewModeChange('detailed')}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-medium transition',
              viewMode === 'detailed' ? 'bg-amber-500 text-slate-950' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            ].join(' ')}
          >
            Detailed
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('compact')}
            className={[
              'gameweeks-compact-toggle rounded-lg px-3 py-1.5 text-xs font-medium transition',
              viewMode === 'compact' ? 'bg-amber-500 text-slate-950' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            ].join(' ')}
          >
            Compact
          </button>
        </div>
        <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1.5 text-xs text-[var(--text-secondary)]">
          <ListFilter className="h-3.5 w-3.5" />
          Filters
        </div>
      </div>
    </div>
  );
}
