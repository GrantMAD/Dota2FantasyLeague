'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { canOptimizeImage } from '@/lib/optimized-image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowLeftRight, CalendarDays, X } from 'lucide-react';

type ComparisonPlayer = {
  id: number;
  name: string;
  in_game_name: string | null;
  primary_role: string | null;
  team_id: number | null;
  current_price: number | null;
  price_change: number | null;
  ownership_percentage?: number | null;
  gameweek_points: number | null;
  recent_points: number | null;
  availability_status: string | null;
  professional_teams?: {
    name: string;
    logo_url: string | null;
  } | null;
};

type TeamMatch = {
  id: number;
  scheduled_time: string;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a?: { name: string } | null;
  team_b?: { name: string } | null;
  tournaments?: { name: string } | null;
};

type PlayersResponse = { data?: ComparisonPlayer[]; error?: string };
type MatchesResponse = { matches?: TeamMatch[]; error?: string };

type PlayerAnalytics = {
  matches: number;
  averagePoints: number;
  latestPoints: number;
  latestPrice: number;
  priceChange: number;
  form: number[];
  projectedPoints: number;
  bestPoints: number;
};

function playerLabel(player: ComparisonPlayer): string {
  return player.in_game_name || player.name;
}

function formatPrice(value: number | null | undefined): string {
  return value == null ? 'N/A' : `$${Number(value).toFixed(1)}M`;
}

function formatPoints(value: number | null | undefined): string {
  return value == null ? 'N/A' : Number(value).toFixed(1);
}

function formatPriceChange(value: number | null | undefined): string {
  if (value == null) return 'No price history';
  const amount = Number(value);
  const sign = amount > 0 ? '+' : '';
  return `${sign}$${amount.toFixed(2)}M`;
}

function formatMatchDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time TBA';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function PlayerComparisonSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 animate-pulse" role="status" aria-label="Loading player comparison">
      <div className="mb-6 h-4 w-36 rounded bg-[var(--surface-raised)]" />
      <div className="mb-8 space-y-3">
        <div className="h-9 w-64 rounded bg-[var(--surface-raised)]" />
        <div className="h-4 w-full max-w-2xl rounded bg-[var(--surface-raised)]" />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="min-w-160">
          <div className="grid grid-cols-[minmax(8rem,0.8fr)_repeat(3,minmax(0,1fr))] border-b border-[var(--border)]">
            <div className="p-4"><div className="h-4 w-24 rounded bg-[var(--surface-raised)]" /></div>
            {[1, 2, 3].map((column) => (
              <div key={column} className="border-l border-[var(--border)] p-4">
                <div className="h-5 w-28 rounded bg-[var(--surface-raised)]" />
                <div className="mt-2 h-3 w-20 rounded bg-[var(--surface-muted)]" />
                <div className="mt-3 h-3 w-16 rounded bg-[var(--surface-muted)]" />
              </div>
            ))}
          </div>
          {['Professional team', 'Current price', 'Latest price movement', 'Ownership %', 'Latest gameweek points', 'Average recent points', 'Availability', 'Upcoming fixtures'].map((label) => (
            <div key={label} className="grid grid-cols-[minmax(8rem,0.8fr)_repeat(3,minmax(0,1fr))] border-b border-[var(--border)] last:border-0">
              <div className="p-4"><div className="h-4 w-24 max-w-full rounded bg-[var(--surface-raised)]" /></div>
              {[1, 2, 3].map((column) => (
                <div key={column} className="border-l border-[var(--border)] p-4">
                  <div className="h-4 w-28 max-w-full rounded bg-[var(--surface-raised)]" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PlayerComparisonPage() {
  return (
    <Suspense fallback={<PlayerComparisonSkeleton />}>
      <PlayerComparisonContent />
    </Suspense>
  );
}

function PlayerComparisonContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ids = useMemo(
    () => [...new Set((searchParams.get('ids') ?? '')
      .split(',')
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0))].slice(0, 4),
    [searchParams],
  );
  const [players, setPlayers] = useState<ComparisonPlayer[]>([]);
  const [upcomingByTeam, setUpcomingByTeam] = useState<Map<number, TeamMatch[]>>(new Map());
  const [failedFixtureTeamIds, setFailedFixtureTeamIds] = useState<Set<number>>(new Set());
  const [fixtureLoading, setFixtureLoading] = useState(false);
  const [fixtureError, setFixtureError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsMap, setAnalyticsMap] = useState<Map<number, PlayerAnalytics>>(new Map());
  const [userIsPremium, setUserIsPremium] = useState<boolean | null>(null);
  const fixtureRequestId = useRef(0);

  const loadFixtures = useCallback(async (playersToLoad: ComparisonPlayer[]) => {
    const requestId = ++fixtureRequestId.current;
    const teamIds = [...new Set(playersToLoad
      .map((player) => player.team_id)
      .filter((teamId): teamId is number => teamId != null))];

    setFixtureLoading(true);
    setFixtureError(null);
    setFailedFixtureTeamIds(new Set());

    const scheduleResults = await Promise.allSettled(teamIds.map(async (teamId) => {
      const scheduleResponse = await fetchWithAuth(
        `/api/matches?teamId=${teamId}&status=scheduled&order=asc&limit=100`,
      );
      const scheduleData = (await scheduleResponse.json()) as MatchesResponse;
      if (!scheduleResponse.ok) {
        throw new Error(scheduleData.error || `Unable to load fixtures for team ${teamId}`);
      }
      const now = Date.now();
      const fixtures = (scheduleData.matches ?? [])
        .filter((match) => new Date(match.scheduled_time).getTime() >= now)
        .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
        .slice(0, 3);
      return [teamId, fixtures] as const;
    }));

    if (requestId !== fixtureRequestId.current) return;

    const loadedFixtures = new Map<number, TeamMatch[]>();
    const failedTeamIds: number[] = [];
    scheduleResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        loadedFixtures.set(...result.value);
      } else {
        failedTeamIds.push(teamIds[index]);
      }
    });

    setUpcomingByTeam(loadedFixtures);
    setFailedFixtureTeamIds(new Set(failedTeamIds));
    if (failedTeamIds.length > 0) {
      const failedTeamNames = failedTeamIds.map((teamId) =>
        playersToLoad.find((player) => player.team_id === teamId)?.professional_teams?.name ?? `team ${teamId}`,
      );
      setFixtureError(`Unable to load upcoming fixtures for ${failedTeamNames.join(', ')}. Player comparison data is still available.`);
    }
    setFixtureLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadComparison() {
      setLoading(true);
      setError(null);
      setPlayers([]);
      setUpcomingByTeam(new Map());
      setFailedFixtureTeamIds(new Set());
      setFixtureError(null);
      setFixtureLoading(false);

      if (ids.length < 2) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetchWithAuth(`/api/players?ids=${ids.join(',')}&limit=4&show_all=true`);
        const data = (await response.json()) as PlayersResponse;
        if (!response.ok) throw new Error(data.error || `Unable to load players (${response.status})`);
        if (cancelled) return;

        const loadedPlayers = data.data ?? [];
        setPlayers(loadedPlayers);
        void loadFixtures(loadedPlayers);

        // Fetch analytics for all players in parallel (non-blocking: 403 = not premium)
        void Promise.all(
          loadedPlayers.map(async (p) => {
            try {
              const r = await fetchWithAuth(`/api/players/${p.id}/analytics`);
              if (r.status === 403) return { id: p.id, analytics: null as PlayerAnalytics | null, premium: false };
              if (!r.ok) return { id: p.id, analytics: null as PlayerAnalytics | null, premium: true };
              const d = await r.json() as { playerId: number; analytics: PlayerAnalytics };
              return { id: p.id, analytics: d.analytics ?? null, premium: true };
            } catch {
              return { id: p.id, analytics: null as PlayerAnalytics | null, premium: true };
            }
          })
        ).then((results) => {
          if (cancelled) return;
          const map = new Map<number, PlayerAnalytics>();
          let premium = true;
          for (const r of results) {
            if (!r.premium) { premium = false; break; }
            if (r.analytics) map.set(r.id, r.analytics);
          }
          setUserIsPremium(premium);
          setAnalyticsMap(map);
        });
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load player comparison');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadComparison();
    return () => {
      cancelled = true;
      fixtureRequestId.current += 1;
    };
  }, [ids, loadFixtures]);

  const removePlayer = (playerId: number) => {
    const remainingIds = ids.filter((id) => id !== playerId);
    const query = remainingIds.length ? `?ids=${remainingIds.join(',')}` : '';
    router.replace(`/players/compare${query}`);
  };

  if (loading) {
    return <PlayerComparisonSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-6 text-rose-200">
          {error}
        </div>
        <Link href="/players" className="mt-5 inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200">
          <ArrowLeft className="h-4 w-4" /> Back to players
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/players" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to players directory
      </Link>

      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shadow-xs">
            <ArrowLeftRight className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">Player Comparison</h1>
        </div>
        <p className="text-[var(--text-secondary)] text-sm sm:text-base">
          Compare recent fantasy form, market valuations, ownership tiers, and upcoming fixtures side by side.
        </p>
      </div>

      {ids.length < 2 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center shadow-xs">
          <p className="text-lg font-bold text-[var(--text-primary)]">Choose at least two players</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">You can select up to four athletes at a time from the directory.</p>
          <Link href="/players" className="mt-5 inline-flex rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 text-xs font-bold transition-all shadow-md shadow-cyan-500/20">
            Select players
          </Link>
        </div>
      ) : players.length < 2 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center shadow-xs">
          <p className="text-lg font-bold text-[var(--text-primary)]">Not enough players were found</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">One or more selected players may no longer be available in the active directory.</p>
          <Link href="/players" className="mt-5 inline-flex rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 text-xs font-bold transition-all shadow-md shadow-cyan-500/20">
            Choose players
          </Link>
        </div>
      ) : (
        <>
          {fixtureError && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
              <p>{fixtureError}</p>
              <button
                type="button"
                onClick={() => void loadFixtures(players)}
                disabled={fixtureLoading}
                className="rounded-xl border border-amber-500/40 px-3.5 py-1.5 font-bold text-amber-700 dark:text-amber-200 transition-colors hover:bg-amber-500/20 disabled:cursor-wait disabled:opacity-60 text-xs"
              >
                {fixtureLoading ? 'Retrying…' : 'Retry fixtures'}
              </button>
            </div>
          )}
          {fixtureLoading && (
            <p role="status" className="mb-4 text-xs font-semibold text-[var(--text-muted)]">Loading upcoming pro matches…</p>
          )}
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
            <table className="w-full min-w-190 border-collapse text-left">
              <caption className="sr-only">Selected player statistics and upcoming matches</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-48 border-b border-[var(--border)] bg-[var(--surface-raised)] p-4.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Player Metrics
                  </th>
                  {players.map((player) => (
                    <th key={player.id} scope="col" className="min-w-56 border-b border-[var(--border)] bg-[var(--surface-raised)] p-4.5 align-top">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link href={`/players/${player.id}`} className="font-bold text-base text-[var(--text-primary)] hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors">
                            {playerLabel(player)}
                          </Link>
                          {player.name !== playerLabel(player) && (
                            <p className="mt-0.5 text-xs font-normal text-[var(--text-muted)]">{player.name}</p>
                          )}
                          <span className="mt-2 inline-flex items-center rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
                            {player.primary_role || 'Role unassigned'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePlayer(player.id)}
                          aria-label={`Remove ${playerLabel(player)} from comparison`}
                          className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)] transition-colors border border-transparent hover:border-[var(--border)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                <ComparisonRow label="Professional team">
                  {players.map((player) => (
                    <td key={player.id} className="p-4.5 text-sm text-[var(--text-primary)]">
                      <div className="flex items-center gap-2.5">
                        {player.professional_teams?.logo_url ? (
                          <Image
                            src={player.professional_teams.logo_url}
                            alt=""
                            width={20}
                            height={20}
                            unoptimized={!canOptimizeImage(player.professional_teams.logo_url)}
                            className="h-5 w-5 rounded-sm object-contain"
                          />
                        ) : (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-[var(--surface-muted)] text-[8px] font-bold text-[var(--text-secondary)]">
                            {player.professional_teams?.name?.slice(0, 2).toUpperCase() || 'FA'}
                          </span>
                        )}
                        <span className="font-semibold">{player.professional_teams?.name || 'Free Agent'}</span>
                      </div>
                    </td>
                  ))}
                </ComparisonRow>
                <ComparisonRow label="Current price">
                  {players.map((player) => (
                    <td key={player.id} className="p-4.5 font-mono text-sm font-black text-[var(--text-primary)]">
                      {formatPrice(player.current_price)}
                    </td>
                  ))}
                </ComparisonRow>
                <ComparisonRow label="Latest price movement">
                  {players.map((player) => {
                    const movement = player.price_change;
                    const color = movement == null || movement === 0
                      ? 'text-[var(--text-secondary)]'
                      : movement > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold';
                    return (
                      <td key={player.id} className={`p-4.5 text-sm ${color}`}>
                        {formatPriceChange(movement)}
                      </td>
                    );
                  })}
                </ComparisonRow>
                <ComparisonRow label="Ownership %">
                  {players.map((player) => {
                    const own = player.ownership_percentage;
                    return (
                      <td key={player.id} className="p-4.5 text-sm">
                        {own != null ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-black text-[var(--text-primary)]">
                                {Number(own).toFixed(1)}%
                              </span>
                              <span className={`inline-flex rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider border ${
                                Number(own) >= 35
                                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                                  : Number(own) >= 15
                                    ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border-cyan-500/30'
                                    : 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30'
                              }`}>
                                {Number(own) >= 35 ? 'Meta' : Number(own) >= 15 ? 'Popular' : 'Differential'}
                              </span>
                            </div>
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  Number(own) >= 35
                                    ? 'bg-emerald-500'
                                    : Number(own) >= 15
                                      ? 'bg-cyan-500'
                                      : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(4, Number(own)))}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="font-mono text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    );
                  })}
                </ComparisonRow>
                <ComparisonRow label="Latest gameweek points">
                  {players.map((player) => (
                    <td key={player.id} className="p-4.5 font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatPoints(player.gameweek_points)} <span className="font-sans text-xs font-normal text-[var(--text-muted)]">pts</span>
                    </td>
                  ))}
                </ComparisonRow>
                <ComparisonRow label="Average recent points">
                  {players.map((player) => (
                    <td key={player.id} className="p-4.5 font-mono text-sm font-black text-[var(--text-primary)]">
                      {formatPoints(player.recent_points)}
                      <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">last 5 GW</span>
                    </td>
                  ))}
                </ComparisonRow>
                {userIsPremium !== null && (
                  <ComparisonRow label="Projected pts">
                    {players.map((player) => {
                      if (!userIsPremium) {
                        return (
                          <td key={player.id} className="p-4.5 text-sm">
                            <span className="text-[var(--text-muted)]">&#128274; <span className="text-teal-600 dark:text-teal-400 text-xs font-semibold">Premium</span></span>
                          </td>
                        );
                      }
                      const a = analyticsMap.get(player.id);
                      return (
                        <td key={player.id} className="p-4.5 font-mono text-sm font-black text-teal-600 dark:text-teal-300">
                          {a ? a.projectedPoints.toFixed(1) : '-'}
                        </td>
                      );
                    })}
                  </ComparisonRow>
                )}
                {userIsPremium !== null && (
                  <ComparisonRow label="Season avg / match">
                    {players.map((player) => {
                      if (!userIsPremium) {
                        return (
                          <td key={player.id} className="p-4.5 text-sm">
                            <span className="text-[var(--text-muted)]">&#128274; <span className="text-teal-600 dark:text-teal-400 text-xs font-semibold">Premium</span></span>
                          </td>
                        );
                      }
                      const a = analyticsMap.get(player.id);
                      return (
                        <td key={player.id} className="p-4.5 text-sm font-black font-mono text-[var(--text-primary)]">
                          {a ? a.averagePoints.toFixed(1) : '-'}
                          <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">avg</span>
                        </td>
                      );
                    })}
                  </ComparisonRow>
                )}
                <ComparisonRow label="Availability">
                  {players.map((player) => {
                    const available = player.availability_status === 'available';
                    return (
                      <td key={player.id} className="p-4.5">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize shadow-2xs ${
                          available
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        }`}>
                          {player.availability_status || 'Unknown'}
                        </span>
                      </td>
                    );
                  })}
                </ComparisonRow>
                <ComparisonRow label="Upcoming matches">
                  {players.map((player) => (
                    <td key={player.id} className="p-4.5 align-top">
                      <UpcomingMatches
                        player={player}
                        matches={player.team_id == null ? [] : upcomingByTeam.get(player.team_id) ?? []}
                        isLoading={fixtureLoading && player.team_id != null && !upcomingByTeam.has(player.team_id)}
                        unavailable={player.team_id != null && failedFixtureTeamIds.has(player.team_id)}
                      />
                    </td>
                  ))}
                </ComparisonRow>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            💡 Recent points use the last five recorded gameweek scores. Price movement represents the latest recorded player price change.
          </p>
        </>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <tr className="hover:bg-[var(--surface-raised)]/40 transition-colors">
      <th scope="row" className="bg-[var(--surface-raised)]/60 p-4.5 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </th>
      {children}
    </tr>
  );
}

function UpcomingMatches({
  player,
  matches,
  isLoading,
  unavailable,
}: {
  player: ComparisonPlayer;
  matches: TeamMatch[];
  isLoading: boolean;
  unavailable: boolean;
}) {
  if (player.team_id == null) return <p className="text-xs font-medium text-[var(--text-muted)]">No team schedule</p>;
  if (isLoading) return <p className="text-xs font-medium text-[var(--text-muted)]">Loading fixtures…</p>;
  if (unavailable) return <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Fixtures unavailable</p>;
  if (matches.length === 0) return <p className="text-xs font-medium text-[var(--text-muted)]">No upcoming matches</p>;

  return (
    <ul className="space-y-2">
      {matches.map((match) => {
        const opponent = match.team_a_id === player.team_id
          ? match.team_b?.name
          : match.team_a?.name;
        return (
          <li key={match.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/70 p-2.5 shadow-2xs">
            <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
              <CalendarDays className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              vs {opponent || 'Opponent TBA'}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)] font-medium">{formatMatchDate(match.scheduled_time)}</p>
            {match.tournaments?.name && (
              <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">{match.tournaments.name}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
