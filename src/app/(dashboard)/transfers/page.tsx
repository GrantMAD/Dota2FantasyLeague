'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TransfersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  useEffect(() => {
    async function fetchPlayers() {
      try {
        const res = await fetch('/api/players?limit=100');
        const data = await res.json();
        setPlayers(data.players || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load players');
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, []);

  const filteredPlayers = players.filter((p) => {
    if (search && !p.in_game_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && p.primary_role !== roleFilter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Transfer Market</h1>
          <p className="text-slate-400">Buy and sell players to optimize your squad</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 flex items-center gap-4">
           <div className="text-center">
              <div className="text-xs text-slate-400 uppercase">Bank</div>
              <div className="text-lg font-mono font-bold text-emerald-400">$2.4M</div>
           </div>
           <div className="w-px h-8 bg-slate-700"></div>
           <div className="text-center">
              <div className="text-xs text-slate-400 uppercase">Free Transfers</div>
              <div className="text-lg font-bold text-white">1</div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-4">Search & Filters</h3>
              
              <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Search Player</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Yatoro"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                 </div>
                 
                 <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                    <select 
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                       <option value="">All Roles</option>
                       <option value="carry">Carry</option>
                       <option value="mid">Mid</option>
                       <option value="offlane">Offlane</option>
                       <option value="support">Support</option>
                       <option value="hard_support">Hard Support</option>
                    </select>
                 </div>
              </div>
           </div>
           
           <div className="wildcard-card bg-amber-900/20 border border-amber-700/50 rounded-xl p-5">
              <h3 className="wildcard-card-title font-semibold text-amber-500 mb-2 text-sm">Wildcard Available</h3>
              <p className="wildcard-card-description text-xs text-amber-200/70 mb-3">You have 1 wildcard remaining. Play it to make unlimited transfers this week with no point deductions.</p>
              <button className="wildcard-card-action w-full bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/50 text-amber-500 text-xs font-bold py-2 rounded-lg transition-colors">
                 Play Wildcard
              </button>
           </div>
        </div>

        {/* Players List */}
        <div className="lg:col-span-3">
          {error && (
            <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-slate-800/80 border-b border-slate-700">
                         <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Player</th>
                         <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Role</th>
                         <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Price</th>
                         <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Form</th>
                         <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">GW Pts</th>
                         <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Action</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-700/50">
                      {loading ? (
                         <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading players...</td>
                         </tr>
                      ) : filteredPlayers.length === 0 ? (
                         <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No players found matching your criteria.</td>
                         </tr>
                      ) : (
                         filteredPlayers.map((player) => (
                            <tr key={player.id} className="hover:bg-slate-700/30 transition-colors group">
                               <td className="px-4 py-3">
                                  <Link href={`/players/${player.id}`} className="flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 overflow-hidden shrink-0">
                                        {player.profile_image_url ? (
                                           <img src={player.profile_image_url} alt={player.in_game_name} className="w-full h-full object-cover" />
                                        ) : (
                                           <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                                              {player.in_game_name?.substring(0,2).toUpperCase()}
                                           </div>
                                        )}
                                     </div>
                                     <div>
                                        <div className="font-bold text-white group-hover:text-amber-400 transition-colors">{player.in_game_name}</div>
                                        <div className="text-xs text-slate-400">{player.professional_teams?.name || 'Free Agent'}</div>
                                     </div>
                                  </Link>
                               </td>
                               <td className="px-4 py-3 text-center">
                                  <span className="inline-block bg-slate-700 text-slate-300 text-[10px] uppercase font-bold px-2 py-1 rounded-sm">
                                     {player.primary_role}
                                  </span>
                               </td>
                               <td className="px-4 py-3 text-right">
                                  <div className="font-mono font-bold text-amber-400">${player.current_price}M</div>
                               </td>
                               <td className="px-4 py-3 text-right">
                                  <div className="text-sm text-white">6.2</div>
                               </td>
                               <td className="px-4 py-3 text-right">
                                  <div className="text-sm font-bold text-white">48</div>
                               </td>
                               <td className="px-4 py-3 text-center">
                                  <button className="bg-slate-700 hover:bg-emerald-600 text-white p-1.5 rounded-md transition-colors" title="Add to Squad">
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                  </button>
                               </td>
                            </tr>
                         ))
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
