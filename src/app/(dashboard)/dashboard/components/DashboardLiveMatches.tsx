'use client';

import Link from 'next/link';
import { Radio, ArrowRight, Shield, Swords, Calendar } from 'lucide-react';
import { TeamLogo } from '@/app/(dashboard)/matches/components/TeamLogo';
import type { MatchData } from '@/app/(dashboard)/matches/components/MatchCard';

interface DashboardLiveMatchesProps {
  matches: MatchData[];
  loading?: boolean;
  userSquadTeamIds?: number[];
}

export function DashboardLiveMatches({
  matches,
  loading = false,
  userSquadTeamIds = [],
}: DashboardLiveMatchesProps) {
  // If loading skeleton
  if (loading) {
    return (
      <section aria-labelledby="live-matches-heading" className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/20 text-red-400">
              <Radio className="h-4 w-4 animate-pulse" />
            </div>
            <h3 id="live-matches-heading" className="text-base font-bold text-white">
              Matches In Progress
            </h3>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 animate-pulse h-36"
            />
          ))}
        </div>
      </section>
    );
  }

  // If no live matches, we don't render an intrusive block, but keep clean
  if (!matches || matches.length === 0) {
    return null;
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatTeamName = (name: string | undefined | null, fallback: string) => {
    if (!name) return fallback;
    if (/^\d+$/.test(name.trim())) {
      return `Team ${name.trim()}`;
    }
    return name;
  };

  return (
    <section aria-labelledby="live-matches-heading" className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/15 border border-red-500/30 text-red-400">
            <Radio className="h-4 w-4 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 id="live-matches-heading" className="text-base font-bold text-white">
                Live Matches
              </h3>
              <span className="rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
                {matches.length} {matches.length === 1 ? 'Game' : 'Games'} Live
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Esports fixtures currently in progress
            </p>
          </div>
        </div>

        <Link
          href="/matches?status=live"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          View All Matches
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {matches.map((match) => {
          const radiantName = formatTeamName(match.radiant_team?.name, 'Radiant');
          const direName = formatTeamName(match.dire_team?.name, 'Dire');
          const radiantTag = match.radiant_team?.tag || radiantName.slice(0, 3).toUpperCase();
          const direTag = match.dire_team?.tag || direName.slice(0, 3).toUpperCase();

          const hasUserPlayersRadiant = userSquadTeamIds.includes(match.radiant_team_id);
          const hasUserPlayersDire = userSquadTeamIds.includes(match.dire_team_id);
          const hasFantasyImpact = hasUserPlayersRadiant || hasUserPlayersDire;

          return (
            <Link
              key={match.id}
              href={`/matches/${match.id}`}
              className="group relative flex flex-col justify-between rounded-2xl border border-red-500/30 bg-linear-to-b from-slate-900/90 to-slate-950/90 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-red-500/60 hover:shadow-lg hover:shadow-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              {/* Header: Tournament + Format & Duration */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Swords className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs font-medium text-slate-300 truncate">
                    {match.tournaments?.name || 'Tournament'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono text-slate-400">
                    {match.best_of ? `Bo${match.best_of}` : 'Match'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-red-400 bg-red-950/60 border border-red-800/60 rounded px-1.5 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    {match.duration_seconds ? formatDuration(match.duration_seconds) : 'LIVE'}
                  </span>
                </div>
              </div>

              {/* Teams & Score Matchup */}
              <div className="flex items-center justify-between gap-3 py-1">
                {/* Radiant Team */}
                <div className="flex flex-1 items-center gap-2.5 min-w-0">
                  <TeamLogo
                    name={radiantName}
                    logoUrl={match.radiant_team?.logo_url}
                    tag={radiantTag}
                    size="sm"
                    faction="radiant"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                      {radiantName}
                    </p>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      Radiant
                    </span>
                  </div>
                </div>

                {/* VS Badge */}
                <div className="flex flex-col items-center justify-center shrink-0 px-1">
                  <span className="text-[11px] font-black text-slate-500 tracking-wider">
                    VS
                  </span>
                </div>

                {/* Dire Team */}
                <div className="flex flex-1 items-center justify-end gap-2.5 min-w-0 text-right">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                      {direName}
                    </p>
                    <span className="text-[10px] text-rose-400 font-mono">
                      Dire
                    </span>
                  </div>
                  <TeamLogo
                    name={direName}
                    logoUrl={match.dire_team?.logo_url}
                    tag={direTag}
                    size="sm"
                    faction="dire"
                  />
                </div>
              </div>

              {/* Footer: Fantasy Roster Alert / Direct Link */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                {hasFantasyImpact ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                    <Shield className="h-3 w-3" />
                    Fantasy Starters Playing
                  </span>
                ) : (
                  <span className="text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Live Box Score
                  </span>
                )}
                <span className="font-semibold text-cyan-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Match Details &rarr;
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
