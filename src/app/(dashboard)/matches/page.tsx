'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function MatchesPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatches() {
      try {
        const res = await fetch('/api/matches?limit=40');
        const data = await res.json();
        setMatches(data.matches || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load matches');
      } finally {
        setLoading(false);
      }
    }
    fetchMatches();
  }, []);

  // Format match duration from seconds to MM:SS
  const formatDuration = (seconds: number) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Professional Matches</h1>
          <p className="text-slate-400">Recent results and upcoming schedule</p>
        </div>
        
        <div className="flex gap-2">
           <select className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500">
              <option value="">All Tournaments</option>
              <option value="ti">The International</option>
              <option value="major">ESL One Major</option>
           </select>
           <select className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500">
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="live">Live</option>
              <option value="scheduled">Scheduled</option>
           </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-8 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="animate-pulse bg-slate-800/50 rounded-xl h-48 border border-slate-700"></div>
           ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match) => {
             const isRadiantWinner = match.winner_team_id === match.radiant_team_id;
             const isDireWinner = match.winner_team_id === match.dire_team_id;
             
             return (
               <Link 
                 key={match.id} 
                 href={`/matches/${match.id}`}
                 className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 hover:bg-slate-700/60 hover:border-slate-500 transition-all group"
               >
                 <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700/50">
                    <div className="text-xs font-semibold text-amber-500 truncate max-w-[60%]">
                       {match.tournaments?.name || 'Tournament'}
                    </div>
                    <div className="text-xs text-slate-400">
                       {new Date(match.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                 </div>
                 
                 <div className="flex items-center justify-between gap-4 mb-6">
                    {/* Radiant */}
                    <div className="flex-1 flex flex-col items-center">
                       <div className={`w-12 h-12 rounded-lg mb-2 flex items-center justify-center bg-slate-900 border ${isRadiantWinner ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-slate-700'}`}>
                          {match.radiant_team?.tag || 'RAD'}
                       </div>
                       <div className={`text-sm font-bold text-center truncate w-full ${isRadiantWinner ? 'text-white' : 'text-slate-400'}`}>
                          {match.radiant_team?.name || 'Radiant'}
                       </div>
                    </div>
                    
                    {/* VS */}
                    <div className="flex flex-col items-center justify-center shrink-0 w-16">
                       {match.status === 'completed' ? (
                          <div className="bg-slate-900 border border-slate-700 rounded px-3 py-1 font-mono font-bold text-lg text-white">
                             {isRadiantWinner ? '1' : '0'} : {isDireWinner ? '1' : '0'}
                          </div>
                       ) : match.status === 'live' ? (
                          <div className="text-xs font-bold text-red-500 animate-pulse bg-red-500/10 px-2 py-1 rounded">LIVE</div>
                       ) : (
                          <div className="text-xs font-bold text-slate-500">VS</div>
                       )}
                    </div>
                    
                    {/* Dire */}
                    <div className="flex-1 flex flex-col items-center">
                       <div className={`w-12 h-12 rounded-lg mb-2 flex items-center justify-center bg-slate-900 border ${isDireWinner ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-slate-700'}`}>
                          {match.dire_team?.tag || 'DIR'}
                       </div>
                       <div className={`text-sm font-bold text-center truncate w-full ${isDireWinner ? 'text-white' : 'text-slate-400'}`}>
                          {match.dire_team?.name || 'Dire'}
                       </div>
                    </div>
                 </div>
                 
                 <div className="flex justify-between items-center text-xs text-slate-500 mt-auto pt-3 border-t border-slate-700/50">
                    <div className="flex items-center gap-1">
                       <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                       {formatDuration(match.duration_seconds)}
                    </div>
                    <div className="text-amber-500/80 group-hover:text-amber-400 flex items-center gap-1 font-medium transition-colors">
                       View Stats
                       <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </div>
                 </div>
               </Link>
             );
          })}
        </div>
      )}
    </div>
  );
}
