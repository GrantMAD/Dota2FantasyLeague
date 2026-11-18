'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { canOptimizeImage } from '@/lib/optimized-image';
import Link from 'next/link';
import {
  Trophy,
  Plus,
  Hash,
  X,
  Copy,
  Check,
  ArrowLeftRight,
  BarChart3,
  Crown,
  Swords,
  Users,
  RefreshCw,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';
import type { LeagueRecord, StandingEntry, FixtureEntry } from './types';
import { LeagueHero } from './components/LeagueHero';
import { LeagueFilters } from './components/LeagueFilters';
import { LeagueCard } from './components/LeagueCard';
import { LeagueActionModal } from './components/LeagueActionModal';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';
import { replaceUrlQueryParams } from '@/lib/url-query-state';

type ActionMode = 'create' | 'join' | null;

interface LeagueActivityEntry {
  id: number;
  type: 'transfer' | 'captain_pick' | 'rank_change';
  createdAt: string;
  manager: string;
  gameweekNumber: number | null;
  fromRank: number | null;
  toRank: number | null;
  playersIn: string[];
  playersOut: string[];
  captain: string | null;
  viceCaptain: string | null;
}

function isLeagueActivityEntry(value: unknown): value is LeagueActivityEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const activity = value as Record<string, unknown>;
  return Number.isSafeInteger(activity.id)
    && (activity.type === 'transfer' || activity.type === 'captain_pick' || activity.type === 'rank_change')
    && typeof activity.createdAt === 'string'
    && !Number.isNaN(Date.parse(activity.createdAt))
    && typeof activity.manager === 'string'
    && (activity.gameweekNumber === null || Number.isInteger(activity.gameweekNumber))
    && (activity.fromRank === null || Number.isInteger(activity.fromRank))
    && (activity.toRank === null || Number.isInteger(activity.toRank))
    && Array.isArray(activity.playersIn)
    && activity.playersIn.every((player) => typeof player === 'string')
    && Array.isArray(activity.playersOut)
    && activity.playersOut.every((player) => typeof player === 'string')
    && (activity.captain === null || typeof activity.captain === 'string')
    && (activity.viceCaptain === null || typeof activity.viceCaptain === 'string');
}

function formatRelativeTime(value: string): string {
  const elapsedSeconds = Math.round((Date.now() - Date.parse(value)) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, seconds] of units) {
    if (Math.abs(elapsedSeconds) >= seconds) {
      return relativeTime.format(-Math.round(elapsedSeconds / seconds), unit);
    }
  }
  return relativeTime.format(-elapsedSeconds, 'second');
}

export default function LeaguesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <LeaguesPageContent />
    </Suspense>
  );
}

function LeaguesPageContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');
  const toast = useToast();
  const [tab, setTab] = useState<'classic' | 'h2h'>(initialTab === 'h2h' ? 'h2h' : 'classic');
  useEffect(() => {
    replaceUrlQueryParams({ tab: tab === 'classic' ? null : tab });
  }, [tab]);
  const [leagues, setLeagues] = useState<LeagueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRecalculatedAt, setLastRecalculatedAt] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // modal state
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  // detail modals
  const [selectedLeague, setSelectedLeague] = useState<LeagueRecord | null>(null);
  const [selectedUser, setSelectedUser] = useState<StandingEntry | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<FixtureEntry | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [leagueActivity, setLeagueActivity] = useState<LeagueActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const activityRequestId = useRef(0);
  const openedRequestedLeagueId = useRef<number | null>(null);
  const requestedLeagueId = Number(searchParams.get('leagueId'));

  const loadLeagueActivity = useCallback(async (leagueId: number) => {
    const requestId = ++activityRequestId.current;
    setActivityLoading(true);
    setActivityError(null);
    setLeagueActivity([]);
    try {
      const response = await fetchWithAuth(`/api/leagues/${leagueId}/activity`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load league activity.');
      if (!Array.isArray(body.activities) || !body.activities.every(isLeagueActivityEntry)) {
        throw new Error('League activity response was invalid.');
      }
      if (activityRequestId.current === requestId) setLeagueActivity(body.activities);
    } catch (error: unknown) {
      if (activityRequestId.current === requestId) {
        setActivityError(error instanceof Error ? error.message : 'Unable to load league activity.');
      }
    } finally {
      if (activityRequestId.current === requestId) setActivityLoading(false);
    }
  }, []);

  const openLeague = useCallback((league: LeagueRecord) => {
    setSelectedLeague(league);
    void loadLeagueActivity(league.id);
  }, [loadLeagueActivity]);

  const loadLeagues = useCallback(async (isBackgroundRefresh = false) => {
    try {
      if (isBackgroundRefresh) setRefreshing(true);
      else setLoading(true);
      setPageError(null);
      const res = await fetchWithAuth('/api/leagues');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load leagues');
      }
      const p = await res.json() as {
        leagues?: LeagueRecord[];
        data?: LeagueRecord[];
        lastRecalculatedAt?: string | null;
      };
      const loadedLeagues = p.leagues || p.data || [];
      setLeagues(loadedLeagues);
      setLastRecalculatedAt(p.lastRecalculatedAt ?? null);
      if (Number.isSafeInteger(requestedLeagueId) && requestedLeagueId > 0
        && openedRequestedLeagueId.current !== requestedLeagueId) {
        const requestedLeague = loadedLeagues.find((league) => league.id === requestedLeagueId);
        if (requestedLeague) {
          openedRequestedLeagueId.current = requestedLeagueId;
          openLeague(requestedLeague);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load leagues';
      setPageError(msg);
      if (!isBackgroundRefresh) setLeagues([]);
      if (!isBackgroundRefresh) toast.error('Load Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [openLeague, requestedLeagueId, toast]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadLeagues(), 0);
    const interval = window.setInterval(() => void loadLeagues(true), 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadLeagues]);

  const visibleLeagues = leagues.filter((l) => l.type === tab);
  const standings = visibleLeagues.flatMap((l) => l.standings ?? []).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const fixtures = visibleLeagues.flatMap((league) =>
    (league.fixtures ?? []).map((fixture) => ({
      ...fixture,
      leagueId: fixture.leagueId ?? league.id,
      leagueName: fixture.leagueName ?? league.name,
    }))
  );

  const heroLeague = [...visibleLeagues]
    .sort((a, b) => b.currentParticipants - a.currentParticipants)[0] ?? null;

  const onCreateLeague = async (form: {
    name: string;
    type: 'classic' | 'h2h';
    privacyLevel: 'public' | 'private';
    maxParticipants: number;
    description: string;
  }) => {
    if (isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await fetchWithAuth('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await res.json();
      if (res.ok) {
        setLeagues((cur) => [payload.data, ...cur]);
        toast.success('League Created', `${payload.data.name} is live! Share your invite code to get started.`);
        setActionMode(null);
      } else {
        const msg = payload.error || 'Failed to create league.';
        setCreateError(msg);
        toast.error('Could Not Create League', msg);
      }
    } catch {
      const msg = 'Network error while creating league.';
      setCreateError(msg);
      toast.error('Could Not Create League', msg);
    } finally {
      setIsCreating(false);
    }
  };

  const onJoinLeague = async (code: string) => {
    if (isJoining) return;
    setIsJoining(true);
    setJoinError(null);
    setJoinSuccess(null);
    try {
      const res = await fetchWithAuth('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', inviteCode: code }),
      });
      const payload = await res.json();
      if (res.ok) {
        setLeagues((cur) => {
          const exists = cur.some((l) => l.inviteCode === payload.data.inviteCode);
          if (exists) return cur.map((l) => (l.inviteCode === payload.data.inviteCode ? payload.data : l));
          return [payload.data, ...cur];
        });
        const msg = payload.message || `Successfully joined ${payload.data.name}!`;
        setJoinSuccess(msg);
        toast.success('Joined League', msg);
        setTimeout(() => {
          setJoinSuccess(null);
          setActionMode(null);
        }, 2500);
      } else {
        const msg = payload.error || 'Failed to join league.';
        setJoinError(msg);
        toast.error('Could Not Join League', msg);
      }
    } catch {
      const msg = 'Network error while joining league.';
      setJoinError(msg);
      toast.error('Could Not Join League', msg);
    } finally {
      setIsJoining(false);
    }
  };

  const closeActionModal = () => {
    setActionMode(null);
    setCreateError(null);
    setJoinError(null);
    setJoinSuccess(null);
  };

  const classicCount = leagues.filter((l) => l.type === 'classic').length;
  const h2hCount = leagues.filter((l) => l.type === 'h2h').length;

  return (
    <div data-tour="leagues-my-leagues" className="max-w-7xl mx-auto px-4 py-10">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300">
              Competitive Circuits
            </div>
            <DataFreshnessBadge page="leagues" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] flex items-center gap-3">
            <Trophy className="h-8 w-8 text-amber-500 dark:text-amber-400 shrink-0" />
            Leagues
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
            Classic rankings, private leagues, and head-to-head matchups powered by live pro match data.
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:max-w-[55%] xl:justify-end">
          <button
            type="button"
            onClick={() => void loadLeagues(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--text-muted)] shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
            title="Refresh league standings"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            data-tour="leagues-join"
            type="button"
            onClick={() => setActionMode('join')}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--text-muted)] shadow-xs"
          >
            <Hash className="h-4 w-4" />
            Join with Code
          </button>
          <button
            data-tour="leagues-create"
            type="button"
            onClick={() => setActionMode('create')}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-600 dark:text-amber-300 transition hover:border-amber-400 hover:bg-amber-500/15"
          >
            <Plus className="h-4 w-4" />
            Create League
          </button>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition hover:border-[var(--text-muted)] shadow-xs"
          >
            <BarChart3 className="h-4 w-4" />
            Leaderboard
          </Link>
        </div>
      </div>
      <p className="-mt-5 mb-6 text-xs text-[var(--text-muted)]" aria-live="polite">
        Standings last recalculated:{' '}
        {lastRecalculatedAt
          ? new Date(lastRecalculatedAt).toLocaleString()
          : 'No completed recalculation recorded'}
        {' · '}Auto-refreshes every minute
      </p>

      {/* ── Tabs (Always visible) ─────────────────────────────────── */}
      <LeagueFilters
        activeTab={tab}
        onTabChange={setTab}
        classicCount={classicCount}
        h2hCount={h2hCount}
      />

      {/* ── Loading Skeleton ──────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-6">
          <div className="animate-pulse rounded-3xl border border-[var(--border)] bg-[var(--surface-raised)] p-6">
            <div className="mb-4 h-6 w-48 rounded bg-[var(--surface)]" />
            <div className="mb-3 h-10 w-72 rounded bg-[var(--surface)]" />
            <div className="h-4 w-full rounded bg-[var(--surface)]" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-5">
                <div className="mb-4 h-4 w-40 rounded bg-[var(--surface)]" />
                <div className="h-24 rounded bg-[var(--surface)]" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {pageError && (
            <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200">
              {pageError}
            </div>
          )}

          {/* ── Hero Banner ──────────────────────────────────────────── */}
          {heroLeague && (
            <LeagueHero
              league={heroLeague}
              onOpen={() => openLeague(heroLeague)}
            />
          )}

          {/* ── No Leagues Empty State ───────────────────────────────── */}
          {leagues.length === 0 && (
            <div className="mb-8 rounded-3xl border border-dashed border-amber-500/30 bg-amber-500/4 px-8 py-14 text-center">
              <Trophy className="mx-auto mb-4 h-12 w-12 text-amber-400/50" />
              <h2 className="mb-2 text-xl font-bold text-white">No Leagues Yet</h2>
              <p className="mb-6 text-sm text-[var(--text-secondary)]">Create your first league or join an existing one with an invite code.</p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActionMode('create')}
                  className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Create a League
                </button>
                <button
                  type="button"
                  onClick={() => setActionMode('join')}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)] shadow-xs"
                >
                  <Hash className="h-4 w-4" />
                  Join with Code
                </button>
              </div>
            </div>
          )}

          {leagues.length > 0 && (
            <>

              {/* ── League Cards Grid ─────────────────────────────────── */}
              {visibleLeagues.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-raised)] px-6 py-12 text-center text-[var(--text-muted)]">
                  No {tab === 'classic' ? 'classic' : 'head-to-head'} leagues found.
                </div>
              ) : (
                <div className={`grid gap-4 ${visibleLeagues.length === 1 ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
                  {visibleLeagues.map((league) => (
                    <LeagueCard
                      key={league.id}
                      league={league}
                      onClick={() => openLeague(league)}
                    />
                  ))}
                </div>
              )}

              {/* ── Standings / Fixtures Section ─────────────────────── */}
              {tab === 'classic' && standings.length > 0 && (
                <div className="mt-10">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--text-primary)]">
                      <Trophy className="h-5 w-5 text-amber-400" />
                      Consolidated Standings
                    </h2>
                    <span className="text-xs text-amber-400">Click a manager to view profile</span>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-[var(--border)] bg-[var(--surface-raised)] text-xs uppercase text-[var(--text-muted)]">
                        <tr>
                          <th className="px-5 py-3.5">Rank</th>
                          <th className="px-5 py-3.5">Manager</th>
                          <th className="px-5 py-3.5 text-right">GW Pts</th>
                          <th className="px-5 py-3.5 text-right">Total Pts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                        {standings.map((entry, idx) => {
                          const rank = entry.rank ?? idx + 1;
                          return (
                            <tr
                              key={`${entry.manager}-${idx}`}
                              onClick={() => setSelectedUser(entry)}
                              className="cursor-pointer transition-colors hover:bg-[var(--surface-muted)] group"
                            >
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                                    rank === 2 ? 'bg-slate-400/10 text-slate-300 border border-slate-600' :
                                      rank === 3 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/40' :
                                        'text-[var(--text-muted)]'
                                  }`}>
                                  #{rank}
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-raised)]">
                                    {entry.avatarUrl ? (
                                      <Image
                                        src={entry.avatarUrl}
                                        alt=""
                                        width={32}
                                        height={32}
                                        unoptimized={!canOptimizeImage(entry.avatarUrl)}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-xs font-bold text-[var(--text-secondary)]">
                                        {(entry.manager || '?').substring(0, 1).toUpperCase()}
                                      </span>
                                    )}
                                  </span>
                                  <span className="font-semibold text-white transition-colors group-hover:text-amber-400">
                                    {entry.manager}
                                  </span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono text-[var(--text-secondary)]">{entry.gwPoints ?? 0}</td>
                              <td className="px-5 py-3.5 text-right font-mono font-bold text-white">{entry.points} pts</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'h2h' && fixtures.length > 0 && (
                <div className="mt-10">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                      <Swords className="h-5 w-5 text-sky-400" />
                      Matchup Arena
                    </h2>
                    <span className="text-xs text-[var(--text-muted)]">Gameweek points · click a matchup for details</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {fixtures.map((fixture) => (
                      <button
                        key={`${fixture.leagueId}-${fixture.id}`}
                        type="button"
                        onClick={() => setSelectedFixture(fixture)}
                        aria-label={`View ${fixture.home} versus ${fixture.away}, Gameweek ${fixture.gameweekId}, ${fixture.isBye ? 'bye' : fixture.winnerId ? 'final' : 'in progress or pending'}`}
                        className="group w-full cursor-pointer overflow-hidden rounded-2xl border border-violet-500/25 bg-[var(--surface)] text-left shadow-lg transition-all hover:border-violet-400/60 hover:shadow-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-violet-500/5 px-4 py-2">
                          <div className="min-w-0">
                            <span className="block truncate text-xs font-bold text-[var(--text-primary)]" title={fixture.leagueName}>
                              {fixture.leagueName}
                            </span>
                            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-violet-800 dark:text-violet-300">
                              Gameweek {fixture.gameweekId}
                            </span>
                          </div>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${fixture.isBye
                              ? 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]'
                              : fixture.winnerId
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                            }`}>
                            {fixture.isBye ? 'Bye' : fixture.winnerId ? 'Final' : 'In progress / pending'}
                          </span>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4">
                          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-raised)]">
                              {fixture.homeAvatarUrl ? (
                                <Image src={fixture.homeAvatarUrl} alt="" width={48} height={48} unoptimized={!canOptimizeImage(fixture.homeAvatarUrl)} className="h-full w-full object-cover" />
                              ) : (
                                <span className="font-bold text-[var(--text-secondary)]">{fixture.home.substring(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                            <span className="w-full truncate text-sm font-semibold text-[var(--text-primary)]">{fixture.home}</span>
                            <span className="font-mono text-2xl font-black text-[var(--text-primary)]">{fixture.homePoints}</span>
                          </div>
                          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-violet-800 dark:text-violet-300">
                            {fixture.isBye ? 'Bye' : 'VS'}
                          </span>
                          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-raised)]">
                              {fixture.awayAvatarUrl ? (
                                <Image src={fixture.awayAvatarUrl} alt="" width={48} height={48} unoptimized={!canOptimizeImage(fixture.awayAvatarUrl)} className="h-full w-full object-cover" />
                              ) : (
                                <span className="font-bold text-[var(--text-secondary)]">{fixture.away.substring(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                            <span className="w-full truncate text-sm font-semibold text-[var(--text-primary)]">{fixture.away}</span>
                            <span className="font-mono text-2xl font-black text-[var(--text-primary)]">{fixture.awayPoints}</span>
                          </div>
                        </div>
                        <p className="px-4 pb-3 text-center text-[10px] text-[var(--text-muted)]">Fantasy points recorded for this matchup</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Create / Join Modal ───────────────────────────────────── */}
      {actionMode && (
        <LeagueActionModal
          mode={actionMode}
          onClose={closeActionModal}
          onCreate={onCreateLeague}
          onJoin={onJoinLeague}
          isLoading={actionMode === 'create' ? isCreating : isJoining}
          error={actionMode === 'create' ? createError : joinError}
          successMessage={actionMode === 'join' ? joinSuccess : null}
        />
      )}

      {/* ── League Detail Modal ───────────────────────────────────── */}
      {selectedLeague && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl no-scrollbar">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-raised)]/95 p-6 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${selectedLeague.type === 'h2h'
                        ? 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      }`}>
                      {selectedLeague.type === 'h2h' ? 'Head-to-Head' : 'Classic League'}
                    </span>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] capitalize text-[var(--text-secondary)]">
                      {selectedLeague.privacyLevel}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-[var(--text-primary)]">{selectedLeague.name}</h2>
                  {selectedLeague.description && (
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedLeague.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    activityRequestId.current += 1;
                    setSelectedLeague(null);
                  }}
                  className="shrink-0 rounded-xl p-2 text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Quick Stats */}
              <div className="mb-6 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-center shadow-xs">
                  <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    <Users className="h-3 w-3" /> Managers
                  </div>
                  <div className="text-xl font-black text-[var(--text-primary)]">{selectedLeague.currentParticipants}<span className="text-sm font-normal text-[var(--text-muted)]">/{selectedLeague.maxParticipants}</span></div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-center shadow-xs">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Scoring</div>
                  <div className="text-sm font-bold text-amber-600 dark:text-amber-400">{selectedLeague.type === 'h2h' ? 'Weekly Wins' : 'Total Points'}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-center shadow-xs">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Invite Code</div>
                  {selectedLeague.inviteCode ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-mono text-sm font-bold text-[var(--text-primary)]">{selectedLeague.inviteCode}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigator.clipboard.writeText(selectedLeague.inviteCode);
                          setCopiedInvite(true);
                          toast.info('Copied to Clipboard', `Invite code ${selectedLeague.inviteCode} copied.`);
                          setTimeout(() => setCopiedInvite(false), 2000);
                        }}
                        className="rounded p-1 text-[var(--text-muted)] hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                      >
                        {copiedInvite ? <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-[var(--text-muted)]">N/A</span>
                  )}
                </div>
              </div>

              {/* Standings Table */}
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
                  <Trophy className="h-4 w-4 text-amber-500 dark:text-amber-400" /> League Standings
                </h3>
                {(!selectedLeague.standings || selectedLeague.standings.length === 0) ? (
                  <p className="text-sm text-[var(--text-muted)]">No participants registered yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
                    <table className="min-w-[35rem] w-full text-left text-sm">
                      <thead className="border-b border-[var(--border)] bg-[var(--surface-raised)] text-xs uppercase text-[var(--text-primary)] font-semibold">
                        <tr>
                          <th className="px-4 py-3 text-white">Rank</th>
                          <th className="px-4 py-3 text-white">Manager</th>
                          {selectedLeague.type === 'h2h' && <th className="px-4 py-3 text-center text-white">W-L-D</th>}
                          {selectedLeague.type === 'h2h' && <th className="px-4 py-3 text-right text-white">League Pts</th>}
                          <th className="px-4 py-3 text-right text-white">GW Pts</th>
                          <th className="px-4 py-3 text-right text-white">{selectedLeague.type === 'h2h' ? 'Fantasy Total' : 'Total'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                        {[...selectedLeague.standings]
                          .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)
                            || (b.scoreDifference ?? 0) - (a.scoreDifference ?? 0)
                            || (b.h2hPointsFor ?? 0) - (a.h2hPointsFor ?? 0)
                            || a.manager.localeCompare(b.manager))
                          .map((p, idx) => {
                            const rank = p.rank ?? idx + 1;
                            return (
                              <tr
                                key={`${p.manager}-${idx}`}
                                onClick={() => setSelectedUser(p)}
                                className="cursor-pointer transition-colors hover:bg-[var(--surface-muted)] group"
                              >
                                <td className="px-4 py-3">
                                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                                      rank === 2 ? 'bg-slate-400/10 text-slate-300 border border-slate-600' :
                                        rank === 3 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/40' :
                                          'text-[var(--text-muted)]'
                                    }`}>
                                    #{rank}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-white group-hover:text-amber-400 transition-colors">{p.manager}</td>
                                {selectedLeague.type === 'h2h' && (
                                  <td className="px-4 py-3 text-center font-mono text-xs text-[var(--text-secondary)]">{p.wins}W-{p.losses}L-{p.draws}D</td>
                                )}
                                {selectedLeague.type === 'h2h' && (
                                  <td className="px-4 py-3 text-right font-mono font-bold text-violet-300">{p.leaguePoints ?? 0}</td>
                                )}
                                <td className="px-4 py-3 text-right font-mono text-xs text-[var(--text-secondary)]">{p.gwPoints ?? 0}</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-white">{p.points} pts</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-6">
                  <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
                    <Activity className="h-4 w-4 text-sky-400" /> League Activity
                  </h3>
                  {activityLoading ? (
                    <div className="space-y-3 animate-pulse" role="status" aria-label="Loading recent activity">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 py-2">
                          <div className="h-8 w-8 rounded-full bg-[var(--surface-raised)] shrink-0" />
                          <div className="space-y-1.5 flex-1">
                            <div className="h-3.5 w-3/4 rounded bg-[var(--surface-raised)]" />
                            <div className="h-2.5 w-1/4 rounded bg-[var(--surface-raised)]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : activityError ? (
                    <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-900 bg-red-950/60 p-3">
                      <p className="text-sm text-red-200">{activityError}</p>
                      <button
                        type="button"
                        onClick={() => void loadLeagueActivity(selectedLeague.id)}
                        className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                      >
                        Retry
                      </button>
                    </div>
                  ) : leagueActivity.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-raised)] p-4 text-center text-sm text-[var(--text-muted)]">
                      No league activity yet.
                    </p>
                  ) : (
                    <ol className="relative max-h-80 space-y-1 overflow-y-auto pr-1">
                      <span aria-hidden="true" className="absolute bottom-5 left-[15px] top-5 w-px bg-[var(--border)]" />
                      {leagueActivity.map((activity) => {
                        let description: string;
                        const Icon = activity.type === 'transfer'
                          ? ArrowLeftRight
                          : activity.type === 'captain_pick'
                            ? Crown
                            : TrendingUp;
                        if (activity.type === 'transfer') {
                          const incoming = activity.playersIn.join(', ');
                          const outgoing = activity.playersOut.join(', ');
                          description = `Transferred ${incoming || 'players'}${outgoing ? ` in for ${outgoing}` : ''}`;
                        } else if (activity.type === 'captain_pick') {
                          description = `Captain: ${activity.captain ?? 'not set'} · Vice-captain: ${activity.viceCaptain ?? 'not set'}`;
                        } else {
                          description = activity.fromRank === null
                            ? `Joined the rankings at #${activity.toRank ?? '?'}`
                            : `Moved from #${activity.fromRank} to #${activity.toRank ?? '?'}`;
                        }
                        return (
                          <li key={activity.id} className="relative flex gap-3 py-2">
                            <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${activity.type === 'transfer'
                                ? 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                                : activity.type === 'captain_pick'
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                  : 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                              }`}>
                              <Icon className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5">
                              <p className="text-sm leading-5 text-[var(--text-secondary)]">
                                <span className="font-semibold text-[var(--text-primary)]">{activity.manager}</span> {description}
                              </p>
                              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-muted)]">
                                <span>{activity.gameweekNumber === null ? 'League update' : `Gameweek ${activity.gameweekNumber}`}</span>
                                <span aria-hidden="true">·</span>
                                <time dateTime={activity.createdAt} title={new Date(activity.createdAt).toLocaleString()}>
                                  {formatRelativeTime(activity.createdAt)}
                                </time>
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              </div>

              {/* H2H Fixtures in detail modal */}
              {selectedLeague.type === 'h2h' && (
                <div className="mb-4">
                  <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-white">
                    <Swords className="h-4 w-4 text-sky-400" /> Matchups &amp; Fixtures
                  </h3>
                  {(!selectedLeague.fixtures || selectedLeague.fixtures.length === 0) ? (
                    <p className="text-sm text-[var(--text-muted)]">No fixtures generated yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedLeague.fixtures.map((fixture) => (
                        <button
                          key={fixture.id}
                          type="button"
                          onClick={() => setSelectedFixture({ ...fixture, leagueName: selectedLeague.name })}
                          aria-label={`View ${fixture.home} versus ${fixture.away}, Gameweek ${fixture.gameweekId}, ${fixture.isBye ? 'bye' : fixture.winnerId ? 'final' : 'in progress or pending'}`}
                          className="group w-full cursor-pointer overflow-hidden rounded-2xl border border-violet-500/25 bg-[var(--surface)] text-left shadow-sm transition-all hover:border-violet-400/60 hover:bg-[var(--surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        >
                          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-violet-500/5 px-3.5 py-2">
                            <div className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-[var(--text-primary)]">
                                {selectedLeague.name}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-violet-800 dark:text-violet-300">
                                Gameweek {fixture.gameweekId}
                              </span>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${fixture.isBye
                                ? 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]'
                                : fixture.winnerId
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                                  : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                              }`}>
                              {fixture.isBye ? 'Bye' : fixture.winnerId ? 'Final' : 'In progress / pending'}
                            </span>
                          </div>
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3.5 py-4">
                            <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-raised)]">
                                {fixture.homeAvatarUrl ? (
                                  <Image src={fixture.homeAvatarUrl} alt="" width={40} height={40} unoptimized={!canOptimizeImage(fixture.homeAvatarUrl)} className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-xs font-bold text-[var(--text-secondary)]">{fixture.home.substring(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <span className="w-full truncate text-xs font-semibold text-[var(--text-primary)]">{fixture.home}</span>
                              <span className="font-mono text-xl font-black text-[var(--text-primary)]">{fixture.homePoints}</span>
                            </div>
                            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-violet-800 dark:text-violet-300">
                              {fixture.isBye ? 'Bye' : 'VS'}
                            </span>
                            <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-raised)]">
                                {fixture.awayAvatarUrl ? (
                                  <Image src={fixture.awayAvatarUrl} alt="" width={40} height={40} unoptimized={!canOptimizeImage(fixture.awayAvatarUrl)} className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-xs font-bold text-[var(--text-secondary)]">{fixture.away.substring(0, 2).toUpperCase()}</span>
                                )}
                              </div>
                              <span className="w-full truncate text-xs font-semibold text-[var(--text-primary)]">{fixture.away}</span>
                              <span className="font-mono text-xl font-black text-[var(--text-primary)]">{fixture.awayPoints}</span>
                            </div>
                          </div>
                          <p className="border-t border-[var(--border)] px-3.5 py-2 text-center text-[10px] text-[var(--text-muted)]">
                            {fixture.isBye ? 'Bye round · automatic win' : 'Fantasy points recorded for this matchup'}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Manager Details Modal ─────────────────────────────────── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl p-6 no-scrollbar">
            <div className="border-b border-[var(--border)] pb-5">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-[var(--surface-muted)] border-2 border-amber-500/50 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  {selectedUser.avatarUrl ? (
                    <Image src={selectedUser.avatarUrl} alt={selectedUser.manager} width={56} height={56} unoptimized={!canOptimizeImage(selectedUser.avatarUrl)} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-amber-400">
                      {(selectedUser.displayName || selectedUser.username || selectedUser.manager).substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white">{selectedUser.manager}</h2>
                    {selectedUser.rank && (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">
                        Rank #{selectedUser.rank}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    @{selectedUser.username || selectedUser.manager.toLowerCase().replace(/\s+/g, '_')}
                  </p>
                </div>
              </div>
              {selectedUser.bio && (
                <p className="mt-4 text-sm text-[var(--text-secondary)] bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-3 italic">
                  &quot;{selectedUser.bio}&quot;
                </p>
              )}
            </div>

            <div className="my-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">League Performance</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Total Pts</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-amber-400">{selectedUser.points}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">GW Pts</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-[var(--text-primary)]">{selectedUser.gwPoints ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Rank</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-white">#{selectedUser.rank ?? '—'}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
                  <div className="text-[11px] text-[var(--text-muted)] uppercase">Wins</div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-emerald-400">{selectedUser.wins}</div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
                  <div className="text-[11px] text-[var(--text-muted)] uppercase">Losses</div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-red-400">{selectedUser.losses}</div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-center">
                  <div className="text-[11px] text-[var(--text-muted)] uppercase">Draws</div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-[var(--text-primary)]">{selectedUser.draws}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-5 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── H2H Fixture Detail Modal ──────────────────────────────── */}
      {selectedFixture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl p-6 no-scrollbar">
            <div className="border-b border-[var(--border)] pb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">
                  Gameweek {selectedFixture.gameweekId}
                </span>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${selectedFixture.isBye ? 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]'
                    : selectedFixture.winnerId ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                  }`}>
                  {selectedFixture.isBye ? 'Bye Round' : selectedFixture.winnerId ? 'Final Result' : 'Live / Scheduled'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Head-to-Head Matchup</h2>
                  {selectedFixture.leagueName && <p className="text-xs text-[var(--text-muted)] mt-0.5">{selectedFixture.leagueName}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFixture(null)}
                  className="rounded-xl p-2 text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Score card */}
            <div className="my-6 rounded-3xl border border-[var(--border)] bg-[var(--surface-raised)] p-6">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                {/* Home */}
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 rounded-full bg-[var(--surface-muted)] border-2 border-[var(--border)] flex items-center justify-center overflow-hidden mb-2 shadow-inner">
                    {selectedFixture.homeAvatarUrl ? (
                      <Image src={selectedFixture.homeAvatarUrl} alt={selectedFixture.home} width={64} height={64} unoptimized={!canOptimizeImage(selectedFixture.homeAvatarUrl)} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-amber-700 dark:text-amber-300">{selectedFixture.home.substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <h4 className="font-bold text-[var(--text-primary)] text-base leading-snug">{selectedFixture.home}</h4>
                  {selectedFixture.homeUsername && <span className="text-[11px] text-[var(--text-muted)]">@{selectedFixture.homeUsername}</span>}
                  <div className="mt-3">
                    <span className="font-mono text-3xl font-black text-[var(--text-primary)]">{selectedFixture.homePoints}</span>
                    <span className="text-xs text-[var(--text-muted)] ml-1">pts</span>
                  </div>
                  <div className="mt-2 flex min-h-5 items-center justify-center">
                    {selectedFixture.winnerId && selectedFixture.homePoints > selectedFixture.awayPoints && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                        Winner (+3 pts)
                      </span>
                    )}
                  </div>
                </div>

                {/* VS */}
                <div className="flex flex-col items-center px-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/20 font-black text-amber-800 dark:text-amber-300 text-sm">VS</span>
                  <div className="text-[11px] text-[var(--text-muted)] mt-2 font-mono">
                    {selectedFixture.homePoints === selectedFixture.awayPoints
                      ? 'Tied'
                      : `Δ ${Math.abs(Number((selectedFixture.homePoints - selectedFixture.awayPoints).toFixed(1)))}`}
                  </div>
                </div>

                {/* Away */}
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 rounded-full bg-[var(--surface-muted)] border-2 border-[var(--border)] flex items-center justify-center overflow-hidden mb-2 shadow-inner">
                    {selectedFixture.awayAvatarUrl ? (
                      <Image src={selectedFixture.awayAvatarUrl} alt={selectedFixture.away} width={64} height={64} unoptimized={!canOptimizeImage(selectedFixture.awayAvatarUrl)} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-[var(--text-secondary)]">{selectedFixture.away.substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <h4 className="font-bold text-[var(--text-primary)] text-base leading-snug">{selectedFixture.away}</h4>
                  {selectedFixture.awayUsername && <span className="text-[11px] text-[var(--text-muted)]">@{selectedFixture.awayUsername}</span>}
                  <div className="mt-3">
                    <span className="font-mono text-3xl font-black text-[var(--text-primary)]">{selectedFixture.awayPoints}</span>
                    <span className="text-xs text-[var(--text-muted)] ml-1">pts</span>
                  </div>
                  <div className="mt-2 flex min-h-5 items-center justify-center">
                    {selectedFixture.winnerId && selectedFixture.awayPoints > selectedFixture.homePoints && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
                        Winner (+3 pts)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Info strip */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 space-y-2 text-xs text-[var(--text-secondary)]">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)]">Matchup Type</span>
                <span className="font-medium text-[var(--text-primary)]">Head-to-Head Gameweek Duel</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)]">Scoring Model</span>
                <span className="font-medium text-[var(--text-primary)]">3pts Win · 1pt Draw · 0 Loss</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-muted)]">Status</span>
                <span className={`font-semibold ${selectedFixture.isBye ? 'text-[var(--text-muted)]' : selectedFixture.winnerId ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  {selectedFixture.isBye ? 'Bye (Auto Win)' : selectedFixture.winnerId ? 'Score Finalized' : 'In Progress / Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
