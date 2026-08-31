'use client';

import { useState } from 'react';

interface SeasonRecord {
  id: number;
  name: string;
  status: 'draft' | 'live' | 'complete';
  startDate: string;
  endDate: string;
  prizePool: string;
}

const initialSeasons: SeasonRecord[] = [
  { id: 1, name: 'Season 1', status: 'live', startDate: '2026-01-10', endDate: '2026-03-16', prizePool: '$15,000' },
  { id: 2, name: 'Season 2', status: 'draft', startDate: '2026-04-01', endDate: '2026-06-20', prizePool: '$20,000' },
  { id: 3, name: 'Season 0', status: 'complete', startDate: '2025-11-01', endDate: '2025-12-30', prizePool: '$12,000' },
];

const statusStyles: Record<SeasonRecord['status'], string> = {
  draft: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
  live: 'bg-green-500/10 text-green-400 border-green-500/30',
  complete: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

export default function AdminSeasonsPage() {
  const [seasons, setSeasons] = useState<SeasonRecord[]>(initialSeasons);

  const toggleStatus = (id: number) => {
    setSeasons((current) =>
      current.map((season) => {
        if (season.id !== id) return season;
        const nextStatus: SeasonRecord['status'] =
          season.status === 'draft' ? 'live' : season.status === 'live' ? 'complete' : 'draft';
        return { ...season, status: nextStatus };
      })
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Seasons Management</h1>
          <p className="mt-1 text-gray-400">Create and manage fantasy season lifecycle</p>
        </div>
        <button className="rounded bg-amber-500/20 px-4 py-2 font-medium text-amber-400 hover:bg-amber-500/30">
          New Season
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Active" value={seasons.filter((season) => season.status === 'live').length} />
        <StatCard label="Draft" value={seasons.filter((season) => season.status === 'draft').length} />
        <StatCard label="Total Prize" value="$47,000" />
      </div>

      <div className="space-y-3">
        {seasons.map((season) => (
          <div key={season.id} className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-white">{season.name}</h3>
                  <span className={`rounded border px-2 py-1 text-xs font-medium ${statusStyles[season.status]}`}>
                    {season.status}
                  </span>
                </div>
                <p className="mt-2 text-gray-400">
                  {season.startDate} → {season.endDate}
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Prize Pool</p>
                  <p className="text-lg font-bold text-white">{season.prizePool}</p>
                </div>
                <button
                  onClick={() => toggleStatus(season.id)}
                  className="rounded bg-amber-500/20 px-4 py-2 font-medium text-amber-400 hover:bg-amber-500/30"
                >
                  Update Status
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
