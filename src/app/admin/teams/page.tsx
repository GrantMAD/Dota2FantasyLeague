'use client';

import { useMemo, useState } from 'react';

interface TeamRecord {
  id: number;
  name: string;
  region: string;
  roster: number;
  status: 'active' | 'inactive' | 'pending';
  rating: number;
}

const initialTeams: TeamRecord[] = [
  { id: 1, name: 'Tundra', region: 'Europe', roster: 5, status: 'active', rating: 92 },
  { id: 2, name: 'Gaimin Gladiators', region: 'North America', roster: 5, status: 'active', rating: 90 },
  { id: 3, name: 'Team Liquid', region: 'Europe', roster: 5, status: 'pending', rating: 86 },
  { id: 4, name: 'Shopify Rebellion', region: 'North America', roster: 4, status: 'inactive', rating: 78 },
];

const statusStyles: Record<TeamRecord['status'], string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/30',
  inactive: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
};

export default function AdminTeamsPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | TeamRecord['status']>('all');
  const [teams] = useState<TeamRecord[]>(initialTeams);

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const matchesQuery = `${team.name} ${team.region}`.toLowerCase().includes(query.toLowerCase());
      const matchesFilter = filter === 'all' || team.status === filter;
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, teams]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Teams Management</h1>
        <p className="mt-1 text-gray-400">Track and manage professional team data</p>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 rounded border border-gray-700 bg-gray-900/40 px-4 py-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search teams or regions..."
              className="w-full bg-transparent text-white placeholder-gray-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'active', 'pending', 'inactive'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`rounded px-3 py-2 text-sm font-medium ${
                  filter === option ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700/50 text-gray-300'
                }`}
              >
                {option === 'all' ? 'All' : option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Teams" value={teams.length} />
        <StatCard label="Active" value={teams.filter((team) => team.status === 'active').length} />
        <StatCard label="Avg Rating" value={`${(teams.reduce((sum, team) => sum + team.rating, 0) / teams.length).toFixed(1)}`} />
      </div>

      <div className="space-y-3">
        {filteredTeams.map((team) => (
          <div key={team.id} className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-white">{team.name}</h3>
                  <span className={`rounded border px-2 py-1 text-xs font-medium ${statusStyles[team.status]}`}>
                    {team.status}
                  </span>
                </div>
                <p className="mt-2 text-gray-400">{team.region} • {team.roster} rostered players</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Rating</p>
                  <p className="text-lg font-bold text-white">{team.rating}</p>
                </div>
                <button className="rounded bg-amber-500/20 px-4 py-2 font-medium text-amber-400 hover:bg-amber-500/30">
                  Manage
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
