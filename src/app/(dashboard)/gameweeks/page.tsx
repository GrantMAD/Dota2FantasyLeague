'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function GameweeksPage() {
  const [gameweeks, setGameweeks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGameweeks() {
      try {
        const res = await fetch('/api/gameweeks');
        const data = await res.json();
        setGameweeks(data.gameweeks || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load gameweeks');
      } finally {
        setLoading(false);
      }
    }
    fetchGameweeks();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Gameweek Schedule</h1>
        <p className="text-slate-400">View upcoming deadlines and past results</p>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-8 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
           {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-slate-800/50 rounded-xl h-32 border border-slate-700"></div>
           ))}
        </div>
      ) : (
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-slate-700 before:to-transparent">
          {gameweeks.map((gw, index) => {
            const isActive = gw.status === 'active';
            const isUpcoming = gw.status === 'upcoming';
            const isClosed = gw.status === 'closed';
            
            return (
              <div key={gw.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                {/* Timeline dot */}
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${
                   isActive ? 'bg-amber-500 border-amber-900 text-slate-900' : 
                   isClosed ? 'bg-slate-700 border-slate-800 text-slate-400' : 
                   'bg-slate-800 border-slate-700 text-slate-400'
                }`}>
                   <span className="text-sm font-bold">{gw.gameweek_number}</span>
                </div>
                
                {/* Card */}
                <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-800/80 border ${isActive ? 'border-amber-500/50' : 'border-slate-700'} rounded-xl p-5 shadow-lg transition-transform hover:-translate-y-1`}>
                   <div className="flex justify-between items-start mb-4">
                      <div>
                         <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            Gameweek {gw.gameweek_number}
                            {isActive && <span className="bg-amber-500/20 text-amber-500 text-[10px] uppercase px-2 py-0.5 rounded-full border border-amber-500/30">Active</span>}
                            {isClosed && <span className="bg-slate-700 text-slate-300 text-[10px] uppercase px-2 py-0.5 rounded-full">Closed</span>}
                         </h3>
                         <div className="text-sm text-slate-400 mt-1">
                            {new Date(gw.start_date).toLocaleDateString()} - {new Date(gw.end_date).toLocaleDateString()}
                         </div>
                      </div>
                      
                      <div className="text-right">
                         <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Deadline</div>
                         <div className={`text-sm font-mono ${isActive ? 'text-amber-400' : 'text-slate-400'}`}>
                            {new Date(gw.deadline_date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                         </div>
                      </div>
                   </div>
                   
                   <div className="border-t border-slate-700/50 pt-4 flex justify-between items-center">
                      <div className="text-sm text-slate-300">
                         {isClosed ? 'Scores Finalized' : isActive ? 'Matches in progress' : 'Waiting to start'}
                      </div>
                      {isActive && (
                         <Link href="/squads" className="text-sm text-amber-500 hover:text-amber-400 font-medium">
                            Manage Lineup →
                         </Link>
                      )}
                      {isClosed && (
                         <Link href={`/gameweeks/${gw.id}`} className="text-sm text-slate-400 hover:text-white transition-colors">
                            View Results →
                         </Link>
                      )}
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
