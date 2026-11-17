'use client';
import { formatPlayerPrice } from '@/lib/format-price';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { canOptimizeImage } from '@/lib/optimized-image';
import { ArrowLeft, CalendarClock, CalendarDays, CircleAlert, ShieldCheck } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { fetchFixtureDifficulty } from '@/lib/fetch-fixture-difficulty';
import { FixtureDifficultyBadge } from '@/components/FixtureDifficultyBadge';
import type { FixtureDifficultyResult } from '@/lib/fixture-difficulty';

type PlannerPlayer = {
  id: number;
  name: string;
  in_game_name: string | null;
  primary_role: string | null;
  profile_image_url: string | null;
  availability_status: string | null;
  availability_reason: string | null;
  current_price: number;
  professional_teams: {
    id: number;
    name: string;
    slug: string;
  } | null;
};

type PlannerLineupEntry = {
  slot: string;
  player_id: number;
  is_starter: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  professional_players: PlannerPlayer | null;
};

type FantasyContext = {
  gameweek: {
    id: number;
    gameweekNumber: number;
    status: string;
    deadline: string | null;
    isLocked: boolean;
  } | null;
  lineup: PlannerLineupEntry[];
  ownedPlayers: PlannerPlayer[];
};

type PlannerMatch = {
  id: number;
  scheduled_time: string;
  team_a_id: number | null;
  team_b_id: number | null;
  radiant_team?: { name: string } | null;
  dire_team?: { name: string } | null;
  tournaments?: { name: string } | null;
};

type MatchesResponse = {
  matches?: PlannerMatch[];
  error?: string;
  pagination?: { totalPages?: number };
};

function displayName(player: PlannerPlayer): string {
  return player.in_game_name || player.name;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time to be confirmed';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDeadline(value: string | null): string {
  if (!value) return 'Deadline not announced';
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return 'Deadline not announced';
  const remaining = deadline.getTime() - Date.now();
  const formatted = deadline.toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  if (remaining <= 0) return `${formatted} (passed)`;
  const hours = Math.floor(remaining / 3_600_000);
  const days = Math.floor(hours / 24);
  const timeLeft = days > 0
    ? `${days}d ${hours % 24}h remaining`
    : `${hours}h ${Math.floor((remaining % 3_600_000) / 60_000)}m remaining`;
  return `${formatted} · ${timeLeft}`;
}

