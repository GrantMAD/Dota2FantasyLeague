'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Trophy,
  Activity,
  Shield,
  Coins,
  TrendingUp,
  Flame,
  Award,
  Swords,
  Target,
  ExternalLink,
  MapPin,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface AdminPlayerDetailModalProps {
  playerId: number | null;
  onClose: () => void;
  onNavigate?: () => void;
}

export default function AdminPlayerDetailModal({ playerId, onClose, onNavigate }: AdminPlayerDetailModalProps) {
  const router = useRouter();
  const [playerData, setPlayerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!playerId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    async function fetchPlayer() {
      try {
        const res = await fetch(`/api/players/${playerId}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed to fetch player (${res.status})`);
        }
        const json = await res.json();
        if (isMounted) {
          setPlayerData(json.player || null);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Error loading player profile');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchPlayer();

    return () => {
      isMounted = false;
    };
  }, [playerId]);

  if (!playerId) return null;

  const player = playerData;
  const team = player?.professional_teams;
  const performances = player?.performances || [];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-3xl max-h-[88vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header with gradient banner */}
        <div className="relative bg-gradient-to-r from-amber-600/30 via-slate-800/80 to-slate-900 p-6 border-b border-slate-700">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close player modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-5">
            {/* Player Avatar */}
            <div className="relative">
              {player?.profile_image_url ? (
                <img
                  src={player.profile_image_url}
                  alt={player.in_game_name || player.name}
                  className="w-20 h-20 rounded-2xl object-cover bg-slate-800 border-2 border-amber-500/40 shadow-lg shadow-amber-500/10"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-amber-500/40 flex items-center justify-center text-3xl font-black text-amber-400 shadow-lg">
                  {(player?.in_game_name || player?.name || '?').charAt(0)}
                </div>
              )}
              {player?.availability_status === 'available' ? (
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-slate-900 rounded-full flex items-center justify-center" title="Available">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </span>
              ) : (
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 border-2 border-slate-900 rounded-full" title="Unavailable" />
              )}
            </div>

            {/* Player Name & Team */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-black text-white tracking-tight truncate">
                  {player?.in_game_name || player?.name || 'Player'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                  {player?.primary_role || 'POS'}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-400">
                {player?.real_name && (
                  <span className="text-slate-300 font-medium">{player.real_name}</span>
                )}
                {player?.country && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {player.country}
                  </span>
                )}
              </div>

              {team && (
                <div className="flex items-center gap-2 mt-2">
                  {team.logo_url && (
                    <img src={team.logo_url} alt={team.name} className="w-4 h-4 object-contain" />
                  )}
                  <span className="text-xs font-semibold text-amber-400">{team.name}</span>
                  {team.region && (
                    <span className="text-xs text-slate-500">({team.region})</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-400">Loading player statistics...</p>
          </div>
        ) : error ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-slate-300">{error}</p>
          </div>
        ) : player ? (
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Market Price */}
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-800/40 p-3.5 rounded-xl border border-amber-500/30 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-amber-300/90 font-medium">
                  <div className="p-1 rounded-md bg-amber-500/20 text-amber-400">
                    <Coins className="w-3.5 h-3.5" />
                  </div>
                  Market Price
                </div>
                <p className="text-xl font-bold font-mono text-white mt-2">
                  ${(player.current_price || 0).toFixed(1)}M
                </p>
              </div>

              {/* Season Points */}
              <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-slate-800/40 p-3.5 rounded-xl border border-emerald-500/30 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-emerald-300/90 font-medium">
                  <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400">
                    <Trophy className="w-3.5 h-3.5" />
                  </div>
                  Season Points
                </div>
                <p className="text-xl font-bold font-mono text-emerald-400 mt-2">
                  {player.total_season_points || 0}
                </p>
              </div>

              {/* Latest GW Points */}
              <div className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-slate-800/40 p-3.5 rounded-xl border border-purple-500/30 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-purple-300/90 font-medium">
                  <div className="p-1 rounded-md bg-purple-500/20 text-purple-400">
                    <Flame className="w-3.5 h-3.5" />
                  </div>
                  Latest GW Pts
                </div>
                <p className="text-xl font-bold font-mono text-purple-300 mt-2">
                  {player.last_gw_points || 0}
                </p>
              </div>

              {/* Ownership */}
              <div className="bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-slate-800/40 p-3.5 rounded-xl border border-sky-500/30 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs text-sky-300/90 font-medium">
                  <div className="p-1 rounded-md bg-sky-500/20 text-sky-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  Ownership
                </div>
                <p className="text-xl font-bold font-mono text-sky-300 mt-2">
                  {(player.ownership_percentage || 0).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Performance Stats & Recent Match Activity */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Swords className="w-4 h-4 text-amber-400" />
                Recent Match Performances ({performances.length})
              </h3>

              {performances.length === 0 ? (
                <div className="p-6 text-center bg-slate-800/40 rounded-xl border border-dashed border-slate-700 text-slate-500 text-sm">
                  No match performances recorded for this player yet.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-700 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800 text-slate-400 border-b border-slate-700">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">GW</th>
                        <th className="px-3 py-2.5 font-medium">K / D / A</th>
                        <th className="px-3 py-2.5 font-medium text-right">GPM / XPM</th>
                        <th className="px-3 py-2.5 font-medium text-right">CS / DN</th>
                        <th className="px-3 py-2.5 font-medium text-right">Hero Dmg</th>
                        <th className="px-3 py-2.5 font-medium text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {performances.slice(0, 8).map((perf: any) => {
                        const pts = perf.fantasy_points_breakdown?.total_points ?? null;
                        return (
                          <tr key={perf.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="px-3 py-2 font-medium text-slate-300">
                              GW {perf.gameweek_id}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-200">
                              <span className="text-green-400">{perf.kills}</span> /{' '}
                              <span className="text-red-400">{perf.deaths}</span> /{' '}
                              <span className="text-blue-400">{perf.assists}</span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-300">
                              {Math.round(perf.gold_per_minute || 0)} / {Math.round(perf.experience_per_minute || 0)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-400">
                              {perf.last_hits || 0} / {perf.denies || 0}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-300">
                              {(perf.hero_damage || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-amber-400">
                              {pts !== null ? Number(pts).toFixed(1) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Additional Meta / Provider ID */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs text-slate-500">
              <span>Database ID: #{player.id}</span>
              {player.data_provider_id && (
                <span>Provider ID: {player.data_provider_id}</span>
              )}
              {player.last_synced_at && (
                <span>Synced: {new Date(player.last_synced_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        ) : null}

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            onClick={() => {
              if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('player_nav_from', 'admin-fantasy-teams');
              }
              if (onNavigate) {
                onNavigate();
              } else {
                onClose();
              }
              router.push(`/players/${playerId}?from=admin-fantasy-teams`);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Full Public Profile
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
