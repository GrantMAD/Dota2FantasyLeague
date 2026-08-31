'use client';

import { useState } from 'react';

interface GameweekRecord {
  id: number;
  name: string;
  status: 'upcoming' | 'live' | 'locked';
  startDate: string;
  deadline: string;
}

const initialGameweeks: GameweekRecord[] = [
  { id: 1, name: 'GW1', status: 'live', startDate: '2026-01-15', deadline: '2026-01-14 18:00 UTC' },
  { id: 2, name: 'GW2', status: 'upcoming', startDate: '2026-01-22', deadline: '2026-01-21 18:00 UTC' },
  { id: 3, name: 'GW3', status: 'locked', startDate: '2026-01-29', deadline: '2026-01-28 18:00 UTC' },
];

const statusStyles: Record<GameweekRecord['status'], string> = {
  upcoming: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
  live: 'bg-green-500/10 text-green-400 border-green-500/30',
  locked: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

export default function AdminGameweeksPage() {
  const [gameweeks, setGameweeks] = useState<GameweekRecord[]>(initialGameweeks);

  const advanceStatus = (id: number) => {
    setGameweeks((current) =>
      current.map((gameweek) => {
        if (gameweek.id !== id) return gameweek;
        const nextStatus: GameweekRecord['status'] =
          gameweek.status === 'upcoming' ? 'live' : gameweek.status === 'live' ? 'locked' : 'upcoming';
        return { ...gameweek, status: nextStatus };
      })
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gameweeks</h1>
          <p className="mt-1 text-gray-400">Manage fantasy gameweek schedule and deadlines</p>
        </div>
        <button className="rounded bg-amber-500/20 px-4 py-2 font-medium text-amber-400 hover:bg-amber-500/30">
          Add Gameweek
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Live" value={gameweeks.filter((g) => g.status === 'live').length} />
        <StatCard label="Upcoming" value={gameweeks.filter((g) => g.status === 'upcoming').length} />
        <StatCard label="Locked" value={gameweeks.filter((g) => g.status === 'locked').length} />
      </div>

      <div className="space-y-3">
        {gameweeks.map((gameweek) => (
          <div key={gameweek.id} className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-white">{gameweek.name}</h3>
                  <span className={`rounded border px-2 py-1 text-xs font-medium ${statusStyles[gameweek.status]}`}>
                    {gameweek.status}
                  </span>
                </div>
                <p className="mt-2 text-gray-400">{gameweek.startDate} • Deadline: {gameweek.deadline}</p>
              </div>

              <button
                onClick={() => advanceStatus(gameweek.id)}
                className="rounded bg-amber-500/20 px-4 py-2 font-medium text-amber-400 hover:bg-amber-500/30"
              >
                Cycle Status
              </button>
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