function slotLabel(slot: string): string {
  if (slot === 'hard_support') return 'Hard Support';
  if (slot === 'bench_1' || slot === 'bench_2' || slot === 'bench_3') {
    return `Bench ${slot.slice(-1)}`;
  }
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

export default function SquadPlannerPage() {
  const [context, setContext] = useState<FantasyContext | null>(null);
  const [matchesByTeam, setMatchesByTeam] = useState<Map<number, PlannerMatch[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixtureLoading, setFixtureLoading] = useState(false);
  const [fixtureError, setFixtureError] = useState<string | null>(null);
  const [fixtureDifficultyByTeam, setFixtureDifficultyByTeam] = useState<Map<number, FixtureDifficultyResult>>(new Map());
  const [fixtureDifficultyLoading, setFixtureDifficultyLoading] = useState(false);
  const [fixtureDifficultyError, setFixtureDifficultyError] = useState<string | null>(null);
  const fixtureRequestId = useRef(0);

  const loadFixtures = useCallback(async (teamIds: number[]) => {
    const requestId = ++fixtureRequestId.current;
    setFixtureLoading(true);
    setFixtureError(null);

    try {
      if (teamIds.length === 0) {
        setMatchesByTeam(new Map());
        setFixtureDifficultyByTeam(new Map());
        setFixtureError(null);
        setFixtureDifficultyError(null);
        setFixtureDifficultyLoading(false);
        return;
      }

      const fetchPage = async (page: number): Promise<MatchesResponse> => {
        const params = new URLSearchParams({
          teamIds: teamIds.join(','),
          status: 'scheduled',
          order: 'asc',
          page: String(page),
          limit: '100',
        });
        const response = await fetchWithAuth(`/api/matches?${params}`);
        const data = (await response.json()) as MatchesResponse;
        if (!response.ok) {
          throw new Error(data.error || `Unable to load squad fixtures (${response.status})`);
        }
        return data;
      };

      const firstPage = await fetchPage(1);
      const totalPages = Math.max(1, firstPage.pagination?.totalPages ?? 1);
      const remainingPages = await Promise.allSettled(
        Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2)),
      );
      if (requestId !== fixtureRequestId.current) return;

      const allMatches = [...(firstPage.matches ?? [])];
      let hasPartialFailure = false;
      for (const result of remainingPages) {
        if (result.status === 'fulfilled') {
          allMatches.push(...(result.value.matches ?? []));
        } else {
          hasPartialFailure = true;
        }
      }

      const now = Date.now();
      const upcoming = allMatches
        .filter((match) => {
          const scheduled = new Date(match.scheduled_time).getTime();
          return Number.isFinite(scheduled) && scheduled >= now;
        })
        .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
      const fixturesByTeam = new Map(teamIds.map((teamId) => [teamId, [] as PlannerMatch[]]));
      for (const match of upcoming) {
        for (const teamId of [match.team_a_id, match.team_b_id]) {
          if (teamId === null) continue;
          const teamFixtures = fixturesByTeam.get(teamId);
          if (teamFixtures && !teamFixtures.some((fixture) => fixture.id === match.id)) {
            teamFixtures.push(match);
          }
        }
      }
      setMatchesByTeam(fixturesByTeam);
      setFixtureDifficultyByTeam(new Map());
      if (hasPartialFailure) {
        setFixtureError('Some fixture results could not be loaded. Showing the fixtures that were available.');
      }

      const ownedTeamIds = new Set(teamIds);
      const opponentIds = [...new Set(upcoming.flatMap((match) => {
        const opponents: number[] = [];
        if (match.team_a_id !== null && ownedTeamIds.has(match.team_a_id) && match.team_b_id !== null) {
          opponents.push(match.team_b_id);
        }
        if (match.team_b_id !== null && ownedTeamIds.has(match.team_b_id) && match.team_a_id !== null) {
          opponents.push(match.team_a_id);
        }
        return opponents;
      }))];
      setFixtureDifficultyLoading(opponentIds.length > 0);
      setFixtureDifficultyError(null);
      try {
        const ratings = await fetchFixtureDifficulty(opponentIds);
        if (requestId === fixtureRequestId.current) setFixtureDifficultyByTeam(ratings);
      } catch (difficultyError: unknown) {
        if (requestId === fixtureRequestId.current) {
          setFixtureDifficultyError(
            difficultyError instanceof Error ? difficultyError.message : 'Unable to load fixture difficulty.',
          );
        }
      } finally {
        if (requestId === fixtureRequestId.current) setFixtureDifficultyLoading(false);
      }
    } catch (loadError: unknown) {
      if (requestId === fixtureRequestId.current) {
        setFixtureError(loadError instanceof Error ? loadError.message : 'Failed to load squad fixtures.');
      }
    } finally {
      if (requestId === fixtureRequestId.current) setFixtureLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPlanner() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchWithAuth('/api/fantasy/context');
        const data = (await response.json()) as FantasyContext & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || `Unable to load your fantasy squad (${response.status})`);
        }
        if (cancelled) return;
        setContext(data);

        const teamIds = [...new Set((data.ownedPlayers ?? [])
          .map((player) => player.professional_teams?.id)
          .filter((teamId): teamId is number => teamId != null))];
        setLoading(false);
        void loadFixtures(teamIds);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load the squad planner');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPlanner();
    return () => {
      cancelled = true;
      fixtureRequestId.current += 1;
    };
  }, [loadFixtures]);

  const lineupByPlayer = useMemo(
    () => new Map((context?.lineup ?? []).map((entry) => [entry.player_id, entry])),
    [context?.lineup],
  );

  const schedule = useMemo(() => {
    const allMatches = new Map<number, PlannerMatch>();
    for (const teamMatches of matchesByTeam.values()) {
      for (const match of teamMatches) allMatches.set(match.id, match);
    }
    return [...allMatches.values()]
      .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
  }, [matchesByTeam]);

  if (error && !loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-5 text-rose-200">
          {error}
        </div>
        <Link href="/gameweeks" className="mt-5 inline-flex items-center gap-2 text-sm text-cyan-300">
          <ArrowLeft className="h-4 w-4" /> Back to gameweeks
        </Link>
      </div>
    );
  }

  const gameweek = context?.gameweek;
  const ownedPlayers = context?.ownedPlayers ?? [];
  const unavailableCount = ownedPlayers.filter((player) => player.availability_status !== 'available').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link href="/gameweeks" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to gameweeks
      </Link>

      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <CalendarClock className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">My Gameweek Planner</h1>
        </div>
        <p className="text-[var(--text-secondary)]">
          Check your squad availability, lineup, deadline, and upcoming team fixtures in one place.
        </p>
      </header>

      <section className="mb-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="min-w-0 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-[var(--surface-raised)] to-[var(--surface)] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">Planning for</p>
          {loading ? (
            <div className="mt-2 space-y-2 animate-pulse">
              <div className="h-7 w-48 rounded bg-[var(--surface-muted)]" />
              <div className="h-4 w-64 rounded bg-[var(--surface-muted)]" />
            </div>
          ) : (
            <>
              <h2 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
                {gameweek ? `Gameweek ${gameweek.gameweekNumber}` : 'No active gameweek'}
              </h2>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                {gameweek?.status === 'closed' || gameweek?.isLocked
                  ? 'The current lineup is locked.'
                  : gameweek?.deadline
                    ? formatDeadline(gameweek.deadline)
                    : 'There is no upcoming deadline available.'}
              </p>
            </>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/lineups"
              className="rounded-lg bg-cyan-600 dark:bg-cyan-400 px-4 py-2 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 dark:hover:bg-cyan-300 transition-colors shadow-xs"
            >
              {gameweek?.isLocked ? 'View lineup' : 'Set lineup'}
            </Link>
            <Link
              href={gameweek ? `/matches?gameweekId=${gameweek.id}` : '/matches'}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors shadow-xs"
            >
              Gameweek fixtures
            </Link>
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Squad status</p>
          {loading ? (
            <div className="mt-3 space-y-2 animate-pulse">
              <div className="h-8 w-32 rounded bg-[var(--surface-muted)]" />
              <div className="h-4 w-48 rounded bg-[var(--surface-muted)]" />
            </div>
          ) : (
            <>
              <p className="mt-3 text-3xl font-bold text-[var(--text-primary)]">{ownedPlayers.length} players</p>
              <p className={`mt-2 text-sm ${unavailableCount ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                {unavailableCount
                  ? `${unavailableCount} unavailable or status unconfirmed`
                  : 'All players currently marked available'}
              </p>
            </>
          )}
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            Always review the latest lineup status before the deadline.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section
          className="overflow-hidden rounded-3xl border shadow-sm"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b p-5 sm:p-6" style={{ borderColor: 'var(--border)' }}>
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)', color: 'var(--accent-primary)' }}
              >
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>My squad availability</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Player status, lineup roles, and upcoming team schedules.
                </p>
              </div>
            </div>
            {!loading && ownedPlayers.length > 0 && (
              <div
                className="rounded-xl border px-3 py-2 text-right"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
              >
                <p className="font-mono text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {ownedPlayers.length - unavailableCount}/{ownedPlayers.length}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Available
                </p>
              </div>
            )}
          </div>
          {loading ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="min-h-40 animate-pulse rounded-2xl border p-4"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 rounded-full bg-[var(--surface-muted)]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-[var(--surface-muted)]" />
                      <div className="h-3 w-1/2 rounded bg-[var(--surface-muted)]" />
                    </div>
                  </div>
                  <div className="mt-5 h-7 w-full rounded-lg bg-[var(--surface-muted)]" />
                  <div className="mt-3 h-3 w-2/3 rounded bg-[var(--surface-muted)]" />
                </div>
              ))}
            </div>
          ) : ownedPlayers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Your squad is empty</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Add players to see availability and team fixtures here.</p>
              <Link
                href="/transfers"
                className="mt-4 inline-flex rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-500 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
              >
                Visit the transfer market
              </Link>
            </div>
          ) : (
            <ul className="grid gap-3 p-4 sm:grid-cols-2">
              {ownedPlayers.map((player) => {
                const lineupEntry = lineupByPlayer.get(player.id);
                const available = player.availability_status === 'available';
                const teamFixtures = player.professional_teams
                  ? matchesByTeam.get(player.professional_teams.id) ?? []
                  : [];
                const accentColor = lineupEntry?.is_captain
                  ? '#f59e0b'
                  : lineupEntry?.is_vice_captain
                    ? '#06b6d4'
                    : 'var(--accent-primary)';
                return (
                  <li
                    key={player.id}
                    className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border p-4 shadow-xs transition-shadow hover:shadow-md"
                    style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
                  >
                    <span className="absolute inset-x-0 top-0 h-1" style={{ background: accentColor }} />
                    <div className="flex min-w-0 items-center gap-3 pt-1">
                      {player.profile_image_url ? (
                        <Image
                          src={player.profile_image_url}
                          alt=""
                          width={48}
                          height={48}
                          unoptimized={!canOptimizeImage(player.profile_image_url)}
                          className="h-12 w-12 shrink-0 rounded-full border object-cover"
                          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                        />
                      ) : (
                        <span
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                          style={{
                            borderColor: 'color-mix(in srgb, var(--accent-primary) 30%, transparent)',
                            background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                            color: 'var(--accent-primary)',
                          }}
                        >
                          {displayName(player).slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/players/${player.id}`}
                          className="block truncate font-bold transition-colors hover:text-cyan-500"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {displayName(player)}
                        </Link>
                        <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                          {player.professional_teams?.name || 'Free agent'} · {player.primary_role || 'Role unassigned'}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold capitalize ${
                          available
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : 'text-amber-700 dark:text-amber-200'
                        }`}
                        style={{
                          borderColor: available
                            ? 'color-mix(in srgb, #10b981 30%, transparent)'
                            : 'color-mix(in srgb, #f59e0b 35%, transparent)',
                          background: available
                            ? 'color-mix(in srgb, #10b981 10%, transparent)'
                            : 'color-mix(in srgb, #f59e0b 10%, transparent)',
                        }}
                      >
                        {!available && <CircleAlert className="h-3 w-3" />}
                        {player.availability_status || 'Unconfirmed'}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
                        style={{
                          borderColor: 'var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {slotLabel(lineupEntry?.slot ?? '') || 'Not in lineup'}
                      </span>
                      {lineupEntry?.is_captain && (
                        <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-300">
                          Captain
                        </span>
                      )}
                      {lineupEntry?.is_vice_captain && (
                        <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
                          Vice-captain
                        </span>
                      )}
                      <span
                        className="ml-auto self-center text-xs font-semibold"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {player.current_price ? formatPlayerPrice(player.current_price) : 'Price unavailable'}
                      </span>
                    </div>
                    {!available && player.availability_reason && (
                      <p
                        className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-200"
                      >
                        {player.availability_reason}
                      </p>
                    )}
                    <div
                      className="mt-4 flex items-center gap-2 border-t pt-3 text-xs"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                      <span>
                        {teamFixtures.length
                          ? `${teamFixtures.length} upcoming fixture${teamFixtures.length === 1 ? '' : 's'}`
                          : player.professional_teams ? 'No upcoming fixture listed' : 'No team schedule available'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          className="overflow-hidden rounded-3xl border shadow-sm"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b p-5 sm:p-6" style={{ borderColor: 'var(--border)' }}>
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)', color: 'var(--accent-primary)' }}
              >
                <CalendarDays className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Upcoming squad fixtures</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Upcoming matches for your players&apos; professional teams.
                </p>
              </div>
            </div>
            {!fixtureLoading && schedule.length > 0 && (
              <div
                className="rounded-xl border px-3 py-2 text-right"
                style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
              >
                <p className="font-mono text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{schedule.length}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Matches</p>
              </div>
            )}
          </div>
          {fixtureError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 border-b p-4 text-sm"
              style={{
                borderColor: 'color-mix(in srgb, #f59e0b 25%, transparent)',
                background: 'color-mix(in srgb, #f59e0b 8%, transparent)',
                color: 'var(--text-primary)',
              }}
            >
              <p className="min-w-0 flex-1">{fixtureError}</p>
              <button
                type="button"
                onClick={() => {
                  const teamIds = [...new Set(ownedPlayers
                    .map((player) => player.professional_teams?.id)
                    .filter((teamId): teamId is number => teamId != null))];
                  void loadFixtures(teamIds);
                }}
                disabled={fixtureLoading}
                className="shrink-0 rounded-lg border border-amber-500/30 px-3 py-2 font-semibold text-amber-700 transition-colors hover:bg-amber-500/10 disabled:cursor-wait disabled:opacity-60 dark:text-amber-200"
              >
                {fixtureLoading ? 'Retrying…' : 'Retry fixtures'}
              </button>
            </div>
          )}
          {fixtureDifficultyError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 border-b p-4 text-sm"
              style={{
                borderColor: 'color-mix(in srgb, #f59e0b 25%, transparent)',
                background: 'color-mix(in srgb, #f59e0b 8%, transparent)',
                color: 'var(--text-primary)',
              }}
            >
              <p className="min-w-0 flex-1">{fixtureDifficultyError}</p>
              <button
                type="button"
                onClick={() => {
                  const teamIds = [...new Set(ownedPlayers
                    .map((player) => player.professional_teams?.id)
                    .filter((teamId): teamId is number => teamId != null))];
                  void loadFixtures(teamIds);
                }}
                disabled={fixtureLoading || fixtureDifficultyLoading}
                className="shrink-0 rounded-lg border border-amber-500/30 px-3 py-2 font-semibold text-amber-700 transition-colors hover:bg-amber-500/10 disabled:cursor-wait disabled:opacity-60 dark:text-amber-200"
              >
                Retry difficulty
              </button>
            </div>
          )}
          {fixtureDifficultyLoading && (
            <p
              role="status"
              className="border-b px-4 py-3 text-xs"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Loading opponent form…
            </p>
          )}
          {fixtureLoading && (
            <div role="status" aria-label="Loading upcoming fixtures" className="grid gap-3 p-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border p-4"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
                >
                  <div className="h-4 w-3/4 rounded bg-[var(--surface-muted)]" />
                  <div className="mt-3 h-3 w-1/2 rounded bg-[var(--surface-muted)]" />
                  <div className="mt-5 h-10 w-full rounded-xl bg-[var(--surface-muted)]" />
                </div>
              ))}
            </div>
          )}
          {!fixtureLoading && schedule.length === 0 ? (
            <div className="p-8 text-center">
              <span
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}
              >
                <CalendarDays className="h-5 w-5" />
              </span>
              <p className="mt-3 font-semibold" style={{ color: 'var(--text-primary)' }}>No upcoming fixtures</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                There are no scheduled matches for your squad&apos;s teams right now.
              </p>
            </div>
          ) : schedule.length > 0 ? (
            <ol className="space-y-3 p-4 sm:p-5">
              {schedule.map((match) => {
                const involvedPlayers = ownedPlayers.filter((player) =>
                  player.professional_teams?.id === match.team_a_id
                  || player.professional_teams?.id === match.team_b_id);
                const squadSides = [
                  {
                    teamId: match.team_a_id,
                    opponentId: match.team_b_id,
                    teamName: match.radiant_team?.name || 'Team TBA',
                    opponentName: match.dire_team?.name || 'Team TBA',
                  },
                  {
                    teamId: match.team_b_id,
                    opponentId: match.team_a_id,
                    teamName: match.dire_team?.name || 'Team TBA',
                    opponentName: match.radiant_team?.name || 'Team TBA',
                  },
                ].filter((side) => side.teamId !== null && involvedPlayers.some(
                  (player) => player.professional_teams?.id === side.teamId,
                ));
                return (
                  <li
                    key={match.id}
                    className="overflow-hidden rounded-2xl border shadow-xs transition-shadow hover:shadow-md"
                    style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-start gap-3 p-4">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                          color: 'var(--accent-primary)',
                        }}
                      >
                        <CalendarDays className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <time className="block text-xs font-semibold" style={{ color: 'var(--accent-primary)' }}>
                          {formatDate(match.scheduled_time)}
                        </time>
                        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                          <span className="truncate text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {match.radiant_team?.name || 'Team TBA'}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            vs
                          </span>
                          <span className="truncate text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {match.dire_team?.name || 'Team TBA'}
                          </span>
                        </div>
                        {match.tournaments?.name && (
                          <p className="mt-2 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                            {match.tournaments.name}
                          </p>
                        )}
                      </div>
                    </div>
                    {involvedPlayers.length > 0 && (
                      <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          Your squad in this match
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {involvedPlayers.map((player) => (
                            <span
                              key={player.id}
                              className="max-w-full truncate rounded-lg border px-2 py-1 text-[11px] font-medium"
                              style={{
                                borderColor: 'var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {displayName(player)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {squadSides.length > 0 && (
                      <div className="grid gap-2 border-t p-4 sm:grid-cols-2" style={{ borderColor: 'var(--border)' }}>
                        {squadSides.map((side) => (
                          <div
                            key={side.teamId}
                            className="flex min-w-0 items-center justify-between gap-2 rounded-xl border p-3"
                            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                          >
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                Your team vs
                              </p>
                              <p className="mt-1 truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {side.teamName} <span style={{ color: 'var(--text-muted)' }}>·</span> {side.opponentName}
                              </p>
                            </div>
                            <FixtureDifficultyBadge
                              difficulty={side.opponentId === null ? undefined : fixtureDifficultyByTeam.get(side.opponentId)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : null}
        </section>
      </div>
    </div>
  );
}
