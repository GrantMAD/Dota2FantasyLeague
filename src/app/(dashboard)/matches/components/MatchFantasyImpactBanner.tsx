'use client';

import Link from 'next/link';
import { Star, Shield, Award, Users } from 'lucide-react';

export interface UserLineupDetail {
  playerId: number;
  slot: string;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isStarter: boolean;
}

export interface UserFantasyImpact {
  userOwnedPlayerIds: number[];
  lineupDetails: UserLineupDetail[];
  tripleCaptainActive?: boolean;
}

interface PlayerImpactSummary {
  playerId: number;
  playerName: string;
  heroName?: string;
  role: string;
  fantasyPoints: number;
  effectivePoints: number;
  multiplier: number;
  slot: string;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isStarter: boolean;
  isOwned: boolean;
}

interface MatchFantasyImpactBannerProps {
  impact: UserFantasyImpact | null;
  playerStats: Array<{
    player_id: number;
    hero_name?: string | null;
    professional_players?: {
      id: number;
      name: string;
      in_game_name?: string | null;
      primary_role?: string | null;
    } | null;
  }>;
  fantasyPointsByPlayer: Map<number, number>;
  gameweekNumber?: number;
}

export function MatchFantasyImpactBanner({
  impact,
  playerStats,
  fantasyPointsByPlayer,
  gameweekNumber,
}: MatchFantasyImpactBannerProps) {
  if (!impact) return null;

  const lineupMap = new Map<number, UserLineupDetail>(
    impact.lineupDetails.map((detail) => [detail.playerId, detail])
  );
  const ownedSet = new Set<number>(impact.userOwnedPlayerIds);

  const matchedPlayers: PlayerImpactSummary[] = [];

  for (const stat of playerStats) {
    const isOwned = ownedSet.has(stat.player_id);
    const lineup = lineupMap.get(stat.player_id);

    if (isOwned || lineup) {
      const basePoints = fantasyPointsByPlayer.get(stat.player_id) ?? 0;
      let multiplier = 1;
      if (lineup?.isCaptain) {
        multiplier = impact.tripleCaptainActive ? 3 : 2;
      } else if (!lineup?.isStarter) {
        multiplier = 0; // Bench players don't count towards active lineup total unless subbed
      }

      const effectivePoints = basePoints * multiplier;
      const playerName =
        stat.professional_players?.in_game_name ||
        stat.professional_players?.name ||
        `Player #${stat.player_id}`;

      matchedPlayers.push({
        playerId: stat.player_id,
        playerName,
        heroName: stat.hero_name ?? undefined,
        role: stat.professional_players?.primary_role || 'Core',
        fantasyPoints: basePoints,
        effectivePoints,
        multiplier,
        slot: lineup?.slot || 'Squad Roster',
        isCaptain: Boolean(lineup?.isCaptain),
        isViceCaptain: Boolean(lineup?.isViceCaptain),
        isStarter: Boolean(lineup?.isStarter),
        isOwned,
      });
    }
  }

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
              None of your active roster players featured in this match {gameweekNumber ? `(Gameweek ${gameweekNumber})` : ''}.
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
                {matchedPlayers.length} {matchedPlayers.length === 1 ? 'Player' : 'Players'} In Match
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Fantasy points contributed to your Gameweek {gameweekNumber ?? ''} squad score.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2">
          <span className="text-xs font-medium text-[var(--text-muted)]">Net Match Impact:</span>
          <span className="font-mono text-xl font-black text-amber-400">
            +{totalEffectivePoints.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {matchedPlayers.map((player) => (
          <div
            key={player.playerId}
            className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 transition hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5"
          >
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
                {player.slot}{player.heroName ? ` · ${player.heroName}` : ''}
              </p>
            </div>

            <div className="text-right shrink-0">
              <div className="inline-flex rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 font-mono text-sm font-bold text-amber-600 dark:text-amber-300">
                {player.effectivePoints > 0 ? '+' : ''}{player.effectivePoints.toFixed(1)} pts
              </div>
              {player.multiplier > 1 && (
                <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                  Base {player.fantasyPoints.toFixed(1)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
