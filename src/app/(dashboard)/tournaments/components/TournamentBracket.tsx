'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Trophy, Calendar, CheckCircle2, Clock, Swords } from 'lucide-react';
import { TeamLogo } from '@/app/(dashboard)/matches/components/TeamLogo';
import type { MatchData } from '@/app/(dashboard)/matches/components/MatchCard';

interface SeriesData {
  id: number;
  series_number: number;
  best_of: number;
  gameweek_id: number;
  team_a_id: number;
  team_b_id: number;
}

interface TeamData {
  id: number;
  name: string;
  slug: string;
  region?: string;
  logo_url: string | null;
}

interface TournamentBracketProps {
  series: SeriesData[];
  matches: MatchData[];
  teams: TeamData[];
}

interface SeriesNode {
  key: string;
  teamAId: number;
  teamBId: number;
  teamA: TeamData | null;
  teamB: TeamData | null;
  scoreA: number;
  scoreB: number;
  winnerTeamId: number | null;
  status: 'live' | 'completed' | 'scheduled';
  bestOf: number;
  scheduledAt: string | null;
  firstMatchId: number | undefined;
}

interface RoundGroup {
  day: string;
  dateLabel: string;
  series: SeriesNode[];
}

export function TournamentBracket({ matches, teams }: TournamentBracketProps) {
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const roundGroups = useMemo<RoundGroup[]>(() => {
    if (!matches || matches.length === 0) return [];

    // 1. Sort chronologically
    const sorted = [...matches].sort((a, b) => {
      const tA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const tB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return tA - tB;
    });

    // 2. Cluster individual games into BoX series encounters
    //    Same pair within 10 hours = part of the same series
    type Cluster = {
      key: string;
      teamAId: number;
      teamBId: number;
      startTime: number;
      endTime: number;
      matches: MatchData[];
    };

    const clusters: Cluster[] = [];
    let cur: Cluster | null = null;

    for (const m of sorted) {
      const aId = m.radiant_team_id ?? (m as unknown as { team_a_id?: number }).team_a_id;
      const bId = m.dire_team_id ?? (m as unknown as { team_b_id?: number }).team_b_id;
      if (!aId || !bId) continue;

      const lowId = Math.min(aId, bId);
      const highId = Math.max(aId, bId);
      const key = `${lowId}-${highId}`;
      const time = m.scheduled_at ? new Date(m.scheduled_at).getTime() : Date.now();

      if (!cur) {
        cur = { key, teamAId: lowId, teamBId: highId, startTime: time, endTime: time, matches: [m] };
      } else if (cur.key === key && time - cur.endTime < 1000 * 60 * 60 * 10) {
        cur.endTime = time;
        cur.matches.push(m);
      } else {
        clusters.push(cur);
        cur = { key, teamAId: lowId, teamBId: highId, startTime: time, endTime: time, matches: [m] };
      }
    }
    if (cur) clusters.push(cur);

    // 3. Convert clusters into SeriesNode
    const nodes: SeriesNode[] = clusters.map((cluster) => {
      const teamA = teamMap.get(cluster.teamAId) || null;
      const teamB = teamMap.get(cluster.teamBId) || null;
      let scoreA = 0;
      let scoreB = 0;
      let hasLive = false;
      let allCompleted = true;
      const bestOf = cluster.matches[0]?.best_of || (cluster.matches.length >= 3 ? 3 : 2);

      for (const m of cluster.matches) {
        if (m.status === 'live' || m.status === 'in_progress') hasLive = true;
        if (m.status !== 'completed') allCompleted = false;
        const winner = (m as unknown as { winner_team_id?: number | null }).winner_team_id;
        if (winner === cluster.teamAId) scoreA++;
        else if (winner === cluster.teamBId) scoreB++;
      }

      const winsNeeded = Math.ceil(bestOf / 2);
      let winnerTeamId: number | null = null;
      if (scoreA >= winsNeeded) winnerTeamId = cluster.teamAId;
      else if (scoreB >= winsNeeded) winnerTeamId = cluster.teamBId;

      let status: 'live' | 'completed' | 'scheduled' = 'scheduled';
      if (hasLive) status = 'live';
      else if (winnerTeamId || (allCompleted && cluster.matches.length > 0)) status = 'completed';

      return {
        key: cluster.key,
        teamAId: cluster.teamAId,
        teamBId: cluster.teamBId,
        teamA,
        teamB,
        scoreA,
        scoreB,
        winnerTeamId,
        status,
        bestOf,
        scheduledAt: cluster.matches[0]?.scheduled_at || null,
        firstMatchId: cluster.matches[0]?.id,
      };
    });

    // 4. Group series nodes by calendar day
    const dayMap = new Map<string, SeriesNode[]>();
    for (const node of nodes) {
      const day = node.scheduledAt ? node.scheduledAt.slice(0, 10) : 'unknown';
      const arr = dayMap.get(day) || [];
      arr.push(node);
      dayMap.set(day, arr);
    }

    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, seriesNodes]) => {
        const date = new Date(day + 'T12:00:00Z');
        const dateLabel = date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        });
        return { day, dateLabel, series: seriesNodes };
      });
  }, [matches, teamMap]);

  if (roundGroups.length === 0) {
    return (
      <div
        className="rounded-2xl border p-10 text-center"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}
        >
          <Trophy className="h-6 w-6" />
        </div>
        <h3 className="mb-1 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          No Series Data Yet
        </h3>
        <p className="mx-auto max-w-sm text-xs" style={{ color: 'var(--text-secondary)' }}>
          Series results will appear here once matches have been played.
        </p>
      </div>
    );
  }

  const totalSeries = roundGroups.reduce((s, g) => s + g.series.length, 0);

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
              color: 'var(--accent-primary)',
              border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)',
            }}
          >
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Series Results Timeline
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {totalSeries} series across {roundGroups.length} match day{roundGroups.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--success)' }} />
            <span>Winner</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            <span>Live</span>
          </span>
        </div>
      </div>

      {/* Timeline: one section per match day */}
      <div className="space-y-8">
        {roundGroups.map((group, gIdx) => (
          <div key={group.day}>
            {/* Day header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
              >
                <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {group.dateLabel}
                </span>
              </div>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                Day {gIdx + 1} &middot; {group.series.length} series
              </span>
            </div>

            {/* Series cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {group.series.map((node) => {
                const isLive = node.status === 'live';
                const isCompleted = node.status === 'completed';
                const teamAWon = node.winnerTeamId !== null && node.winnerTeamId === node.teamAId;
                const teamBWon = node.winnerTeamId !== null && node.winnerTeamId === node.teamBId;

                const card = (
                  <div
                    className="flex flex-col rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    style={{
                      background: 'var(--surface)',
                      borderColor: isLive ? '#f43f5e' : 'var(--border)',
                      boxShadow: isLive ? '0 0 16px -2px rgba(244,63,94,0.25)' : undefined,
                    }}
                  >
                    {/* Card header: format + status */}
                    <div
                      className="flex items-center justify-between px-3 py-1.5 border-b text-[10px] font-semibold"
                      style={{
                        background: 'var(--surface-raised)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>Bo{node.bestOf}</span>
                      {isLive ? (
                        <span className="flex items-center gap-1 font-bold text-rose-500 uppercase tracking-wide">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                          Live
                        </span>
                      ) : isCompleted ? (
                        <span className="flex items-center gap-1 font-medium" style={{ color: 'var(--success)' }}>
                          <CheckCircle2 className="h-3 w-3" />
                          Final
                        </span>
                      ) : (
                        <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                          <Clock className="h-3 w-3" />
                          Scheduled
                        </span>
                      )}
                    </div>

                    {/* Team A row */}
                    <div
                      className="flex items-center justify-between px-3 py-2.5 border-b"
                      style={{
                        borderColor: 'var(--border)',
                        background: teamAWon
                          ? 'color-mix(in srgb, var(--success) 8%, var(--surface))'
                          : 'transparent',
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamLogo
                          name={node.teamA?.name || 'TBD'}
                          logoUrl={node.teamA?.logo_url}
                          tag={node.teamA?.name?.slice(0, 4).toUpperCase()}
                          size="sm"
                        />
                        <span
                          className="truncate text-xs"
                          style={{
                            fontWeight: teamAWon ? 800 : 600,
                            color: teamAWon
                              ? 'var(--success)'
                              : isCompleted && !teamAWon
                              ? 'var(--text-muted)'
                              : 'var(--text-primary)',
                          }}
                        >
                          {node.teamA?.name || 'TBD'}
                        </span>
                      </div>
                      <span
                        className="font-mono text-sm font-black ml-2 px-2 py-0.5 rounded-lg shrink-0"
                        style={{
                          background: teamAWon
                            ? 'color-mix(in srgb, var(--success) 15%, transparent)'
                            : 'var(--surface-raised)',
                          color: teamAWon ? 'var(--success)' : 'var(--text-secondary)',
                        }}
                      >
                        {node.scoreA}
                      </span>
                    </div>

                    {/* Team B row */}
                    <div
                      className="flex items-center justify-between px-3 py-2.5"
                      style={{
                        background: teamBWon
                          ? 'color-mix(in srgb, var(--success) 8%, var(--surface))'
                          : 'transparent',
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamLogo
                          name={node.teamB?.name || 'TBD'}
                          logoUrl={node.teamB?.logo_url}
                          tag={node.teamB?.name?.slice(0, 4).toUpperCase()}
                          size="sm"
                        />
                        <span
                          className="truncate text-xs"
                          style={{
                            fontWeight: teamBWon ? 800 : 600,
                            color: teamBWon
                              ? 'var(--success)'
                              : isCompleted && !teamBWon
                              ? 'var(--text-muted)'
                              : 'var(--text-primary)',
                          }}
                        >
                          {node.teamB?.name || 'TBD'}
                        </span>
                      </div>
                      <span
                        className="font-mono text-sm font-black ml-2 px-2 py-0.5 rounded-lg shrink-0"
                        style={{
                          background: teamBWon
                            ? 'color-mix(in srgb, var(--success) 15%, transparent)'
                            : 'var(--surface-raised)',
                          color: teamBWon ? 'var(--success)' : 'var(--text-secondary)',
                        }}
                      >
                        {node.scoreB}
                      </span>
                    </div>
                  </div>
                );

                return node.firstMatchId ? (
                  <Link key={node.key} href={`/matches/${node.firstMatchId}`} className="block focus:outline-none">
                    {card}
                  </Link>
                ) : (
                  <div key={node.key}>{card}</div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
