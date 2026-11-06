'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  User,
  Zap,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  ExternalLink,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { canOptimizeImage } from '@/lib/optimized-image';
import Image from 'next/image';

export interface HistoryPlayer {
  id: number;
  name: string;
  role: string;
  points: number;
  rawPoints?: number;
  multiplier?: number;
  profileImageUrl: string | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
}

export interface GameweekHistoryResponse {
  gameweek: {
    id: number;
    number: number;
    status: 'upcoming' | 'active' | 'closed' | 'locked';
  };
  managerScore: number | null;
  globalAverage: number | null;
  starters: HistoryPlayer[];
  bench: HistoryPlayer[];
  captainPlayerId: number | null;
  viceCaptainPlayerId: number | null;
  activeChip: 'triple_captain' | 'bench_boost' | 'wildcard' | null;
  error?: string;
}

interface GameweekSquadLineupProps {
  gameweekId: number;
  gameweekNumber: number;
  gameweekStatus: 'upcoming' | 'active' | 'closed' | 'locked';
  deadline: string;
}

const ROLE_BADGES: Record<string, { label: string; badgeClass: string; borderClass: string }> = {
  Carry: { label: 'Pos 1 · Carry', badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', borderClass: 'border-cyan-500/20' },
  Mid: { label: 'Pos 2 · Mid', badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30', borderClass: 'border-purple-500/20' },
  Offlane: { label: 'Pos 3 · Offlane', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30', borderClass: 'border-amber-500/20' },
  Support: { label: 'Pos 4 · Support', badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', borderClass: 'border-emerald-500/20' },
  'Hard Support': { label: 'Pos 5 · Hard Support', badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30', borderClass: 'border-rose-500/20' },
};

function formatDateTime(dateStr: string) {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function GameweekSquadLineup({
  gameweekId,
  gameweekNumber,
  gameweekStatus,
  deadline,
}: GameweekSquadLineupProps) {
  const [data, setData] = useState<GameweekHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSquad() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchWithAuth(`/api/gameweeks/${gameweekId}/history`);
        if (!res.ok) {
          if (res.status === 401 || res.status === 404) {
            // User not authenticated or does not have a fantasy season
            if (!cancelled) {
              setData(null);
              setLoading(false);
            }
            return;
          }
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Unable to load your gameweek squad.');
        }

        const json = (await res.json()) as GameweekHistoryResponse;
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load lineup.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSquad();

    return () => {
      cancelled = true;
    };
  }, [gameweekId]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl animate-pulse space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-slate-800" />
            <div className="h-7 w-64 rounded bg-slate-800" />
          </div>
          <div className="h-12 w-48 rounded-xl bg-slate-800" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="h-44 rounded-2xl border border-slate-800 bg-slate-800/40 p-4" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-5 text-sm text-rose-300 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
        <Link
          href="/lineups"
          className="text-xs font-semibold text-rose-200 underline hover:text-white shrink-0"
        >
          Go to Lineups
        </Link>
      </div>
    );
  }

  // If unauthenticated or no data found
  if (!data) {
    return null;
  }

  const {
    managerScore,
    globalAverage,
    starters = [],
    bench = [],
    activeChip,
  } = data;

  const isUpcoming = gameweekStatus === 'upcoming';
  const isActive = gameweekStatus === 'active';
  const isFinal = gameweekStatus === 'closed' || gameweekStatus === 'locked';

  const scoreDelta =
    managerScore !== null && globalAverage !== null
      ? Math.round((managerScore - globalAverage) * 10) / 10
      : null;

  const benchTotal = bench.reduce((sum, p) => sum + (p.points || 0), 0);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 md:p-8 shadow-2xl space-y-6">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/3 -mt-16 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-cyan-300">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Your Lineup
            </span>

            {isActive && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Scoring
              </span>
            )}

            {isFinal && (
              <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                Final Gameweek Squad
              </span>
            )}

            {isUpcoming && (
              <span className="inline-flex items-center rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-300">
                Projected Lineup
              </span>
            )}

            {/* Chip Badges */}
            {activeChip === 'triple_captain' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/20 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-200">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                Triple Captain (3×)
              </span>
            )}
            {activeChip === 'bench_boost' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/50 bg-cyan-500/20 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-cyan-200">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Bench Boost Active
              </span>
            )}
            {activeChip === 'wildcard' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/50 bg-purple-500/20 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-purple-200">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                Wildcard Played
              </span>
            )}
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight">
            Gameweek {gameweekNumber} Squad Performance
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {isUpcoming
              ? `Lineup locks at deadline: ${formatDateTime(deadline)}`
              : 'Points earned by your starting 5 and bench contributors'}
          </p>
        </div>

        {/* Score & Comparison Summary */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Your Score */}
          <div className="flex flex-col items-center justify-center px-5 py-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/25 backdrop-blur-sm min-w-32">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400">
              {isUpcoming ? 'Status' : 'Your Score'}
            </span>
            <span className="text-2xl md:text-3xl font-black text-white">
              {isUpcoming ? 'Ready' : (managerScore !== null ? managerScore.toFixed(1) : '0.0')}
            </span>
            <span className="text-[10px] text-emerald-300/70">
              {isUpcoming ? 'Saved' : 'fantasy pts'}
            </span>
          </div>

          {/* Average & Delta (if not upcoming) */}
          {!isUpcoming && globalAverage !== null && (
            <div className="flex flex-col items-center justify-center px-4 py-3 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm min-w-28">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                League Avg
              </span>
              <span className="text-xl font-bold text-slate-200">
                {globalAverage.toFixed(1)}
              </span>
              {scoreDelta !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 text-[11px] font-semibold mt-0.5 ${
                    scoreDelta > 0
                      ? 'text-emerald-400'
                      : scoreDelta < 0
                      ? 'text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  {scoreDelta > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : scoreDelta < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <Minus className="w-3 h-3" />
                  )}
                  {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}
                </span>
              )}
            </div>
          )}

          {/* Link to Edit Lineups if upcoming */}
          {isUpcoming && (
            <Link
              href="/lineups"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-cyan-500/20"
            >
              <span>Edit Lineup</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Empty State: No starters configured */}
      {starters.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 space-y-3">
          <p className="text-sm font-medium text-slate-300">
            {isUpcoming
              ? `You have not confirmed your starting 5 for Gameweek ${gameweekNumber} yet.`
              : `No active fantasy squad was recorded for Gameweek ${gameweekNumber}.`}
          </p>
          {isUpcoming && (
            <Link
              href="/lineups"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
            >
              <span>Set Your Starting 5 Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Starting Five Pitch Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Starting Five
              </h3>
              <span className="text-[11px] text-slate-500">
                5 active starters
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {starters.map((player) => {
                const roleConfig = ROLE_BADGES[player.role] || {
                  label: player.role,
                  badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
                  borderClass: 'border-slate-800',
                };

                return (
                  <div
                    key={`${player.role}-${player.id}`}
                    className={`relative flex flex-col justify-between p-4 rounded-2xl border bg-slate-900/80 hover:bg-slate-900 transition duration-200 group ${roleConfig.borderClass} ${
                      player.isCaptain ? 'ring-2 ring-amber-500/30 bg-amber-950/10' : ''
                    }`}
                  >
                    {/* Top Row: Role Badge + Captain / VC Indicator */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${roleConfig.badgeClass}`}
                      >
                        {roleConfig.label}
                      </span>

                      {player.isCaptain && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/50 px-2 py-0.5 text-[10px] font-black uppercase text-amber-300 shadow-xs">
                          C {player.multiplier && player.multiplier > 1 ? `(${player.multiplier}×)` : ''}
                        </span>
                      )}

                      {player.isViceCaptain && (
                        <span className="inline-flex items-center rounded-full bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
                          VC
                        </span>
                      )}
                    </div>

                    {/* Middle: Player Avatar + In-Game Name */}
                    <Link
                      href={`/players/${player.id}`}
                      className="flex items-center gap-3 my-2 group-hover:translate-x-0.5 transition"
                    >
                      <div className="relative w-11 h-11 shrink-0 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700 shadow-sm">
                        {player.profileImageUrl ? (
                          canOptimizeImage(player.profileImageUrl) ? (
                            <Image
                              src={player.profileImageUrl}
                              alt={player.name}
                              width={44}
                              height={44}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={player.profileImageUrl}
                              alt={player.name}
                              className="w-full h-full object-cover"
                            />
                          )
                        ) : (
                          <User className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm text-white group-hover:text-amber-300 truncate transition">
                          {player.name}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          View profile <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      </div>
                    </Link>

                    {/* Bottom: Points Display */}
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-baseline justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-slate-500">
                        Points
                      </span>

                      <div className="text-right">
                        <span className="text-base font-black text-emerald-400">
                          {isUpcoming ? '—' : `${player.points.toFixed(1)}`}
                        </span>
                        {!isUpcoming && (
                          <span className="text-[10px] text-slate-400 ml-1">pts</span>
                        )}

                        {player.isCaptain && player.rawPoints !== undefined && player.multiplier && player.multiplier > 1 && !isUpcoming && (
                          <div className="text-[10px] text-amber-300/80">
                            ({player.rawPoints.toFixed(1)} × {player.multiplier})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bench Substitutes Section */}
          {bench.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Bench Substitutes
                  </h3>
                  {activeChip === 'bench_boost' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      Scored for team (Bench Boost)
                    </span>
                  )}
                </div>

                {!isUpcoming && (
                  <span className="text-[11px] text-slate-500">
                    Bench total: <strong className="text-slate-300 font-semibold">{benchTotal.toFixed(1)} pts</strong>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {bench.map((player, idx) => (
                  <div
                    key={`${player.role}-${player.id}-${idx}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/70 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-0.5 rounded bg-slate-800">
                        B{idx + 1}
                      </span>

                      <div className="w-8 h-8 shrink-0 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                        {player.profileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={player.profileImageUrl}
                            alt={player.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {player.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {player.role}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-slate-300">
                        {isUpcoming ? '—' : `${player.points.toFixed(1)} pts`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

