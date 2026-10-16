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
        multiplier = 2;
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
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Fantasy Squad Status</h4>
            <p className="text-xs text-slate-400">
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
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900/90 to-slate-950 p-5 sm:p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Your Fantasy Match Impact</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                {matchedPlayers.length} {matchedPlayers.length === 1 ? 'Player' : 'Players'} In Match
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Fantasy points contributed to your Gameweek {gameweekNumber ?? ''} squad score.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-950/80 border border-amber-500/30 rounded-xl px-4 py-2">
          <span className="text-xs text-slate-400 font-medium">Contributed Points:</span>
          <span className="font-mono text-xl font-black text-amber-400">
            +{totalEffectivePoints.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {matchedPlayers.map((player) => (
          <div
            key={player.playerId}
            className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/80 hover:border-amber-500/40 transition"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link
                  href={`/players/${player.playerId}`}
                  className="font-bold text-sm text-white hover:text-amber-400 transition-colors truncate"
                >
                  {player.playerName}
                </Link>
                {player.isCaptain && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded">
                    <Star className="w-2.5 h-2.5 fill-current" /> C (2x)
                  </span>
                )}
                {player.isViceCaptain && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded">
                    <Shield className="w-2.5 h-2.5" /> VC
                  </span>
                )}
                {!player.isStarter && (
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                    Bench
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">
                {player.slot} · {player.heroName || player.role}
              </p>
            </div>

            <div className="text-right shrink-0">
              <div className="font-mono font-bold text-sm text-amber-400">
                {player.effectivePoints.toFixed(1)} pts
              </div>
              {player.multiplier === 2 && (
                <div className="text-[10px] text-slate-500 line-through">
                  {player.fantasyPoints.toFixed(1)} base
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
