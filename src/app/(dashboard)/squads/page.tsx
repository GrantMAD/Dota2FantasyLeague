'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SquadsPage() {
  const [lineup, setLineup] = useState<any[]>([]);
  const [gameweek, setGameweek] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLineup() {
      try {
        // Fetch active gameweek
        const gwRes = await fetch('/api/gameweeks?status=active');
        const gwData = await gwRes.json();
        const activeGw = gwData.gameweeks?.[0];

        if (activeGw) {
          setGameweek(activeGw);
          // Fetch lineup
          const lineupRes = await fetch(`/api/fantasy/lineup?gameweekId=${activeGw.id}`);
          if (lineupRes.ok) {
            const lineupData = await lineupRes.json();
            setLineup(lineupData.lineup || []);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load lineup');
      } finally {
        setLoading(false);
      }
    }
    fetchLineup();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-white mb-8">My Squad</h1>
        <div className="animate-pulse bg-slate-800/50 rounded-xl h-96 border border-slate-700 flex items-center justify-center">
           <p className="text-slate-400">Loading pitch...</p>
        </div>
      </div>
    );
  }

  const renderSlot = (slotName: string, roleLabel: string, isStarter: boolean = true) => {
    const playerEntry = lineup.find((p) => p.slot === slotName);

    if (!playerEntry) {
      return (
        <Link href="/transfers" className="flex flex-col items-center justify-center bg-slate-800/60 border border-slate-700 border-dashed rounded-lg p-4 w-32 h-40 hover:bg-slate-700/60 transition-colors">
          <div className="squad-empty-slot-icon text-3xl text-slate-500 mb-2">+</div>
          <div className="squad-card-role text-xs text-slate-400 font-semibold uppercase">{roleLabel}</div>
        </Link>
      );
    }

    const player = playerEntry.professional_players;

    return (
      <div className="flex flex-col items-center relative w-32">
        {playerEntry.is_captain && (
          <div className="absolute -top-3 -right-2 bg-amber-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full z-10 shadow-sm border border-amber-300">
            C
          </div>
        )}
        {playerEntry.is_vice_captain && (
          <div className="absolute -top-3 -right-2 bg-slate-200 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full z-10 shadow-sm border border-slate-300">
            V
          </div>
        )}
        <div className={`bg-slate-800 border ${isStarter ? 'border-amber-500/50' : 'border-slate-700'} rounded-lg p-3 w-full h-40 flex flex-col items-center shadow-lg relative overflow-hidden`}>
           <div className="h-12 w-12 bg-slate-700 rounded-full mb-2 overflow-hidden border border-slate-600 flex items-center justify-center">
              {player.profile_image_url ? (
                  <img src={player.profile_image_url} alt={player.in_game_name} className="w-full h-full object-cover" />
              ) : (
                  <span className="squad-card-muted text-slate-400 text-xs">{player.in_game_name?.substring(0, 2).toUpperCase()}</span>
              )}
           </div>
           <div className="text-center w-full">
              <div className="text-sm font-bold text-white truncate w-full px-1" title={player.in_game_name}>{player.in_game_name}</div>
              <div className="squad-card-muted text-xs text-slate-400 truncate w-full">{player.professional_teams?.tag || 'FA'}</div>
              <div className="mt-2 text-xs font-mono text-amber-400">${player.current_price || '0.0'}M</div>
           </div>
           
           <div className="absolute bottom-0 left-0 right-0 bg-slate-900/80 py-1 text-center border-t border-slate-700">
               <span className="squad-card-role text-[10px] font-bold text-slate-300 uppercase tracking-wider">{roleLabel}</span>
           </div>
        </div>
      </div>
    );
  };


  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Squad</h1>
          {gameweek && <p className="text-amber-500 font-semibold">Gameweek {gameweek.gameweek_number}</p>}
        </div>
        <div className="flex gap-4">
           <Link href="/transfers" className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
             Make Transfers
           </Link>
           <button className="bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-lg shadow-orange-500/20 text-sm">
             Save Lineup
           </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-8 text-sm">
          {error}
        </div>
      )}

      {/* The Pitch */}
      <div className="bg-linear-to-b from-emerald-900/40 to-emerald-950/40 border border-emerald-800/30 rounded-2xl p-8 mb-8 relative overflow-hidden shadow-2xl">
         {/* Pitch lines background */}
         <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-white"></div>
         </div>

         {/* Starters */}
         <div className="relative z-10">
            <h3 className="squad-section-label text-center text-emerald-400/80 text-xs font-bold uppercase tracking-widest mb-6">Starting V</h3>
            <div className="flex flex-wrap justify-center gap-6 md:gap-12 mb-8">
               {renderSlot('carry', 'Carry')}
               {renderSlot('mid', 'Mid')}
               {renderSlot('offlane', 'Offlane')}
            </div>
            <div className="flex flex-wrap justify-center gap-8 md:gap-24">
               {renderSlot('support', 'Support')}
               {renderSlot('hard_support', 'Hard Support')}
            </div>
         </div>
      </div>

      {/* Bench */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
         <h3 className="squad-section-label text-xs font-bold uppercase tracking-widest mb-6">Bench (Substitutes)</h3>
         <div className="flex flex-wrap justify-center md:justify-start gap-6">
            {renderSlot('bench_1', 'Bench 1', false)}
            {renderSlot('bench_2', 'Bench 2', false)}
            {renderSlot('bench_3', 'Bench 3', false)}
         </div>
      </div>

    </div>
  );
}
