'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Medal } from 'lucide-react';

type LeaderboardEntry = {
   id: number;
   rank: number;
   previous_rank: number | null;
   total_points: number;
   gameweek_points: number;
   fantasy_teams?: {
      id?: string;
      name?: string;
      user_id?: string;
      profiles?: {
         username?: string;
         display_name?: string | null;
         avatar_url?: string | null;
         country?: string | null;
         bio?: string | null;
      } | null;
   } | null;
};

type SelectedManager = {
   manager: string;
   username?: string;
   displayName?: string | null;
   avatarUrl?: string | null;
   bio?: string | null;
   points: number;
   gwPoints?: number;
   rank: number | null;
   teamName?: string;
   country?: string | null;
};

export default function LeaderboardPage() {
   const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [countryFilter, setCountryFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<SelectedManager | null>(null);

  // Example countries for the filter
  const countries = [
    { code: '', name: 'Global (All)' },
    { code: 'US', name: 'United States' },
    { code: 'UK', name: 'United Kingdom' },
    { code: 'CN', name: 'China' },
    { code: 'RU', name: 'Russia' },
    { code: 'PH', name: 'Philippines' },
    { code: 'PE', name: 'Peru' }
  ];

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        let url = `/api/leaderboard?page=${page}&limit=50`;
        if (countryFilter) url += `&country=${countryFilter}`;
        
        const res = await fetch(url);
      const data = await res.json() as { leaderboard?: LeaderboardEntry[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to load leaderboard');
        setEntries(data.leaderboard || []);
         } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [page, countryFilter]);

  const renderRankChange = (current: number, previous: number | null) => {
    if (!previous || current === previous) {
       return <span className="text-slate-500 font-bold text-lg">-</span>;
    }
    const diff = previous - current;
    if (diff > 0) {
       return (
          <div className="flex flex-col items-center justify-center">
             <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"></path></svg>
             <span className="text-emerald-500 text-[10px] font-bold">{diff}</span>
          </div>
       );
    }
    return (
       <div className="flex flex-col items-center justify-center">
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
          <span className="text-red-500 text-[10px] font-bold">{Math.abs(diff)}</span>
       </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Medal className="w-8 h-8 text-amber-400 shrink-0" />
            <span>Global Leaderboard</span>
          </h1>
          <p className="text-slate-400">See how your squad ranks against the world</p>
        </div>
        
        <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-1">
           <select 
              value={countryFilter}
              onChange={(e) => { setCountryFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-slate-300 text-sm pl-3 pr-8 py-2 focus:outline-none appearance-none cursor-pointer"
           >
              {countries.map(c => (
                 <option key={c.code} value={c.code}>{c.name}</option>
              ))}
           </select>
           <div className="flex items-center px-2 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
           </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-8 text-sm">
          {error}
        </div>
      )}

      <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-150">
               <thead>
                  <tr className="bg-slate-800/80 border-b border-slate-700 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                     <th className="px-6 py-4 w-20 text-center">Rank</th>
                     <th className="px-2 py-4 w-16 text-center">Change</th>
                     <th className="px-6 py-4">Manager & Team</th>
                     <th className="px-6 py-4 text-right">GW Pts</th>
                     <th className="px-6 py-4 text-right text-amber-500">Total Pts</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-700/50">
                  {loading ? (
                     <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                           <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                           <p className="text-slate-400 mt-4">Loading rankings...</p>
                        </td>
                     </tr>
                  ) : entries.length === 0 ? (
                     <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                           No rankings found for the selected criteria.
                        </td>
                     </tr>
                  ) : (
                     entries.map((entry) => {
                        const team = entry.fantasy_teams;
                        const profile = team?.profiles;
                        const isTop3 = entry.rank <= 3;
                        const managerName = profile?.display_name || profile?.username || 'Anonymous Manager';
                        
                        return (
                           <tr
                              key={entry.id}
                              onClick={() => setSelectedUser({
                                 manager: managerName,
                                 username: profile?.username || managerName.toLowerCase().replace(/\s+/g, '_'),
                                 displayName: profile?.display_name || null,
                                 avatarUrl: profile?.avatar_url || null,
                                 bio: profile?.bio || null,
                                 points: entry.total_points || 0,
                                 gwPoints: entry.gameweek_points || 0,
                                 rank: entry.rank,
                                 teamName: team?.name || 'Unknown Team',
                                 country: profile?.country || null,
                              })}
                              className="hover:bg-slate-700/50 transition-colors group cursor-pointer"
                              title="Click to view manager profile"
                           >
                              <td className="px-6 py-4 text-center">
                                 <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                    entry.rank === 1 ? 'bg-yellow-500 text-yellow-950 shadow-[0_0_15px_rgba(234,179,8,0.5)]' :
                                    entry.rank === 2 ? 'bg-slate-300 text-slate-800 shadow-[0_0_10px_rgba(203,213,225,0.4)]' :
                                    entry.rank === 3 ? 'bg-amber-700 text-amber-100 shadow-[0_0_10px_rgba(180,83,9,0.4)]' :
                                    'text-slate-400 bg-slate-800'
                                 }`}>
                                    {entry.rank}
                                 </span>
                              </td>
                              <td className="px-2 py-4">
                                 <div className="flex justify-center">
                                    {renderRankChange(entry.rank, entry.previous_rank)}
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full bg-slate-700 overflow-hidden shrink-0 border ${isTop3 ? 'border-amber-500/50' : 'border-slate-600'}`}>
                                       {profile?.avatar_url ? (
                                          <Image src={profile.avatar_url} alt="Avatar" width={40} height={40} unoptimized className="w-full h-full object-cover" />
                                       ) : (
                                          <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                                             {team?.name?.substring(0, 1).toUpperCase() || '?'}
                                          </div>
                                       )}
                                    </div>
                                    <div>
                                       <div className="font-bold text-white group-hover:text-amber-400 transition-colors">{team?.name || 'Unknown Team'}</div>
                                       <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                          {profile?.country && (
                                             <span className="text-[10px] bg-slate-700 px-1.5 rounded">{profile.country}</span>
                                          )}
                                          {managerName}
                                       </div>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-4 text-right font-mono">
                                 <span className="text-slate-300 font-medium">{entry.gameweek_points || 0}</span>
                              </td>
                              <td className="px-6 py-4 text-right font-mono">
                                 <span className="text-lg font-bold text-amber-400">{entry.total_points || 0}</span>
                              </td>
                           </tr>
                        );
                     })
                  )}
               </tbody>
            </table>
         </div>
         
         {/* Pagination */}
         {!loading && entries.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/80 flex items-center justify-between">
               <div className="text-sm text-slate-400">
                  Showing top {(page - 1) * 50 + 1} to {(page - 1) * 50 + entries.length}
               </div>
               <div className="flex gap-2">
                  <button 
                     onClick={() => setPage(p => Math.max(1, p - 1))}
                     disabled={page === 1}
                     className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                     Previous
                  </button>
                  <button 
                     onClick={() => setPage(p => p + 1)}
                     disabled={entries.length < 50}
                     className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                  >
                     Next
                  </button>
               </div>
            </div>
         )}
      </div>

      {/* Manager Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 no-scrollbar">
            {/* Header */}
            <div className="border-b border-slate-800 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-amber-500/50 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  {selectedUser.avatarUrl ? (
                    <img src={selectedUser.avatarUrl} alt={selectedUser.manager} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-amber-400">
                      {(selectedUser.displayName || selectedUser.username || selectedUser.manager).substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white">{selectedUser.manager}</h2>
                    {selectedUser.rank && (
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/40">
                        Rank #{selectedUser.rank}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    @{selectedUser.username || selectedUser.manager.toLowerCase().replace(/\s+/g, '_')}
                    {selectedUser.teamName && (
                      <span className="text-slate-500 ml-1.5">• {selectedUser.teamName}</span>
                    )}
                  </p>
                </div>
              </div>

              {selectedUser.bio && (
                <p className="mt-4 text-sm text-slate-300 bg-slate-950/40 border border-slate-800/80 rounded-lg p-3 italic">
                  "{selectedUser.bio}"
                </p>
              )}
            </div>

            {/* Performance Stats Grid */}
            <div className="my-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Global Standing & Performance</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Total Points</div>
                  <div className="text-2xl font-mono font-bold text-amber-400 mt-1">{selectedUser.points} <span className="text-sm font-sans text-amber-300">pts</span></div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Gameweek</div>
                  <div className="text-2xl font-mono font-bold text-slate-200 mt-1">{selectedUser.gwPoints ?? 0} <span className="text-sm font-sans text-slate-400">pts</span></div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Global Rank</div>
                  <div className="text-2xl font-mono font-bold text-white mt-1">#{selectedUser.rank ?? '-'}</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
