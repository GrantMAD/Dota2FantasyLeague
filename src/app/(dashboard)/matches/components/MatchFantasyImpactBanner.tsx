'use client';

import Link from 'next/link';
import { Star, Shield, Award, Users } from 'lucide-react';
import {
  calculateSeriesFantasyImpact,
  type SeriesFantasyImpactContext,
  type SeriesGameStatistics,
} from '@/lib/match-series-stats';

export type UserFantasyImpact = SeriesFantasyImpactContext;

interface MatchFantasyImpactBannerProps {
  impact: UserFantasyImpact | null;
  seriesGames: SeriesGameStatistics[];
  gameweekNumber?: number;
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
    <div className="relative isolate overflow-hidden rounded-2xl border border-amber-500/30 bg-[var(--surface)] p-5 sm:p-6 shadow-xl">
      <div className="pointer-events-none absolute -right-12 -top-20 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
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

      <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {matchedPlayers.map((player) => (
          <div
            key={player.playerId}
            className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 transition hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5"
          >
            <div className="flex items-center justify-between gap-3">
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
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded">
                      <Shield className="h-2.5 w-2.5" /> VC
                    </span>
                  )}
                  {!player.isStarter && (
                    <span className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                      Bench
                    </span>
                  )}
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
            </div>
            <div className="space-y-1 border-t border-[var(--border)] pt-2">
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
        ))}
      </div>
    </div>
  );
}
