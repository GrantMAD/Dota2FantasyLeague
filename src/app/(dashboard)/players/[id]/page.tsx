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
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

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

  // Derive match history from real backend data or fallback to demo matches
  const matchHistory = player.performances && player.performances.length > 0
    ? player.performances.map((perf: any) => {
        const teamA = perf.matches?.team_a?.name || 'Team A';
        const teamB = perf.matches?.team_b?.name || 'Team B';
        const isPlayerTeamWinner = perf.matches?.winner_team_id && player.team_id === perf.matches.winner_team_id;
        const oppName = perf.matches?.team_a?.id === player.team_id ? teamB : teamA;
        const totalPoints = perf.fantasy_points_breakdown?.total_points ?? (
          (Number(perf.kills) * 2) - (Number(perf.deaths) * 1) + (Number(perf.assists) * 1.5) + (isPlayerTeamWinner ? 5 : 0)
        );

        return {
          id: perf.id,
          gameweek: `GW ${perf.gameweek_id}`,
          gameweek_id: perf.gameweek_id,
          opponent: `vs ${oppName}`,
          opponent_name: oppName,
          result: isPlayerTeamWinner ? 'W' : 'L',
          duration: perf.matches?.duration_minutes ? `${perf.matches.duration_minutes}:00` : '38:30',
          kda: `${perf.kills}/${perf.deaths}/${perf.assists}`,
          kills: perf.kills ?? 0,
          deaths: perf.deaths ?? 0,
          assists: perf.assists ?? 0,
          gpm: perf.gold_per_minute ?? 0,
          xpm: perf.experience_per_minute ?? 0,
          last_hits: perf.last_hits ?? 0,
          denies: perf.denies ?? 0,
          hero_damage: perf.hero_damage ?? 0,
          building_damage: perf.building_damage ?? 0,
          healing: perf.healing ?? 0,
          wards_placed: perf.wards_placed ?? 0,
          wards_destroyed: perf.wards_destroyed ?? 0,
          tower_participation: perf.tower_participation ?? 0,
          roshan_participation: perf.roshan_participation ?? 0,
          pts: Number(totalPoints).toFixed(1),
          breakdown: perf.fantasy_points_breakdown,
        };
      })
    : [
        {
          id: 'demo-1',
          gameweek: 'GW 4',
          gameweek_id: 4,
          opponent: 'vs Team Falcons',
          opponent_name: 'Team Falcons',
          result: 'W',
          duration: '42:15',
          kda: '12/2/14',
          kills: 12,
          deaths: 2,
          assists: 14,
          gpm: 780,
          xpm: 840,
          last_hits: 412,
          denies: 18,
          hero_damage: 38400,
          building_damage: 8200,
          healing: 1200,
          wards_placed: 2,
          wards_destroyed: 3,
          tower_participation: 5,
          roshan_participation: 2,
          pts: '24.5',
          breakdown: { combat_points: 14.0, economy_points: 4.5, objective_points: 3.0, teamfight_points: 3.0, win_points: 5.0, total_points: 24.5 },
        },
        {
          id: 'demo-2',
          gameweek: 'GW 4',
          gameweek_id: 4,
          opponent: 'vs Gaimin Gladiators',
          opponent_name: 'Gaimin Gladiators',
          result: 'L',
          duration: '38:40',
          kda: '4/5/8',
          kills: 4,
          deaths: 5,
          assists: 8,
          gpm: 560,
          xpm: 610,
          last_hits: 285,
          denies: 9,
          hero_damage: 21300,
          building_damage: 1800,
          healing: 450,
          wards_placed: 1,
          wards_destroyed: 1,
          tower_participation: 2,
          roshan_participation: 0,
          pts: '12.2',
          breakdown: { combat_points: 6.0, economy_points: 3.2, objective_points: 1.5, teamfight_points: 1.5, win_points: 0.0, total_points: 12.2 },
        },
        {
          id: 'demo-3',
          gameweek: 'GW 3',
          gameweek_id: 3,
          opponent: 'vs BetBoom Team',
          opponent_name: 'BetBoom Team',
          result: 'W',
          duration: '55:10',
          kda: '18/4/22',
          kills: 18,
          deaths: 4,
          assists: 22,
          gpm: 890,
          xpm: 940,
          last_hits: 640,
          denies: 24,
          hero_damage: 64200,
          building_damage: 12400,
          healing: 3100,
          wards_placed: 4,
          wards_destroyed: 5,
          tower_participation: 8,
          roshan_participation: 3,
          pts: '38.4',
          breakdown: { combat_points: 21.0, economy_points: 6.4, objective_points: 5.0, teamfight_points: 6.0, win_points: 5.0, total_points: 38.4 },
        },
      ];

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
                     {player.availability_status === 'available' || player.availability_status === 'active' ? (
                        <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-semibold">Available</span>
                     ) : (
                        <span className="bg-red-500/20 text-red-400 text-xs px-2.5 py-0.5 rounded-full border border-red-500/30 capitalize">{player.availability_status || 'Unavailable'}</span>
                     )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                     <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        {player.real_name || player.name || 'Name Unknown'}
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
                     <div className="text-3xl font-mono font-bold text-amber-400">${player.current_price || '0.0'}M</div>
                  </div>
                  <Link href="/transfers" className="bg-slate-700 hover:bg-emerald-600 border border-slate-600 hover:border-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-all shadow-lg flex items-center justify-center gap-2">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                     Manage in Transfers
                  </Link>
               </div>
            </div>
         </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
         <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 text-center shadow-sm">
            <div className="text-xs text-slate-400 uppercase mb-1">Season Pts</div>
            <div className="text-2xl font-bold text-white font-mono">{player.total_season_points ?? '184.5'}</div>
         </div>
         <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 text-center shadow-sm">
            <div className="text-xs text-slate-400 uppercase mb-1">Last GW Pts</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">+{player.last_gw_points ?? '24.5'}</div>
         </div>
         <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 text-center shadow-sm">
            <div className="text-xs text-slate-400 uppercase mb-1">Selected By</div>
            <div className="text-2xl font-bold text-white font-mono">{player.ownership_percentage ?? '48.5'}%</div>
         </div>
         <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5 text-center shadow-sm">
            <div className="text-xs text-slate-400 uppercase mb-1">Form Rating</div>
            <div className="text-2xl font-bold text-amber-400 font-mono">
               9.4
            </div>
         </div>
      </div>

      {/* Match History */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
         <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/80 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Recent Match History</h3>
              <p className="text-xs text-slate-400 mt-0.5">Click any match to view the complete fantasy scoring breakdown & performance metrics</p>
            </div>
            <span className="text-xs text-amber-400 font-medium">Interactive</span>
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
                     <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase text-center">Details</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-700/50">
                  {matchHistory.map((m: any) => (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedMatch(m)}
                      className="hover:bg-slate-700/40 transition-colors cursor-pointer group"
                    >
                       <td className="px-6 py-4 text-sm text-white font-medium">{m.gameweek}</td>
                       <td className="px-6 py-4 text-sm text-slate-300 group-hover:text-amber-400 transition-colors font-semibold">
                          {m.opponent}
                       </td>
                       <td className="px-6 py-4 text-center">
                          <span className={`inline-block w-6 h-6 rounded text-xs font-bold leading-6 border ${
                            m.result === 'W'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                          }`}>
                            {m.result}
                          </span>
                       </td>
                       <td className="px-6 py-4 text-sm text-slate-400 text-right font-mono">{m.duration}</td>
                       <td className="px-6 py-4 text-sm text-slate-300 text-right font-mono font-medium">{m.kda}</td>
                       <td className="px-6 py-4 text-sm font-bold text-amber-400 text-right font-mono">{m.pts}</td>
                       <td className="px-6 py-4 text-center">
                          <span className="text-xs text-amber-400 group-hover:underline">View →</span>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* Match Details Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold uppercase text-amber-400 border border-amber-500/30">
                    {selectedMatch.gameweek}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase border ${
                    selectedMatch.result === 'W'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border-red-500/30'
                  }`}>
                    {selectedMatch.result === 'W' ? 'Victory' : 'Defeat'}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white">{player.in_game_name} {selectedMatch.opponent}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Match Duration: {selectedMatch.duration} mins</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMatch(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Total Points Highlight */}
            <div className="my-6 rounded-xl border border-slate-800 bg-linear-to-r from-amber-500/10 via-slate-800/50 to-slate-800/50 p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wider">Fantasy Points Earned</div>
                <div className="text-3xl font-mono font-bold text-amber-400 mt-1">{selectedMatch.pts} <span className="text-base text-amber-300 font-sans">pts</span></div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 uppercase tracking-wider">Combat K / D / A</div>
                <div className="text-xl font-mono font-bold text-white mt-1">{selectedMatch.kda}</div>
              </div>
            </div>

            {/* In-Game Combat & Economy Stats Grid */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">In-Game Performance Stats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center">
                  <div className="text-[11px] text-slate-400 uppercase">GPM / XPM</div>
                  <div className="text-base font-bold text-white font-mono mt-1">{selectedMatch.gpm} / {selectedMatch.xpm}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center">
                  <div className="text-[11px] text-slate-400 uppercase">Last Hits / Denies</div>
                  <div className="text-base font-bold text-white font-mono mt-1">{selectedMatch.last_hits} / {selectedMatch.denies}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center">
                  <div className="text-[11px] text-slate-400 uppercase">Hero Damage</div>
                  <div className="text-base font-bold text-amber-400 font-mono mt-1">{Number(selectedMatch.hero_damage).toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center">
                  <div className="text-[11px] text-slate-400 uppercase">Tower / Roshan</div>
                  <div className="text-base font-bold text-white font-mono mt-1">{selectedMatch.tower_participation} / {selectedMatch.roshan_participation}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center">
                  <div className="text-[11px] text-slate-400 uppercase">Building Damage</div>
                  <div className="text-sm font-bold text-white font-mono mt-1">{Number(selectedMatch.building_damage).toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center">
                  <div className="text-[11px] text-slate-400 uppercase">Healing Provided</div>
                  <div className="text-sm font-bold text-emerald-400 font-mono mt-1">{Number(selectedMatch.healing).toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center col-span-2 sm:col-span-1">
                  <div className="text-[11px] text-slate-400 uppercase">Wards (Placed / Cut)</div>
                  <div className="text-sm font-bold text-white font-mono mt-1">{selectedMatch.wards_placed} / {selectedMatch.wards_destroyed}</div>
                </div>
              </div>
            </div>

            {/* Fantasy Point Breakdown */}
            {selectedMatch.breakdown && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Fantasy Scoring Breakdown</h3>
                <div className="divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950/40 text-xs">
                  <div className="flex items-center justify-between p-3">
                    <span className="text-slate-300">Combat Points (Kills, Deaths, Assists)</span>
                    <span className="font-mono font-bold text-white">+{selectedMatch.breakdown.combat_points ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="text-slate-300">Economy Points (Normalized GPM/XPM vs Duration)</span>
                    <span className="font-mono font-bold text-white">+{selectedMatch.breakdown.economy_points ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="text-slate-300">Objective Points (Towers, Roshan & Building Damage)</span>
                    <span className="font-mono font-bold text-white">+{selectedMatch.breakdown.objective_points ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="text-slate-300">Teamfight & Support Points (Healing, Warding, Fight %)</span>
                    <span className="font-mono font-bold text-white">+{selectedMatch.breakdown.teamfight_points ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="text-slate-300">Match Victory Bonus</span>
                    <span className="font-mono font-bold text-emerald-400">+{selectedMatch.breakdown.win_points ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-900/80 font-bold text-sm">
                    <span className="text-white">Total Calculated Points</span>
                    <span className="font-mono text-amber-400">={selectedMatch.pts} pts</span>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setSelectedMatch(null)}
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
