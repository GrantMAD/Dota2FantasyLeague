'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, Users, Trophy, Eye } from 'lucide-react';

interface FantasyTeam {
  id: string;
  name: string;
  owner: string;
  totalPoints: number;
  globalRank: number;
  leagueCount: number;
  budgetRemaining: number;
  lastActive: string;
}

const mockTeams: FantasyTeam[] = [
  { id: '1', name: 'OG Fanboys', owner: 'grantmad', totalPoints: 1842, globalRank: 14, leagueCount: 3, budgetRemaining: 12.4, lastActive: '2026-09-01' },
  { id: '2', name: 'Secret Believers', owner: 'dotafan99', totalPoints: 1710, globalRank: 28, leagueCount: 2, budgetRemaining: 8.1, lastActive: '2026-09-01' },
  { id: '3', name: 'TI Hopefuls', owner: 'esportsking', totalPoints: 1654, globalRank: 41, leagueCount: 4, budgetRemaining: 3.2, lastActive: '2026-08-30' },
  { id: '4', name: 'Midlaner FC', owner: 'midgang', totalPoints: 1590, globalRank: 67, leagueCount: 1, budgetRemaining: 15.7, lastActive: '2026-09-02' },
  { id: '5', name: 'Support Lives Matter', owner: 'ward_placer', totalPoints: 1521, globalRank: 102, leagueCount: 2, budgetRemaining: 6.9, lastActive: '2026-08-28' },
];

export default function AdminFantasyTeamsPage() {
  const [teams, setTeams] = useState<FantasyTeam[]>(mockTeams);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const filtered = teams.filter((t) =>
    `${t.name} ${t.owner}`.toLowerCase().includes(query.toLowerCase())
  );

  const totalPoints = teams.reduce((s, t) => s + t.totalPoints, 0);
  const avgPoints = teams.length ? Math.round(totalPoints / teams.length) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Fantasy Teams</h1>
        <p className="mt-1 text-slate-400">View and manage all user fantasy teams across the active season.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Teams</p>
          <p className="text-3xl font-bold text-white">{teams.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Avg. Points</p>
          <p className="text-3xl font-bold text-amber-400">{avgPoints.toLocaleString()}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Active Today</p>
          <p className="text-3xl font-bold text-green-400">
            {teams.filter(t => t.lastActive === '2026-09-02').length}
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Season Pts</p>
          <p className="text-3xl font-bold text-white">{totalPoints.toLocaleString()}</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by team name or owner..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <span className="text-sm text-slate-400">{filtered.length} teams</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-700 text-slate-400 text-sm">
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium text-right">Points</th>
                <th className="px-4 py-3 font-medium text-right">Global Rank</th>
                <th className="px-4 py-3 font-medium text-right">Leagues</th>
                <th className="px-4 py-3 font-medium text-right">Budget Left</th>
                <th className="px-4 py-3 font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    No fantasy teams found.
                  </td>
                </tr>
              ) : (
                filtered.map((team) => (
                  <tr key={team.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                          <Trophy className="w-4 h-4 text-amber-400" />
                        </div>
                        <span className="font-medium text-white text-sm">{team.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                          <Users className="w-3 h-3 text-slate-400" />
                        </div>
                        <span className="text-slate-300 text-sm">{team.owner}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-amber-400 text-sm">
                      {team.totalPoints.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 text-sm">
                      #{team.globalRank}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 text-sm">
                      {team.leagueCount}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 text-sm">
                      ${team.budgetRemaining}M
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded border ${
                        team.lastActive === '2026-09-02'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-slate-700/50 text-slate-400 border-slate-600'
                      }`}>
                        {team.lastActive}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
