'use client';

interface TournamentFiltersProps {
  activeStatus: 'all' | 'eligible' | 'archived';
  onStatusChange: (status: 'all' | 'eligible' | 'archived') => void;
  selectedTier: string;
  onTierChange: (tier: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  counts: {
    all: number;
    eligible: number;
    archived: number;
  };
}

export function TournamentFilters({
  activeStatus,
  onStatusChange,
  selectedTier,
  onTierChange,
  searchQuery,
  onSearchChange,
  counts,
}: TournamentFiltersProps) {
  const statusTabs = [
    { id: 'all', label: 'All Tournaments', count: counts.all },
    { id: 'eligible', label: 'Active / Eligible', count: counts.eligible },
    { id: 'archived', label: 'Archived', count: counts.archived },
  ] as const;

  const tiers = [
    { id: '', label: 'All Tiers' },
    { id: 'Tier 1', label: 'Tier 1 / Majors' },
    { id: 'Tier 2', label: 'Tier 2 / Minors' },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
      <div className="flex flex-col items-start justify-between gap-4 xl:flex-row xl:items-center">
        <div role="group" aria-label="Filter tournaments by status" className="flex w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-1 xl:w-auto">
          {statusTabs.map((tab) => {
            const isActive = activeStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onStatusChange(tab.id)}
                className={`tournament-status-tab flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-[var(--text-primary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-[var(--surface)] text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div role="group" aria-label="Filter tournaments by tier" className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
          {tiers.map((t) => {
            const isSelected = selectedTier === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onTierChange(t.id)}
                className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                    : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-primary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-3">
        <svg
          className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          aria-label="Search tournaments"
          placeholder="Search tournaments (e.g. Riyadh Masters, The International, ESL)..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] py-2.5 pl-10 pr-10 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-amber-500 focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            aria-label="Clear tournament search"
            onClick={() => onSearchChange('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
