'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  Lock,
  ArrowRight,
  Flame,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import type { TransferRushData, TransferRushPlayer } from '@/types/fantasy';

export function formatCountdown(totalSec: number): string {
  if (totalSec <= 0) return '00:00:00';
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function getRushBadgeMeta(
  isLocked: boolean,
  isRushActive: boolean,
  isApproaching: boolean
): {
  label: string;
  badgeStyle: string;
} {
  if (isLocked) {
    return {
      label: 'Lineups Locked',
      badgeStyle: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    };
  }
  if (isRushActive) {
    return {
      label: 'Rush Active',
      badgeStyle: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse',
    };
  }
  if (isApproaching) {
    return {
      label: 'Deadline Today',
      badgeStyle: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
    };
  }
  return {
    label: 'Market Open',
    badgeStyle: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  };
}

interface DashboardTransferRushProps {
  initialData?: TransferRushData | null;
  refreshIntervalSeconds?: number;
}

export function DashboardTransferRush({
  initialData = null,
  refreshIntervalSeconds = 30,
}: DashboardTransferRushProps) {
  const [data, setData] = useState<TransferRushData | null>(initialData);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [timeRemaining, setTimeRemaining] = useState<number>(
    initialData?.gameweek?.secondsRemaining ?? 0
  );

  // Poll for live transfer rush data
  useEffect(() => {
    let cancelled = false;

    const fetchRush = async () => {
      try {
        const res = await fetchWithAuth('/api/fantasy/transfer-rush?windowMinutes=60');
        if (!res.ok) return;
        const json: TransferRushData = await res.json();
        if (!cancelled) {
          setData(json);
          if (json.gameweek) {
            setTimeRemaining(json.gameweek.secondsRemaining);
          }
          setLoading(false);
        }
      } catch {
        // Silently preserve current view on network fluctuation
      }
    };

    if (!initialData) {
      fetchRush();
    }

    const interval = setInterval(fetchRush, refreshIntervalSeconds * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [initialData, refreshIntervalSeconds]);

  // Local ticker countdown
  useEffect(() => {
    if (timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeRemaining]);

  if (loading && !data) {
    return (
      <div className="card animate-pulse p-5 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-center min-h-[160px]">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <Activity className="w-5 h-5 animate-spin text-teal-400" />
          <span>Tracking market velocity & transfer deadline...</span>
        </div>
      </div>
    );
  }

  if (!data || !data.gameweek) {
    return null;
  }

  const {
    gameweek,
    topTransferredIn,
    topTransferredOut,
    activityPulses,
    isRushActive,
    totalTransfersInWindow,
  } = data;
  const isLocked = gameweek.isLocked || timeRemaining <= 0;
  const isApproaching = !isLocked && timeRemaining < 24 * 3600;
  const { label: badgeLabel, badgeStyle: headerBadgeStyle } = getRushBadgeMeta(
    isLocked,
    isRushActive,
    isApproaching
  );

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        isRushActive
          ? 'bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 border-amber-500/40 shadow-lg shadow-amber-950/20'
          : 'bg-slate-900/80 border-slate-800 backdrop-blur-sm'
      } p-5 sm:p-6 mb-6`}
      data-testid="transfer-deadline-rush"
    >
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isRushActive
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-teal-500/15 text-teal-400'
            }`}
          >
            {isRushActive ? <Flame className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Transfer Deadline Rush
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${headerBadgeStyle}`}>
                {badgeLabel}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              GW {gameweek.gameweekNumber} Deadline Tracking & Global Player Demand
            </p>
          </div>
        </div>

        {/* Live Countdown Clock */}
        <div className="flex items-center gap-3 bg-slate-950/70 border border-slate-800 px-4 py-2 rounded-xl">
          {isLocked ? (
            <>
              <Lock className="w-4 h-4 text-rose-400" />
              <div className="text-right">
                <span className="block text-xs text-slate-400">GW {gameweek.gameweekNumber}</span>
                <span className="text-sm font-bold text-rose-400 uppercase tracking-wide">Locked</span>
              </div>
            </>
          ) : (
            <>
              <Clock
                className={`w-4 h-4 ${
                  isRushActive ? 'text-amber-400 animate-spin' : 'text-teal-400'
                }`}
                style={{ animationDuration: isRushActive ? '4s' : '0s' }}
              />
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Deadline In
                </span>
                <span
                  className={`text-sm sm:text-base font-mono font-bold ${
                    isRushActive
                      ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                      : 'text-white'
                  }`}
                >
                  {formatCountdown(timeRemaining)}
                </span>
              </div>
            </>
          )}

          {!isLocked && (
            <Link
              href="/transfers"
              className="ml-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors flex items-center gap-1.5 shadow-sm shadow-teal-500/20"
            >
              <span>Transfers</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Activity Pulse Marquee / Milestone Alert */}
      {activityPulses.length > 0 && (
        <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center gap-2.5 text-xs text-slate-300 overflow-hidden">
          <Activity className="w-4 h-4 text-teal-400 shrink-0" />
          <div className="truncate">
            <span className="font-semibold text-slate-200">Market Pulse: </span>
            <span>{activityPulses[0].message}</span>
          </div>
          {totalTransfersInWindow > 0 && (
            <span className="ml-auto shrink-0 text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md">
              {totalTransfersInWindow} moves / hr
            </span>
          )}
        </div>
      )}

      {/* Top Transferred Players: In vs Out */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Most Transferred In */}
        <div className="rounded-xl bg-slate-950/40 border border-slate-800/60 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Top Transferred In (Past Hour)</span>
            </div>
          </div>

          {topTransferredIn.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              <span>No transfers recorded yet this hour</span>
            </div>
          ) : (
            <div className="space-y-2">
              {topTransferredIn.map((player: TransferRushPlayer, index: number) => (
                <Link
                  key={player.id}
                  href={`/transfers?player=${player.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-mono font-bold text-slate-400 w-4">
                      #{index + 1}
                    </span>
                    {player.teamLogoUrl ? (
                      <Image
                        src={player.teamLogoUrl}
                        alt={player.teamName || 'Team'}
                        width={20}
                        height={20}
                        className="rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                        {player.teamName ? player.teamName[0] : '•'}
                      </div>
                    )}
                    <div className="truncate">
                      <span className="text-xs font-semibold text-white group-hover:text-teal-300 transition-colors">
                        {player.inGameName || player.name}
                      </span>
                      <span className="block text-[11px] text-slate-400 truncate">
                        {player.teamName || 'Free Agent'} • {player.role || 'Player'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-emerald-400">
                      +{player.transferCount}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      ${Number(player.currentPrice).toFixed(1)}M
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Most Transferred Out */}
        <div className="rounded-xl bg-slate-950/40 border border-slate-800/60 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Top Transferred Out (Past Hour)</span>
            </div>
          </div>

          {topTransferredOut.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              <span>No transfers recorded yet this hour</span>
            </div>
          ) : (
            <div className="space-y-2">
              {topTransferredOut.map((player: TransferRushPlayer, index: number) => (
                <Link
                  key={player.id}
                  href={`/transfers?player=${player.id}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-mono font-bold text-slate-400 w-4">
                      #{index + 1}
                    </span>
                    {player.teamLogoUrl ? (
                      <Image
                        src={player.teamLogoUrl}
                        alt={player.teamName || 'Team'}
                        width={20}
                        height={20}
                        className="rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 shrink-0">
                        {player.teamName ? player.teamName[0] : '•'}
                      </div>
                    )}
                    <div className="truncate">
                      <span className="text-xs font-semibold text-white group-hover:text-rose-300 transition-colors">
                        {player.inGameName || player.name}
                      </span>
                      <span className="block text-[11px] text-slate-400 truncate">
                        {player.teamName || 'Free Agent'} • {player.role || 'Player'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-rose-400">
                      -{player.transferCount}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      ${Number(player.currentPrice).toFixed(1)}M
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
