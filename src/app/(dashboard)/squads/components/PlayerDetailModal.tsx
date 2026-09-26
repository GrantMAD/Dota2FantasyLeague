'use client';

import Image from 'next/image';
import { X, Trophy, TrendingUp, DollarSign, Calendar, Activity } from 'lucide-react';
import type { SquadPlayer } from './SquadPlayerCard';

type PlayerPerformance = {
  id: number;
  gameweek_id: number;
  kills: number;
  deaths: number;
  assists: number;
  fantasy_points_breakdown?: { total_points?: number } | null;
};

export type PlayerDetails = SquadPlayer & {
  total_season_points?: number;
  last_gw_points?: number;
  performances?: PlayerPerformance[];
};

interface PlayerDetailModalProps {
  player: PlayerDetails | null;
  loading: boolean;
  onClose: () => void;
}

export function PlayerDetailModal({ player, loading, onClose }: PlayerDetailModalProps) {
  if (loading) {
    return (
      <div
        className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4"
        role="status"
      >
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 text-sm text-slate-300 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            <span>Loading player details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!player) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="squad-player-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-teal-500/30 bg-slate-900 p-6 shadow-2xl dark:border-teal-500/30 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-teal-500/40 bg-slate-800 shadow-md">
              {player.profile_image_url ? (
                <Image
                  src={player.profile_image_url}
                  alt={player.in_game_name || player.name}
                  width={64}
                  height={64}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-base font-bold text-slate-400">
                  {(player.in_game_name || player.name || 'P').substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-400">
                {player.primary_role || 'Pro Player'}
              </div>
              <h2 id="squad-player-title" className="mt-1 text-2xl font-bold text-white">
                {player.in_game_name || player.name}
              </h2>
              <p className="text-xs text-slate-400">
                {player.professional_teams?.name || 'Free Agent'} • {player.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close player details"
            className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-400 hover:border-slate-500 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-800/50 p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Current Price</span>
            <p className="mt-1 font-mono text-lg font-black text-amber-400">
              ${Number(player.current_price || 0).toFixed(1)}M
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-800/50 p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Season Points</span>
            <p className="mt-1 text-lg font-black text-white">
              {player.total_season_points ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-800/50 p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Last GW Points</span>
            <p className="mt-1 text-lg font-black text-teal-300">
              {player.last_gw_points ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/80 bg-slate-800/50 p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Availability</span>
            <p className={`mt-1 text-sm font-semibold capitalize ${player.availability_status && player.availability_status !== 'available' ? 'text-rose-400' : 'text-emerald-400'}`}>
              {player.availability_status || 'Available'}
            </p>
          </div>
        </div>

        {/* Unavailable Explanation Callout */}
        {player.availability_status && player.availability_status !== 'available' && (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
              <span>Player Status: {player.availability_status.toUpperCase()}</span>
            </div>
            <p className="mt-1 text-rose-200/90 leading-relaxed">
              {player.availability_reason
                ? player.availability_reason
                : 'This player is currently not listed on an active pro team roster or has no scheduled tournament matches. They are at risk of scoring 0 points if kept as an active starter.'}
            </p>
            <p className="mt-2 text-[11px] text-rose-300/80">
              Tip: Swap this player for an active starter or move them to your bench before the gameweek deadline.
            </p>
          </div>
        )}

        {/* Recent Performances */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Recent Performances
            </h3>
            <span className="text-xs text-slate-500">Last 5 Gameweeks</span>
          </div>

          {player.performances?.length ? (
            <div className="space-y-2">
              {player.performances.slice(0, 5).map((perf) => (
                <div
                  key={perf.id}
                  className="flex items-center justify-between rounded-xl border border-slate-700/80 bg-slate-800/40 px-4 py-3 text-sm transition hover:bg-slate-800/60"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-300">
                      GW {perf.gameweek_id}
                    </span>
                    <span className="text-xs text-slate-400">
                      {perf.kills} K / {perf.deaths} D / {perf.assists} A
                    </span>
                  </div>
                  <span className="font-semibold text-teal-300">
                    {perf.fantasy_points_breakdown?.total_points ?? 0} pts
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/40 p-6 text-center text-xs text-slate-400">
              No recent match performance data recorded for this season yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
