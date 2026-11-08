'use client';
import { formatPlayerPrice } from '@/lib/format-price';

import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';
import { PriceSparkline } from '@/components/PriceSparkline';
import { canOptimizeImage } from '@/lib/optimized-image';
import type { FantasyPlayer as TransferPlayer } from '@/types/fantasy';

interface TransferPlayerDetailsModalProps {
  player: TransferPlayer;
  loading: boolean;
  owned: boolean;
  onClose: () => void;
  onSelect: () => void;
}

export function TransferPlayerDetailsModal({
  player,
  loading,
  owned,
  onClose,
  onSelect,
}: TransferPlayerDetailsModalProps) {
  const ownership = player.ownership_percentage == null ? null : Number(player.ownership_percentage);
  const ownershipLabel = ownership === null ? null : ownership >= 35 ? 'Meta' : ownership >= 15 ? 'Popular' : 'Differential';
  const ownershipColor = ownership === null ? '' : ownership >= 35
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : ownership >= 15
      ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
      : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-8 backdrop-blur-sm sm:items-center animate-modal-backdrop"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="animate-modal-content relative my-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="relative border-b border-slate-800 bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 p-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/90 text-slate-300 shadow-sm transition-all hover:border-slate-600 hover:bg-slate-700 hover:text-white"
            aria-label="Close modal"
            title="Close modal"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-700 bg-slate-800 shadow-xl sm:h-24 sm:w-24">
              {player.profile_image_url ? (
                <Image
                  src={player.profile_image_url}
                  alt={player.in_game_name || player.name}
                  width={96}
                  height={96}
                  unoptimized={!canOptimizeImage(player.profile_image_url)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="player-avatar-initials text-3xl font-bold">
                  {(player.in_game_name || player.name || 'P').substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="mb-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h2 className="text-2xl font-bold text-white sm:text-3xl">{player.in_game_name || player.name}</h2>
                <span className="rounded bg-slate-700 px-2 py-0.5 text-xs font-bold uppercase text-slate-300">{player.primary_role}</span>
                <span className="rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold capitalize text-emerald-400">
                  {player.availability_status || 'Available'}
                </span>
              </div>

              <p className="mb-3 text-sm text-slate-400">
                {player.real_name || player.name} · <strong className="text-amber-400">{player.professional_teams?.name || 'Free Agent'}</strong> ({player.professional_teams?.region || 'Global'})
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <button
                  type="button"
                  onClick={onSelect}
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold shadow-md transition-all ${
                    owned ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  }`}
                >
                  {owned ? 'Sell From Squad' : 'Select to Buy'}
                </button>
                <Link
                  href={`/players/${player.id}`}
                  className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  Full Profile Page →
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col items-center justify-between rounded-xl border border-slate-700/80 bg-slate-800/60 p-3 text-center">
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">Market Price</div>
                <div className="font-mono text-xl font-bold text-amber-400">{formatPlayerPrice(player.current_price)}</div>
              </div>
              <div className="mt-2 flex flex-col items-center">
                <PriceSparkline data={player.price_history} width={72} height={20} strokeWidth={2} themeAware />
                <span className="mt-0.5 text-[9px] text-slate-400">Trend</span>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-xl border border-slate-700/80 bg-slate-800/60 p-3 text-center">
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">Ownership</div>
                <div className="text-xl font-bold text-white">{ownership === null ? '—' : `${ownership.toFixed(1)}%`}</div>
              </div>
              {ownership !== null && (
                <div className="mt-1 flex flex-col items-center gap-1">
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-700">
                    <div
                      className={`h-full rounded-full ${ownership >= 35 ? 'bg-emerald-400' : ownership >= 15 ? 'bg-cyan-400' : 'bg-amber-400'}`}
                      style={{ width: `${Math.min(100, Math.max(4, ownership))}%` }}
                    />
                  </div>
                  <span className={`inline-flex rounded border px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider ${ownershipColor}`}>
                    {ownershipLabel}
                  </span>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3 text-center">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">Season Points</div>
              <div className="font-mono text-xl font-bold text-white">{player.total_season_points ?? player.recent_points ?? 124.0}</div>
            </div>
            <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3 text-center">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-400">Latest Gameweek</div>
              <div className="font-mono text-xl font-bold text-emerald-400">+{player.last_gw_points ?? player.gameweek_points ?? 14.5} pts</div>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <span>⚔️</span> Recent Match History &amp; Scoring Breakdown
            </h4>
            {loading ? (
              <div className="overflow-hidden rounded-xl border border-slate-800 animate-pulse" role="status" aria-label="Loading performance details">
                <div className="grid grid-cols-5 gap-3 bg-slate-950 px-3 py-2.5">
                  {[1, 2, 3, 4, 5].map((header) => <div key={header} className="h-3 rounded bg-slate-800" />)}
                </div>
                <div className="divide-y divide-slate-800/80 bg-slate-900/50">
                  {[1, 2, 3].map((row) => (
                    <div key={row} className="grid grid-cols-5 gap-3 px-3 py-3">
                      {[1, 2, 3, 4, 5].map((cell) => <div key={cell} className="h-4 rounded bg-slate-800" />)}
                    </div>
                  ))}
                </div>
              </div>
            ) : !player.performances || player.performances.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-center text-xs text-slate-400">
                No individual match performances recorded yet for this season.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-3 py-2.5">Gameweek</th>
                      <th className="px-3 py-2.5">Opponent</th>
                      <th className="px-3 py-2.5 text-center">K / D / A</th>
                      <th className="px-3 py-2.5 text-center">GPM / XPM</th>
                      <th className="px-3 py-2.5 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-900/50 font-mono">
                    {player.performances.map((performance) => {
                      const playerTeamId = player.team_id ?? player.professional_teams?.id;
                      const teamA = performance.matches?.team_a;
                      const teamB = performance.matches?.team_b;
                      let opponentName = teamB?.name || teamA?.name || 'Opponent';

                      if (playerTeamId && teamA?.id === playerTeamId) {
                        opponentName = teamB?.name || 'Opponent';
                      } else if (playerTeamId && teamB?.id === playerTeamId) {
                        opponentName = teamA?.name || 'Opponent';
                      }

                      return (
                        <tr key={performance.id} className="transition-colors hover:bg-slate-800/40">
                          <td className="px-3 py-2.5 font-sans font-medium text-slate-300">GW {performance.gameweek_id}</td>
                          <td className="px-3 py-2.5 font-sans text-white">vs {opponentName}</td>
                          <td className="px-3 py-2.5 text-center text-slate-300">{performance.kills}/{performance.deaths}/{performance.assists}</td>
                          <td className="px-3 py-2.5 text-center text-slate-400">{performance.gold_per_minute} / {performance.experience_per_minute}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-amber-400">
                            {performance.fantasy_points_breakdown?.total_points ?? 16.5} pts
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div>
              <p className="text-xs text-slate-400">Player Availability Status</p>
              <p className="text-sm font-semibold capitalize text-white">{player.availability_status || 'Active for selection'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
