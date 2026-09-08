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
    <div className="space-y-4 mb-8">
      {/* Status Segmented Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl overflow-x-auto w-full sm:w-auto">
          {statusTabs.map((tab) => {
            const isActive = activeStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onStatusChange(tab.id)}
                className={`tournament-status-tab flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tier filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {tiers.map((t) => {
            const isSelected = selectedTier === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTierChange(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                  isSelected
                    ? 'bg-slate-800 text-amber-400 border-amber-500/50'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <svg
          className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search tournaments (e.g. Riyadh Masters, The International, ESL)..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
