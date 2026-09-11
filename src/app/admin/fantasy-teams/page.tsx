'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Search, Users, Trophy, Eye, Swords } from 'lucide-react';


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

export default function AdminFantasyTeamsPage() {
  const [teams, setTeams] = useState<FantasyTeam[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFantasyTeams() {
      try {
        const res = await fetch('/api/leaderboard?limit=100');
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json.leaderboard) ? json.leaderboard : [];
          setTeams(
            items.map((item: any) => ({
              id: String(item.fantasy_teams?.id || item.id),
              name: item.fantasy_teams?.name || 'Fantasy Squad',
              owner: item.fantasy_teams?.profiles?.display_name || item.fantasy_teams?.profiles?.username || 'Manager',
              totalPoints: Number(item.total_points || 0),
              globalRank: item.rank || 1,
              leagueCount: 1,
              budgetRemaining: 10.0,
              lastActive: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : 'Active',
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load fantasy teams', err);
      } finally {
        setLoading(false);
      }
    }
    loadFantasyTeams();
  }, []);

  const filtered = useMemo(() => {
    return teams.filter((t) =>
      `${t.name} ${t.owner}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [teams, query]);

  const totalPoints = teams.reduce((s, t) => s + t.totalPoints, 0);
  const avgPoints = teams.length ? Math.round(totalPoints / teams.length) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-8">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-white"><Swords className="h-8 w-8 text-amber-400" />Fantasy Teams</h1>
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
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                        team.lastActive === '2026-09-02'
                          ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
                          : 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600'
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
