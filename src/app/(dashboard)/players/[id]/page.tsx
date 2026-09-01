'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function PlayerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlayer() {
      try {
        const res = await fetch(`/api/players/${id}`);
        if (!res.ok) throw new Error('Player not found');
        const data = await res.json();
        setPlayer(data.player);
      } catch (err: any) {
        setError(err.message || 'Failed to load player details');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchPlayer();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <div className="animate-pulse bg-slate-800/50 rounded-2xl h-64 border border-slate-700 mb-8"></div>
        <div className="animate-pulse bg-slate-800/50 rounded-xl h-96 border border-slate-700"></div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
         <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-6 rounded-lg text-center">
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p>{error || 'Player not found'}</p>
            <Link href="/transfers" className="inline-block mt-4 text-amber-500 hover:underline">
               Return to Transfer Market
            </Link>
         </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back nav */}
      <Link href="/transfers" className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-6 transition-colors">
         <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
         Back to Transfers
      </Link>

      {/* Hero Banner */}
      <div className="bg-linear-to-r from-slate-900 to-slate-800 border border-slate-700 rounded-2xl overflow-hidden mb-8 shadow-xl">
         <div className="h-32 bg-linear-to-r from-amber-600/20 to-orange-900/20 border-b border-slate-700/50 relative">
            {/* Abstract pattern background */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
         </div>
         
         <div className="px-8 pb-8 relative">
            <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-16">
               <div className="w-32 h-32 rounded-xl bg-slate-800 border-4 border-slate-900 shadow-lg overflow-hidden flex items-center justify-center shrink-0 z-10">
                  {player.profile_image_url ? (
                     <img src={player.profile_image_url} alt={player.in_game_name} className="w-full h-full object-cover" />
                  ) : (
                     <span className="text-4xl text-slate-500 font-bold">{player.in_game_name?.substring(0, 2).toUpperCase()}</span>
                  )}
               </div>
               
               <div className="flex-1 pb-2">
                  <div className="flex items-center gap-3 mb-1">
                     <h1 className="text-4xl font-bold text-white">{player.in_game_name}</h1>
                     {player.availability_status === 'active' ? (
                        <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full border border-emerald-500/30">Active</span>
                     ) : (
                        <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-500/30">{player.availability_status || 'Unavailable'}</span>
                     )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                     <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        {player.real_name || 'Name Unknown'}
                     </span>
                     <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                        {player.professional_teams?.name || 'Free Agent'}
                     </span>
                     <span className="bg-slate-700 px-2 py-0.5 rounded text-xs uppercase font-bold text-slate-300">
                        {player.primary_role}
                     </span>
                  </div>
               </div>
               
               <div className="flex flex-col gap-3 pb-2 md:text-right">
                  <div>
                     <div className="text-sm text-slate-400 uppercase tracking-wider mb-1">Current Price</div>
                     <div className="text-3xl font-mono font-bold text-amber-400">${player.current_price}M</div>
                  </div>
                  <button className="bg-slate-700 hover:bg-emerald-600 border border-slate-600 hover:border-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-all shadow-lg flex items-center justify-center gap-2">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                     Add to Squad
                  </button>
               </div>
            </div>
         </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
         <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 text-center">
            <div className="text-xs text-slate-400 uppercase mb-1">Season Pts</div>
            <div className="text-2xl font-bold text-white">432</div>
         </div>
         <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 text-center">
            <div className="text-xs text-slate-400 uppercase mb-1">Last GW Pts</div>
            <div className="text-2xl font-bold text-white">48</div>
         </div>
         <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 text-center">
            <div className="text-xs text-slate-400 uppercase mb-1">Selected By</div>
            <div className="text-2xl font-bold text-white">21.4%</div>
         </div>
         <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 text-center">
            <div className="text-xs text-slate-400 uppercase mb-1">Net Transfers</div>
            <div className="text-2xl font-bold text-emerald-400 flex items-center justify-center gap-1">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
               12,450
            </div>
         </div>
      </div>

      {/* Match History */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
         <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/80">
            <h3 className="font-semibold text-white">Recent Match History</h3>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-800/40 border-b border-slate-700">
                     <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase">GW</th>
                     <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase">Opponent</th>
                     <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase text-center">Result</th>
                     <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase text-right">Mins</th>
                     <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase text-right">K/D/A</th>
                     <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase text-right">Pts</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-700/50">
                  <tr className="hover:bg-slate-700/20 transition-colors">
                     <td className="px-6 py-4 text-sm text-white">GW 4</td>
                     <td className="px-6 py-4 text-sm text-slate-300">vs Team Falcons</td>
                     <td className="px-6 py-4 text-center">
                        <span className="inline-block w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold leading-6 border border-emerald-500/30">W</span>
                     </td>
                     <td className="px-6 py-4 text-sm text-slate-400 text-right">42:15</td>
                     <td className="px-6 py-4 text-sm text-slate-300 text-right font-mono">12/2/14</td>
                     <td className="px-6 py-4 text-sm font-bold text-amber-400 text-right">24.5</td>
                  </tr>
                  <tr className="hover:bg-slate-700/20 transition-colors">
                     <td className="px-6 py-4 text-sm text-white">GW 4</td>
                     <td className="px-6 py-4 text-sm text-slate-300">vs Gaimin Gladiators</td>
                     <td className="px-6 py-4 text-center">
                        <span className="inline-block w-6 h-6 rounded bg-red-500/20 text-red-400 text-xs font-bold leading-6 border border-red-500/30">L</span>
                     </td>
                     <td className="px-6 py-4 text-sm text-slate-400 text-right">38:40</td>
                     <td className="px-6 py-4 text-sm text-slate-300 text-right font-mono">4/5/8</td>
                     <td className="px-6 py-4 text-sm font-bold text-amber-400 text-right">12.2</td>
                  </tr>
                  <tr className="hover:bg-slate-700/20 transition-colors">
                     <td className="px-6 py-4 text-sm text-white">GW 3</td>
                     <td className="px-6 py-4 text-sm text-slate-300">vs BetBoom Team</td>
                     <td className="px-6 py-4 text-center">
                        <span className="inline-block w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold leading-6 border border-emerald-500/30">W</span>
                     </td>
                     <td className="px-6 py-4 text-sm text-slate-400 text-right">55:10</td>
                     <td className="px-6 py-4 text-sm text-slate-300 text-right font-mono">18/4/22</td>
                     <td className="px-6 py-4 text-sm font-bold text-amber-400 text-right">38.4</td>
                  </tr>
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
