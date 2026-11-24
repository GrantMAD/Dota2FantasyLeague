'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Star, Shield, Award, Users, Info } from 'lucide-react';
import {
  calculateSeriesFantasyImpact,
  type SeriesFantasyImpactContext,
  type SeriesGameStatistics,
} from '@/lib/match-series-stats';

export type UserFantasyImpact = SeriesFantasyImpactContext;

interface BenchImpactRowProps {
  playerName: string;
  gameweekNumber?: number;
}

interface MatchFantasyImpactBannerProps {
  impact: UserFantasyImpact | null;
  seriesGames: SeriesGameStatistics[];
  gameweekNumber?: number;
}

function BenchImpactBadgeAndTooltip({
  playerName,
  gameweekNumber,
  children,
}: BenchImpactRowProps & {
  children: (trigger: ReactNode) => ReactNode;
}) {
  const [isPinned, setIsPinned] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const pointerDownRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const isOpen = isPinned || isHovered || isFocused;
  const gameweekLabel = gameweekNumber ? `Gameweek ${gameweekNumber}` : 'the gameweek';

  useEffect(() => {
    if (!isPinned) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsPinned(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isPinned]);

  const closeTooltip = () => {
    setIsPinned(false);
    setIsHovered(false);
    setIsFocused(false);
  };

  const trigger = (
    <span
      className="inline-flex items-center gap-1 rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setIsHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setIsHovered(false);
      }}
    >
      Bench
      <button
        type="button"
        aria-label={`Explain bench scoring for ${playerName}`}
        aria-expanded={isOpen}
        aria-describedby={tooltipId}
        onPointerDown={() => {
          pointerDownRef.current = true;
        }}
        onFocus={() => {
          if (!pointerDownRef.current) setIsFocused(true);
        }}
        onBlur={() => {
          pointerDownRef.current = false;
          closeTooltip();
        }}
        onClick={() => {
          pointerDownRef.current = false;
          setIsPinned((prev) => !prev);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            closeTooltip();
          }
        }}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-500"
      >
        <Info className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );

  return (
    <div ref={containerRef} className="relative flex items-center justify-between gap-3">
      {children(trigger)}
      <div
        id={tooltipId}
        role="tooltip"
        className={`${isOpen ? 'block' : 'hidden'} absolute left-0 top-full z-30 mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left text-xs shadow-2xl sm:w-72`}
      >
        <p className="mb-1 font-semibold text-[var(--text-primary)]">
          Why Bench players show 0.0 pts here
        </p>
        <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
          Bench players do not score by default. However, they automatically substitute in for{' '}
          {gameweekLabel} if a starter in the exact same role sits out the entire gameweek (checked
          Bench 1 → 2 → 3), or if Bench Boost is active. Provisional auto-subs appear in your
          Gameweek total and finalize once all starters&apos; matches finish.
        </p>
      </div>
    </div>
  );
}

export function MatchFantasyImpactBanner({
  impact,
  seriesGames,
  gameweekNumber,
}: MatchFantasyImpactBannerProps) {
  if (!impact) return null;

  const matchedPlayers = calculateSeriesFantasyImpact(seriesGames, impact);

  if (matchedPlayers.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--surface-raised)] flex items-center justify-center text-[var(--text-muted)]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Fantasy Squad Status</h4>
            <p className="text-xs text-[var(--text-muted)]">
              None of your active roster players featured in this series {gameweekNumber ? `(Gameweek ${gameweekNumber})` : ''}.
            </p>
          </div>
        </div>
        <Link
          href="/squad"
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
        >
          View Lineup →
        </Link>
      </div>
    );
  }

  const totalEffectivePoints = matchedPlayers.reduce((acc, p) => acc + p.effectivePoints, 0);

  return (
    <div className="relative isolate rounded-2xl border border-amber-500/30 bg-[var(--surface)] p-5 sm:p-6 shadow-xl">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -right-12 -top-20 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
      </div>
      <div className="relative mb-4 flex flex-col items-start justify-between gap-4 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Your Fantasy Match Impact</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                {matchedPlayers.length} {matchedPlayers.length === 1 ? 'Player' : 'Players'} In Series
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Total fantasy points contributed across this series to your Gameweek {gameweekNumber ?? ''} squad score.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2">
          <span className="text-xs font-medium text-[var(--text-muted)]">Net Series Impact:</span>
          <span className="font-mono text-xl font-black text-amber-400">
            +{totalEffectivePoints.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="relative grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {matchedPlayers.map((player) => {
          const isZeroedBenchPlayer = !player.isStarter && player.multiplier === 0;
          const renderHeader = (benchTrigger?: ReactNode) => (
            <>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link
                    href={`/players/${player.playerId}`}
                    className="truncate text-sm font-bold text-[var(--text-primary)] transition-colors hover:text-amber-500"
                  >
                    {player.playerName}
                  </Link>
                  <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-600 dark:text-cyan-300">
                    {player.role}
                  </span>
                  {player.isCaptain && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded">
                      <Star className="h-2.5 w-2.5 fill-current" /> C {player.multiplier}×
                    </span>
                  )}
                  {player.isViceCaptain && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-[var(--surface-muted)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded">
                      <Shield className="h-2.5 w-2.5" /> VC
                    </span>
                  )}
                  {benchTrigger}
                </div>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {player.slot}{player.heroName ? ` · ${player.heroName}` : ''} · {player.gamesPlayed} {player.gamesPlayed === 1 ? 'game' : 'games'}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-flex rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 font-mono text-sm font-bold text-amber-600 dark:text-amber-300">
                  {player.effectivePoints > 0 ? '+' : ''}{player.effectivePoints.toFixed(1)} pts
                </div>
                {player.multiplier !== 1 && (
                  <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                    Series base: {player.fantasyPoints.toFixed(1)} pts
                  </div>
                )}
              </div>
            </>
          );

          return (
            <div
              key={player.playerId}
              className="flex h-full flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 transition hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5"
            >
              {isZeroedBenchPlayer ? (
                <BenchImpactBadgeAndTooltip
                  playerName={player.playerName}
                  gameweekNumber={gameweekNumber}
                >
                  {(trigger) => renderHeader(trigger)}
                </BenchImpactBadgeAndTooltip>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  {renderHeader()}
                </div>
              )}
              <div className="mt-auto space-y-1 border-t border-[var(--border)] pt-2">
                {player.gameValues.map((game) => {
                  const effectivePoints = game.fantasyPoints * player.multiplier;
                  return (
                    <div key={game.matchId} className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="min-w-0 truncate text-[var(--text-muted)]">
                        Game {game.matchNumber}
                        {game.scheduledAt && (
                          <>
                            {' · '}
                            <time suppressHydrationWarning dateTime={game.scheduledAt}>
                              {new Date(game.scheduledAt).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </time>
                          </>
                        )}
                      </span>
                      <span className="shrink-0 font-mono font-semibold text-[var(--text-secondary)]">
                        {player.multiplier === 1
                          ? `${game.fantasyPoints.toFixed(1)} pts`
                          : `${game.fantasyPoints.toFixed(1)} × ${player.multiplier} = ${effectivePoints > 0 ? '+' : ''}${effectivePoints.toFixed(1)} pts`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
