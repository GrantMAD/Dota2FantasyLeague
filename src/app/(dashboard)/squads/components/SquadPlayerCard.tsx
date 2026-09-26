'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Plus, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

export type SquadPlayer = {
  id: number;
  name: string;
  in_game_name: string | null;
  primary_role: string | null;
  profile_image_url: string | null;
  availability_status: string | null;
  availability_reason?: string | null;
  current_price: number;
  last_gw_points?: number;
  recent_points?: number;
  form_trend?: 'up' | 'down' | 'flat';
  professional_teams?: { id?: number; name?: string; slug?: string } | null;
};

interface SquadPlayerCardProps {
  slotName: string;
  roleLabel: string;
  player?: SquadPlayer | null;
  isStarter?: boolean;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  compact?: boolean;
  onOpenDetails: (playerId: number) => void;
  dataGuide?: string;
}

export function SquadPlayerCard({
  slotName,
  roleLabel,
  player,
  isStarter = true,
  isCaptain = false,
  isViceCaptain = false,
  compact = false,
  onOpenDetails,
  dataGuide,
}: SquadPlayerCardProps) {
  const roleParam = isStarter ? encodeURIComponent(roleLabel) : '';
  const transferUrl = roleParam ? `/transfers?role=${roleParam}` : '/transfers';

  // Empty slot state
  if (!player) {
    if (compact) {
      return (
        <Link
          href={transferUrl}
          className="group flex items-center justify-between rounded-xl border border-dashed border-slate-700/80 bg-slate-900/30 px-4 py-2.5 transition hover:border-teal-500/60 hover:bg-slate-800/40"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400 group-hover:border-teal-500 group-hover:text-teal-300">
              <Plus className="h-4 w-4" />
            </span>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                {roleLabel}
              </span>
              <span className="ml-2 text-xs text-slate-400">Empty Slot</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-teal-400 group-hover:underline">
            + Sign Player
          </span>
        </Link>
      );
    }

    return (
      <Link
        href={transferUrl}
        className="group relative flex min-h-24 flex-1 items-center justify-between rounded-2xl border-2 border-dashed border-slate-700/80 bg-slate-900/30 p-4 transition hover:border-teal-500/60 hover:bg-slate-800/50"
      >
        <div className="flex items-center gap-4">
          <div className="squad-empty-slot-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-600 bg-slate-800/60 text-slate-400 group-hover:border-teal-400 group-hover:bg-teal-500/10 group-hover:text-teal-300 transition">
            <Plus className="h-6 w-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-400">
              {roleLabel}
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-300 group-hover:text-white transition">
              Empty Position
            </p>
            <p className="text-xs text-slate-400">
              Tap to browse available {roleLabel}s in the market
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-300 transition group-hover:bg-teal-500 group-hover:text-slate-950">
            Sign Player →
          </span>
        </div>
      </Link>
    );
  }

  // Populated player card - Compact Mode
  if (compact) {
    return (
      <div
        data-guide={dataGuide}
        role="button"
        tabIndex={0}
        onClick={() => onOpenDetails(player.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenDetails(player.id);
        }}
        className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-2.5 transition hover:border-teal-500/50 hover:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-teal-400"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-800">
            {player.profile_image_url ? (
              <Image
                src={player.profile_image_url}
                alt={player.in_game_name || player.name}
                width={32}
                height={32}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[10px] font-bold text-slate-400">
                {(player.in_game_name || player.name || 'P').substring(0, 2).toUpperCase()}
              </span>
            )}
            {(isCaptain || isViceCaptain) && (
              <span
                className={`absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black ${
                  isCaptain ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-900'
                }`}
              >
                {isCaptain ? 'C' : 'V'}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white truncate">
                {player.in_game_name || player.name}
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] font-semibold text-slate-400 uppercase">
                {roleLabel}
              </span>
              {player.availability_status && player.availability_status !== 'available' && (
                <span
                  className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.2 text-[9px] font-bold text-rose-300 uppercase"
                  title={player.availability_reason || 'Unavailable for active matches'}
                >
                  {player.availability_status}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {player.professional_teams?.slug?.toUpperCase() || player.professional_teams?.name || 'Free Agent'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0 text-right">
          {player.last_gw_points != null && (
            <div className="hidden sm:block text-xs">
              <span className="text-slate-400 text-[10px] block">Last GW</span>
              <span className="font-semibold text-teal-300">{player.last_gw_points.toFixed(1)} pts</span>
            </div>
          )}
          <div className="font-mono text-xs font-bold text-amber-400">
            ${player.current_price?.toFixed(1) || '0.0'}M
          </div>
        </div>
      </div>
    );
  }

  // Populated player card - Detailed Pitch Mode
  return (
    <div
      data-guide={dataGuide}
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetails(player.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenDetails(player.id);
      }}
      className="group relative flex min-h-24 flex-1 cursor-pointer items-center justify-between rounded-2xl border border-slate-700/80 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:border-teal-500/60 hover:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-teal-400"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-slate-600 bg-slate-800 shadow-md">
          {player.profile_image_url ? (
            <Image
              src={player.profile_image_url}
              alt={player.in_game_name || player.name}
              width={56}
              height={56}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm font-bold text-slate-400">
              {(player.in_game_name || player.name || 'P').substring(0, 2).toUpperCase()}
            </span>
          )}

          {/* Captain / Vice-Captain Badge */}
          {(isCaptain || isViceCaptain) && (
            <span
              className={`absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black shadow-md ${
                isCaptain ? 'bg-amber-400 text-slate-950 ring-2 ring-slate-900' : 'bg-slate-200 text-slate-900 ring-2 ring-slate-900'
              }`}
              title={isCaptain ? 'Captain (2x Points)' : 'Vice-Captain'}
            >
              {isCaptain ? 'C' : 'VC'}
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-400">
              {roleLabel}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {player.professional_teams?.slug?.toUpperCase() || player.professional_teams?.name || 'Free Agent'}
            </span>
          </div>

          <h3 className="mt-1 truncate text-base font-bold text-white group-hover:text-teal-200 transition" title={player.in_game_name || player.name}>
            {player.in_game_name || player.name}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            {player.availability_status && player.availability_status !== 'available' && (
              <span
                className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300"
                title={
                  player.availability_reason ||
                  'Player has no active pro team or upcoming gameweek matches. Swap or bench to avoid 0 points.'
                }
              >
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                <span className="capitalize">{player.availability_status}</span>
                <span className="text-[10px] text-rose-400/80 font-normal">
                  ({player.availability_reason ? player.availability_reason : 'No Team / 0 pts risk'})
                </span>
              </span>
            )}
            {player.form_trend && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                Form:
                {player.form_trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-400" />}
                {player.form_trend === 'down' && <TrendingDown className="h-3 w-3 text-rose-400" />}
                {player.form_trend === 'flat' && <Minus className="h-3 w-3 text-slate-400" />}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5 shrink-0 text-right">
        {player.last_gw_points != null && (
          <div className="hidden sm:block">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400">Last GW</span>
            <span className="text-base font-bold text-teal-300">{player.last_gw_points.toFixed(1)} pts</span>
          </div>
        )}

        <div>
          <span className="block text-[10px] uppercase tracking-wider text-slate-400">Cost</span>
          <span className="font-mono text-base font-black text-amber-400">${player.current_price?.toFixed(1) || '0.0'}M</span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(player.id);
          }}
          className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-400 hover:border-slate-500 hover:text-white transition"
          aria-label="View player details"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
