'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ProfessionalTeam {
  name: string;
  logo_url: string | null;
}

interface Player {
  id: number;
  name: string;
  in_game_name: string | null;
  primary_role: string;
  current_price: number;
  professional_teams?: ProfessionalTeam;
  availability_status: string;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Use a debounced search term to avoid spamming the API
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        sort: 'price',
        desc: 'true',
      });
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (roleFilter) params.append('role', roleFilter);

      const res = await fetch(`/api/players?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPlayers(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch players', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, roleFilter]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const totalPages = Math.ceil(total / limit);

  // Formatting helper
  const formatPrice = (price: number) => {
    return `$${(price / 1000000).toFixed(1)}M`;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Carry': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'Mid': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'Offlane': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'Support': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'Hard Support': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Professional Players</h1>
      <p className="text-slate-400 mb-8">Browse and scout all professional Dota 2 players to build your squad.</p>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        
        {/* Filters and Search */}
        <div className="p-6 border-b border-slate-700 bg-slate-800/80 flex flex-col md:flex-row gap-4">
          <div className="grow">
            <input
              type="text"
              placeholder="Search players by name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div className="w-full md:w-64 shrink-0">
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors appearance-none"
            >
              <option value="">All Roles</option>
              <option value="Carry">Carry</option>
              <option value="Mid">Mid</option>
              <option value="Offlane">Offlane</option>
              <option value="Support">Support</option>
              <option value="Hard Support">Hard Support</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-700 text-slate-400 text-sm">
                <th className="px-6 py-4 font-medium whitespace-nowrap">Player</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Team</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Role</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap text-right">Price</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap text-center">Status</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading && players.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
                  </td>
                </tr>
              ) : players.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No players found matching your filters.
                  </td>
                </tr>
              ) : (
                players.map((player) => (
                  <tr key={player.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/players/${player.id}`} className="flex flex-col group">
                        <span className="text-white font-medium group-hover:text-amber-500 transition-colors">
                          {player.in_game_name || player.name}
                        </span>
                        {player.in_game_name && player.name !== player.in_game_name && (
                          <span className="text-xs text-slate-500">{player.name}</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-slate-300">
                        {player.professional_teams?.logo_url ? (
                          <img src={player.professional_teams.logo_url} alt="team" className="w-5 h-5 mr-2 object-contain rounded-sm" />
                        ) : (
                          <div className="w-5 h-5 mr-2 bg-slate-700 rounded-sm"></div>
                        )}
                        {player.professional_teams?.name || 'Unknown Team'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getRoleColor(player.primary_role)}`}>
                        {player.primary_role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-white">
                      {formatPrice(player.current_price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${player.availability_status === 'available' ? 'bg-green-500' : 'bg-red-500'}`} title={player.availability_status}></span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link 
                        href={`/players/${player.id}`}
                        className="text-xs px-3 py-1.5 border border-slate-600 rounded text-slate-300 hover:bg-slate-700 transition-colors"
                      >
                        Profile
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/80 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} players
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-slate-600 rounded bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-slate-600 rounded bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
