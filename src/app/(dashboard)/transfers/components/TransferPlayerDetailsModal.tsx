'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { X } from 'lucide-react';
import { PriceSparkline } from '@/components/PriceSparkline';
import { useAccessibleDialog } from '@/components/use-accessible-dialog';
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    open: true,
    onClose,
    initialFocusRef: closeButtonRef,
  });
  const ownership = player.ownership_percentage == null ? null : Number(player.ownership_percentage);
  const ownershipBadge = ownership === null
    ? null
    : ownership >= 35
      ? { label: 'Meta Pick', className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
      : ownership >= 15
        ? { label: 'Popular', className: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' }
        : { label: 'Differential', className: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-player-detail-title"
      tabIndex={-1}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-8 backdrop-blur-sm sm:items-center animate-modal-backdrop"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="animate-modal-content relative my-auto flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      >
        <div className="relative border-b border-[var(--border)] bg-[var(--surface-raised)] p-6">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] shadow-sm transition-all hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Close player details"
            title="Close player details"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="flex flex-col items-center gap-5 pr-10 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-raised)] shadow-xl sm:h-24 sm:w-24">
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
                <h2 id="transfer-player-detail-title" className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
                  {player.in_game_name || player.name}
                </h2>
                <span className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-bold uppercase text-[var(--text-secondary)]">
                  {player.primary_role}
                </span>
                <span className="rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold capitalize text-emerald-400">
                  {player.availability_status || 'Available'}
                </span>
                {ownershipBadge && (
                  <span className={`rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${ownershipBadge.className}`}>
                    {ownershipBadge.label}
                  </span>
                )}
              </div>

              <p className="mb-3 text-sm text-[var(--text-secondary)]">
                {player.real_name || player.name} · <strong className="text-amber-500 dark:text-amber-400">{player.professional_teams?.name || 'Free Agent'}</strong> ({player.professional_teams?.region || 'Global'})
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <button
                  type="button"
                  onClick={onSelect}
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    owned ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  }`}
                >
                  {owned ? 'Sell From Squad' : 'Select to Buy'}
                </button>
                <Link
                  href={`/players/${player.id}`}
                  className="rounded-lg border border-[var(--border)] px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  Full Profile Page →
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Price</div>
              <div className="font-mono text-xl font-bold text-amber-500 dark:text-amber-400">${player.current_price?.toFixed(1)}M</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Ownership</div>
              <div className="font-mono text-xl font-bold text-[var(--text-primary)]">{player.ownership_percentage == null ? '—' : `${Number(player.ownership_percentage).toFixed(1)}%`}</div>
              {ownershipBadge && (
                <div className={`mt-1.5 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ownershipBadge.className}`}>
                  {ownershipBadge.label}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Season Points</div>
              <div className="font-mono text-xl font-bold text-[var(--text-primary)]">{player.total_season_points ?? player.recent_points ?? 0}</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Latest Gameweek</div>
              <div className="font-mono text-xl font-bold text-emerald-500 dark:text-emerald-400">+{player.last_gw_points ?? player.gameweek_points ?? 0} pts</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Price Trend</div>
              <PriceSparkline data={player.price_history ?? undefined} themeAware />
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
              <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Price Change</div>
              <div className="font-mono text-lg font-bold text-[var(--text-primary)]">
                {player.price_change == null ? '—' : `${player.price_change > 0 ? '+' : ''}$${Math.abs(player.price_change).toFixed(1)}M`}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <span aria-hidden="true">⚔️</span> Recent Match History &amp; Scoring Breakdown
            </h4>
            {loading ? (
              <div className="overflow-hidden rounded-xl border border-[var(--border)] animate-pulse" role="status" aria-label="Loading performance details">
                <div className="grid grid-cols-5 gap-3 bg-[var(--surface-raised)] px-3 py-2.5">
                  {[1, 2, 3, 4, 5].map((header) => <div key={header} className="h-3 rounded bg-[var(--surface-muted)]" />)}
                </div>
                <div className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                  {[1, 2, 3].map((row) => (
                    <div key={row} className="grid grid-cols-5 gap-3 px-3 py-3">
                      {[1, 2, 3, 4, 5].map((cell) => <div key={cell} className="h-4 rounded bg-[var(--surface-muted)]" />)}
                    </div>
                  ))}
                </div>
              </div>
            ) : !player.performances || player.performances.length === 0 ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-center text-xs text-[var(--text-muted)]">
                No individual match performances recorded yet for this season.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-raised)] uppercase tracking-wider text-[var(--text-muted)]">
                    <tr>
                      <th className="px-3 py-2.5">Gameweek</th>
                      <th className="px-3 py-2.5">Opponent</th>
                      <th className="px-3 py-2.5 text-center">K / D / A</th>
                      <th className="px-3 py-2.5 text-center">GPM / XPM</th>
                      <th className="px-3 py-2.5 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] font-mono">
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
                        <tr key={performance.id} className="transition-colors hover:bg-[var(--surface-raised)]">
                          <td className="px-3 py-2.5 font-sans font-medium text-[var(--text-secondary)]">GW {performance.gameweek_id}</td>
                          <td className="px-3 py-2.5 font-sans text-[var(--text-primary)]">vs {opponentName}</td>
                          <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{performance.kills}/{performance.deaths}/{performance.assists}</td>
                          <td className="px-3 py-2.5 text-center text-[var(--text-muted)]">{performance.gold_per_minute} / {performance.experience_per_minute}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-amber-500 dark:text-amber-400">
                            {performance.fantasy_points_breakdown?.total_points ?? 0} pts
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Player Availability Status</p>
              <p className="text-sm font-semibold capitalize text-[var(--text-primary)]">{player.availability_status || 'Active for selection'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
