export type LeagueTab = 'classic' | 'h2h';

interface LeagueFiltersProps {
  activeTab: LeagueTab;
  onTabChange: (tab: LeagueTab) => void;
  classicCount: number;
  h2hCount: number;
}

export function LeagueFilters({ activeTab, onTabChange, classicCount, h2hCount }: LeagueFiltersProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="flex gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-1">
        {([
          { key: 'classic', label: 'Classic Leagues', count: classicCount },
          { key: 'h2h', label: 'Head-to-Head', count: h2hCount },
        ] as const).map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              activeTab === key ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-800 text-slate-400'
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
