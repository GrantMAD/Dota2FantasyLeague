'use client';

import { Users, Filter, LayoutGrid, List } from 'lucide-react';

export type SquadTab = 'all' | 'starters' | 'bench';
export type SquadViewMode = 'pitch' | 'compact';

interface SquadFiltersProps {
  activeTab: SquadTab;
  onTabChange: (tab: SquadTab) => void;
  viewMode: SquadViewMode;
  onViewModeChange: (mode: SquadViewMode) => void;
  selectedRole: string;
  onRoleChange: (role: string) => void;
  counts: {
    all: number;
    starters: number;
    bench: number;
  };
}

const roles = [
  { key: 'ALL', label: 'All Roles' },
  { key: 'Carry', label: 'Carry' },
  { key: 'Mid', label: 'Mid' },
  { key: 'Offlane', label: 'Offlane' },
  { key: 'Support', label: 'Support' },
  { key: 'Hard Support', label: 'Hard Support' },
];

export function SquadFilters({
  activeTab,
  onTabChange,
  viewMode,
  onViewModeChange,
  selectedRole,
  onRoleChange,
  counts,
}: SquadFiltersProps) {
  const tabs: Array<{ key: SquadTab; label: string; count: number }> = [
    { key: 'all', label: 'All Squad', count: counts.all },
    { key: 'starters', label: 'Starting 5', count: counts.starters },
    { key: 'bench', label: 'Bench', count: counts.bench },
  ];

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/70 p-3 md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-900/70">
      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={[
              'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition',
              activeTab === tab.key
                ? 'border-teal-500/50 bg-teal-500/15 text-teal-300 shadow-sm'
                : 'border-slate-700/60 bg-slate-950/40 text-slate-300 hover:border-slate-500 hover:text-white',
            ].join(' ')}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                activeTab === tab.key
                  ? 'bg-teal-500/25 text-teal-200'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Role filter & View toggles */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Role select */}
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-950/50 px-2.5 py-1 text-xs text-slate-300">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={selectedRole}
            onChange={(e) => onRoleChange(e.target.value)}
            className="bg-transparent py-1 text-xs text-slate-200 focus:outline-none cursor-pointer"
            aria-label="Filter squad by role"
          >
            {roles.map((r) => (
              <option key={r.key} value={r.key} className="bg-slate-900 text-slate-200">
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* View mode toggle */}
        <div className="inline-flex rounded-xl border border-slate-700/60 bg-slate-950/60 p-1">
          <button
            type="button"
            onClick={() => onViewModeChange('pitch')}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer',
              viewMode === 'pitch'
                ? 'bg-teal-500 font-semibold text-slate-950'
                : 'text-slate-300 hover:text-white',
            ].join(' ')}
            title="Pitch / Detailed Board View"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Detailed
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('compact')}
            className={[
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer',
              viewMode === 'compact'
                ? 'bg-teal-500 font-semibold text-slate-950'
                : 'text-slate-300 hover:text-white',
            ].join(' ')}
            title="Compact Table / List View"
          >
            <List className="h-3.5 w-3.5" />
            Compact
          </button>
        </div>
      </div>
    </div>
  );
}
