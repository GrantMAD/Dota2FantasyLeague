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
            <h3 id="live-matches-heading" className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Matches In Progress
            </h3>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl border p-4"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
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
              <h3 id="live-matches-heading" className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Live Matches
              </h3>
              <span className="rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400">
                {matches.length} {matches.length === 1 ? 'Game' : 'Games'} Live
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Esports fixtures currently in progress
            </p>
          </div>
        </div>

        <Link
          href="/matches?status=live"
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ color: 'var(--accent-primary)' }}
        >
          View All Matches
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              className="group relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border p-4 shadow-sm shadow-red-500/5 transition-all duration-200 hover:-translate-y-0.5 hover:border-red-500/60 hover:shadow-lg hover:shadow-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              style={{
                background: 'var(--surface)',
                backgroundImage: 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(239, 68, 68, 0.02) 55%, transparent)',
                borderColor: 'var(--border)',
              }}
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full bg-red-500/60" />
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-red-500/20 pb-3">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <Swords className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <p
                    className="min-w-0 flex-1 whitespace-normal break-words text-sm font-semibold leading-snug"
                    style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}
                  >
                    {match.tournaments?.name || 'Tournament'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[11px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {match.best_of ? `Bo${match.best_of}` : 'Match'}
                  </span>
                  <span className="flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[11px] font-mono font-bold text-red-700 dark:text-red-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    {match.duration_seconds ? formatDuration(match.duration_seconds) : 'LIVE'}
                  </span>
                </div>
              </div>

              <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-1 sm:gap-3">
                <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <TeamLogo
                    name={radiantName}
                    logoUrl={match.radiant_team?.logo_url}
                    tag={radiantTag}
                    size="sm"
                    faction="radiant"
                  />
                  <div className="w-full min-w-0">
                    <p
                      className="whitespace-normal break-words text-sm font-bold leading-snug transition-colors group-hover:text-cyan-500 dark:group-hover:text-cyan-300"
                      style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}
                    >
                      {radiantName}
                    </p>
                    <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                      Radiant
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-center justify-center px-1">
                  <span className="text-[11px] font-black tracking-wider text-[var(--text-muted)]">
                    VS
                  </span>
                </div>

                <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <TeamLogo
                    name={direName}
                    logoUrl={match.dire_team?.logo_url}
                    tag={direTag}
                    size="sm"
                    faction="dire"
                  />
                  <div className="w-full min-w-0">
                    <p
                      className="whitespace-normal break-words text-sm font-bold leading-snug transition-colors group-hover:text-cyan-500 dark:group-hover:text-cyan-300"
                      style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}
                    >
                      {direName}
                    </p>
                    <span className="text-[10px] font-mono text-rose-700 dark:text-rose-400">
                      Dire
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs" style={{ borderColor: 'var(--border)' }}>
                {hasFantasyImpact ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
                    <Shield className="h-3 w-3" />
                    Fantasy Starters Playing
                  </span>
                ) : (
                  <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <Calendar className="h-3 w-3" />
                    Live Box Score
                  </span>
                )}
                <span className="flex items-center gap-1 whitespace-nowrap font-semibold transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--accent-primary)' }}>
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
