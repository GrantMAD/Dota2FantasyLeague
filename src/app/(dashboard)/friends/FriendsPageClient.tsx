'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeftRight,
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Flame,
  History,
  LoaderCircle,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

import type { FriendProfile, FriendActivity } from '@/types/friends';
import { FriendAvatar, FriendProgressModal } from '@/components/friends/FriendProgressModal';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function displayName(user: Pick<FriendProfile, 'username' | 'display_name'>) {
  return user.display_name?.trim() || user.username;
}

function formatPoints(value: number | string) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatRelativeTime(value: string) {
  const elapsedSeconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, seconds] of units) {
    if (elapsedSeconds >= seconds) return formatter.format(-Math.floor(elapsedSeconds / seconds), unit);
  }
  return formatter.format(-elapsedSeconds, 'second');
}

function ActivityCard({
  activity,
  isExpanded,
  onToggleExpand,
  onOpenManager,
}: {
  activity: FriendActivity;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenManager: (userId: string) => void;
}) {
  const rankChange = activity.previous_gameweek_rank !== null && activity.gameweek_rank !== null
    ? activity.previous_gameweek_rank - activity.gameweek_rank
    : null;

  const config = useMemo(() => {
    switch (activity.activity_type) {
      case 'transfer':
        return {
          icon: ArrowLeftRight,
          label: 'Squad Transfer',
          borderAccent: 'border-l-emerald-500',
          badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
          iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        };
      case 'chip':
        return {
          icon: Sparkles,
          label: 'Chip Activated',
          borderAccent: 'border-l-purple-500',
          badgeBg: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20',
          iconBg: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
        };
      case 'lineup':
        return {
          icon: ClipboardList,
          label: 'Lineup Update',
          borderAccent: 'border-l-cyan-500',
          badgeBg: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20',
          iconBg: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
        };
      case 'gameweek_score':
      default:
        return {
          icon: Trophy,
          label: 'Gameweek Result',
          borderAccent: 'border-l-amber-500',
          badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
          iconBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        };
    }
  }, [activity.activity_type]);

  const Icon = config.icon;

  return (
    <article
      id={`activity-${activity.activity_id}`}
      className={`group relative overflow-hidden rounded-2xl border border-[var(--border)] border-l-4 ${config.borderAccent} bg-[var(--surface-raised)] shadow-sm transition hover:border-[var(--border-strong)] hover:shadow-md`}
    >
      {/* Clickable Header that toggles expand/collapse */}
      <div
        onClick={onToggleExpand}
        className="flex items-start justify-between gap-3 p-4 sm:p-5 cursor-pointer select-none transition-colors hover:bg-[var(--surface)]/50"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${activity.title} by ${displayName(activity)}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative shrink-0">
            <FriendAvatar
              user={{
                username: activity.username,
                display_name: activity.display_name,
                avatar_url: activity.avatar_url,
              }}
            />
            <span
              className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ${config.iconBg} ring-2 ring-[var(--surface-raised)]`}
              title={config.label}
            >
              <Icon className="h-2.5 w-2.5" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenManager(activity.user_id);
                }}
                className="font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)] hover:underline truncate cursor-pointer text-left"
              >
                {displayName(activity)}
              </button>
              <span className="text-xs text-[var(--text-muted)] truncate">@{activity.username}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${config.badgeBg}`}>
                {config.label}
              </span>
              {activity.gameweek_number && (
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  GW {activity.gameweek_number}
                </span>
              )}
              {/* Compact Preview Title when collapsed */}
              <span className="text-xs text-[var(--text-primary)] font-medium truncate max-w-[200px] sm:max-w-xs">
                · {activity.title}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <time className="text-xs text-[var(--text-muted)] font-medium whitespace-nowrap" dateTime={activity.updated_at}>
            {formatRelativeTime(activity.updated_at)}
          </time>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--text-muted)] transition-colors group-hover:bg-[var(--surface)] group-hover:text-[var(--text-primary)]">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {/* Main Content Payload by Activity Type (Visible only when isExpanded) */}
      {isExpanded && (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-3.5 border-t border-[var(--border)]">
        {/* TRANSFER TYPE */}
        {activity.activity_type === 'transfer' && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{activity.title}</p>
            {((activity.players_out && activity.players_out.length > 0) || (activity.players_in && activity.players_in.length > 0)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* Players Out */}
                {activity.players_out && activity.players_out.length > 0 && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-950/20 p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      <ArrowDown className="h-3 w-3" />
                      <span>Transferred Out</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {activity.players_out.map((player) => (
                        <span
                          key={`out-${player}`}
                          className="inline-flex items-center rounded-lg bg-rose-500/15 px-2 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300"
                        >
                          {player}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Players In */}
                {activity.players_in && activity.players_in.length > 0 && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <ArrowUp className="h-3 w-3" />
                      <span>Transferred In</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {activity.players_in.map((player) => (
                        <span
                          key={`in-${player}`}
                          className="inline-flex items-center rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                        >
                          {player}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CHIP TYPE */}
        {activity.activity_type === 'chip' && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/20 p-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-[var(--text-primary)] truncate">{activity.title}</p>
                <p className="text-xs text-[var(--text-muted)]">Active for {activity.season_name} · GW {activity.gameweek_number}</p>
              </div>
            </div>
            {activity.chip && (
              <span className="shrink-0 rounded-lg bg-purple-500/20 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                {activity.chip}
              </span>
            )}
          </div>
        )}

        {/* LINEUP TYPE */}
        {activity.activity_type === 'lineup' && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{activity.title}</p>
            {activity.lineup_changes?.length ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5">
                <div className="space-y-1.5">
                  {activity.lineup_changes.map((change) => (
                    <div key={change.slot} className="flex items-center justify-between text-xs gap-2">
                      <span className="font-semibold uppercase tracking-wider text-[var(--text-muted)] shrink-0 w-24">
                        {change.slot}
                      </span>
                      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                        <span className="text-[var(--text-muted)] truncate">{change.from ?? 'Empty'}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-[var(--accent-primary)]" />
                        <span className="font-bold text-[var(--text-primary)] truncate">{change.to ?? 'Empty'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic">Detailed player changes are not available for this lineup update.</p>
            )}
          </div>
        )}

        {/* GAMEWEEK SCORE TYPE */}
        {activity.activity_type === 'gameweek_score' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/20 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  {activity.season_name} · Gameweek {activity.gameweek_number}
                </p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-extrabold text-[var(--text-primary)]">
                    {activity.gameweek_points !== null ? formatPoints(activity.gameweek_points) : '--'}
                  </span>
                  <span className="text-xs font-medium text-[var(--text-muted)]">points</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:justify-end flex-wrap">
              {activity.gameweek_rank && (
                <div className="rounded-lg bg-[var(--surface)] px-2.5 py-1 text-xs border border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">GW Rank: </span>
                  <span className="font-bold text-[var(--text-primary)]">#{activity.gameweek_rank.toLocaleString()}</span>
                </div>
              )}
              {rankChange !== null && rankChange !== 0 && (
                <div
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${
                    rankChange > 0
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {rankChange > 0 ? (
                    <>
                      <TrendingUp className="h-3 w-3" />
                      <span>+{rankChange.toLocaleString()}</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3" />
                      <span>{rankChange.toLocaleString()}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer: Manager Profile Quick Action Link */}
        <div className="mt-3.5 pt-2.5 flex items-center justify-between text-xs text-[var(--text-muted)] border-t border-[var(--border)]">
          <span className="truncate">{activity.season_name}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenManager(activity.user_id);
            }}
            className="flex items-center gap-1 font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer group-hover:translate-x-0.5 transition-transform"
          >
            <span>View Manager</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      )}
    </article>
  );
}



export default function FriendsPageClient() {
  const searchParams = useSearchParams();
  const targetActivityId = searchParams.get('activityId');

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FriendProfile[]>([]);
  const [following, setFollowing] = useState<FriendProfile[]>([]);
  const [activities, setActivities] = useState<FriendActivity[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isRecentSectionOpen, setIsRecentSectionOpen] = useState(true);
  const [isOlderSectionOpen, setIsOlderSectionOpen] = useState(true);

  const [workingUserId, setWorkingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedManager, setSelectedManager] = useState<FriendProfile | null>(null);

  const scrolledRef = useRef(false);

  const toggleExpand = (activityId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  };

  const followingIds = useMemo(() => new Set(following.map((user) => user.id)), [following]);
  const normalizedSearch = search.trim();

  const [feedTimestamp, setFeedTimestamp] = useState<number | null>(null);

  const { recentActivities, olderActivities } = useMemo(() => {
    const referenceTime = feedTimestamp ?? 0;
    const recent: FriendActivity[] = [];
    const older: FriendActivity[] = [];

    for (const activity of activities) {
      const timestamp = new Date(activity.updated_at).getTime();
      if (referenceTime - timestamp <= THREE_DAYS_MS) {
        recent.push(activity);
      } else {
        older.push(activity);
      }
    }

    return { recentActivities: recent, olderActivities: older };
  }, [activities, feedTimestamp]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      try {
        const [followingResponse, feedResponse] = await Promise.all([
          fetchWithAuth('/api/friends'),
          fetchWithAuth('/api/friends/feed'),
        ]);
        const [followingData, feedData] = await Promise.all([
          followingResponse.json(),
          feedResponse.json(),
        ]) as [
          { following?: FriendProfile[]; error?: string },
          { activities?: FriendActivity[]; nextCursor?: string | null; error?: string },
        ];
        if (!followingResponse.ok) throw new Error(followingData.error || 'Unable to load your following list.');
        if (!feedResponse.ok) throw new Error(feedData.error || 'Unable to load friend activity.');
        if (cancelled) return;
        setFollowing(followingData.following ?? []);
        const loadedActivities = feedData.activities ?? [];
        setActivities(loadedActivities);
        setFeedTimestamp(Date.now());
        setNextCursor(feedData.nextCursor ?? null);

        if (targetActivityId && !scrolledRef.current) {
          const target = loadedActivities.find((a) => a.activity_id === targetActivityId);
          if (target) {
            setExpandedIds(new Set([targetActivityId]));
            const now = Date.now();
            const isOlder = now - new Date(target.updated_at).getTime() > THREE_DAYS_MS;
            if (isOlder) {
              setIsOlderSectionOpen(true);
            } else {
              setIsRecentSectionOpen(true);
            }
            scrolledRef.current = true;
            setTimeout(() => {
              const el = document.getElementById(`activity-${targetActivityId}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 100);
          }
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load friends.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialData();
    return () => { cancelled = true; };
  }, [targetActivityId]);

  useEffect(() => {
    let cancelled = false;
    if (normalizedSearch.replace(/\s/g, '').length < 2) {
      return () => { cancelled = true; };
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q: normalizedSearch });
        const response = await fetchWithAuth(`/api/friends?${params.toString()}`);
        const data = await response.json() as { users?: FriendProfile[]; error?: string };
        if (!response.ok) throw new Error(data.error || 'Unable to search for users.');
        if (!cancelled) setResults(data.users ?? []);
      } catch (searchError: unknown) {
        if (!cancelled) setError(searchError instanceof Error ? searchError.message : 'Unable to search for users.');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [normalizedSearch]);

  async function loadMoreActivity() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({ cursor: nextCursor });
      const response = await fetchWithAuth(`/api/friends/feed?${params.toString()}`);
      const data = await response.json() as {
        activities?: FriendActivity[];
        nextCursor?: string | null;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Unable to load more friend activity.');
      setActivities((current) => [...current, ...(data.activities ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load more friend activity.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function refreshFeed() {
    const response = await fetchWithAuth('/api/friends/feed');
    const data = await response.json() as {
      activities?: FriendActivity[];
      nextCursor?: string | null;
      error?: string;
    };
    if (!response.ok) throw new Error(data.error || 'Unable to refresh friend activity.');
    setActivities(data.activities ?? []);
    setFeedTimestamp(Date.now());
    setNextCursor(data.nextCursor ?? null);
  }

  async function toggleFollow(user: FriendProfile) {
    const currentlyFollowing = followingIds.has(user.id);
    setWorkingUserId(user.id);
    setError(null);
    try {
      const response = await fetchWithAuth('/api/friends', {
        method: currentlyFollowing ? 'DELETE' : 'POST',
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to update your following list.');

      if (currentlyFollowing) {
        setFollowing((current) => current.filter((entry) => entry.id !== user.id));
        if (selectedManager?.id === user.id) setSelectedManager(null);
      } else {
        setFollowing((current) => [{
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          followed_at: new Date().toISOString(),
        }, ...current]);
      }
      setResults((current) => current.map((entry) => (
        entry.id === user.id ? { ...entry, is_following: !currentlyFollowing } : entry
      )));
      await refreshFeed();
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update your following list.');
    } finally {
      setWorkingUserId(null);
    }
  }

  function openManager(userId: string) {
    const manager = following.find((user) => user.id === userId);
    if (manager) setSelectedManager(manager);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[var(--accent-primary)]/10 p-3 text-[var(--accent-primary)]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">Friends</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Follow managers to see their fantasy activity and open their progress details.
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
        <section className="min-w-0 space-y-4" aria-labelledby="friend-feed-heading">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[var(--accent-primary)]" />
            <h2 id="friend-feed-heading" className="text-lg font-semibold text-[var(--text-primary)]">Friend activity</h2>
          </div>
          {loading ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)]">
              <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> Loading friend activity…
            </div>
          ) : activities.length ? (
            <div className="space-y-6">
              {/* RECENT ACTIVITY (LAST 3 DAYS) */}
              {recentActivities.length > 0 && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsRecentSectionOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between border-b border-[var(--border)] pb-2 text-left cursor-pointer group transition-colors hover:border-[var(--accent-primary)]/50"
                    aria-expanded={isRecentSectionOpen}
                  >
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-[var(--accent-primary)] animate-pulse" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                        Recent Activity
                      </h3>
                      <span className="rounded-full bg-[var(--accent-primary)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--accent-primary)]">
                        Last 3 days
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-medium">
                      <span>{recentActivities.length} update{recentActivities.length === 1 ? '' : 's'}</span>
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[var(--text-muted)] group-hover:bg-[var(--surface)] group-hover:text-[var(--text-primary)] transition-colors">
                        {isRecentSectionOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  </button>

                  {isRecentSectionOpen && (
                    <div className="space-y-3">
                      {recentActivities.map((activity) => (
                        <ActivityCard
                          key={activity.activity_id}
                          activity={activity}
                          isExpanded={expandedIds.has(activity.activity_id)}
                          onToggleExpand={() => toggleExpand(activity.activity_id)}
                          onOpenManager={openManager}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* OLDER ACTIVITY (OLDER THAN 3 DAYS) */}
              {olderActivities.length > 0 && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsOlderSectionOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between border-b border-[var(--border)] pb-2 pt-2 text-left cursor-pointer group transition-colors hover:border-[var(--border-strong)]"
                    aria-expanded={isOlderSectionOpen}
                  >
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-[var(--text-muted)]" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
                        Earlier Activity
                      </h3>
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                        Older than 3 days
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-medium">
                      <span>{olderActivities.length} update{olderActivities.length === 1 ? '' : 's'}</span>
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--surface-muted)] text-[var(--text-muted)] group-hover:bg-[var(--surface)] group-hover:text-[var(--text-primary)] transition-colors">
                        {isOlderSectionOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  </button>

                  {isOlderSectionOpen && (
                    <div className="space-y-3">
                      {olderActivities.map((activity) => (
                        <ActivityCard
                          key={activity.activity_id}
                          activity={activity}
                          isExpanded={expandedIds.has(activity.activity_id)}
                          onToggleExpand={() => toggleExpand(activity.activity_id)}
                          onOpenManager={openManager}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {nextCursor && (
                <button
                  type="button"
                  onClick={() => void loadMoreActivity()}
                  disabled={loadingMore}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Load more activity
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-raised)] px-5 py-10 text-center">
              <Activity className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
              <p className="mt-3 font-semibold text-[var(--text-primary)]">No friend activity yet</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Transfers, lineup updates, chip use, and completed gameweek scores from followed managers will appear here.
              </p>
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section aria-labelledby="search-friends-heading" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 sm:p-5">
            <h2 id="search-friends-heading" className="text-lg font-semibold text-[var(--text-primary)]">Find managers</h2>
            <label htmlFor="friend-search" className="sr-only">Search by username or display name</label>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                id="friend-search"
                type="search"
                value={search}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearch(value);
                  if (value.trim().replace(/\s/g, '').length < 2) {
                    setResults([]);
                    setSearching(false);
                  }
                }}
                placeholder="Search username or name"
                autoComplete="off"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)]"
              />
            </div>
            {searching && <p className="mt-3 text-sm text-[var(--text-muted)]">Searching…</p>}
            {!searching && normalizedSearch.replace(/\s/g, '').length >= 2 && results.length === 0 && (
              <p className="mt-3 text-sm text-[var(--text-muted)]">No managers found.</p>
            )}
            {results.length > 0 && (
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {results.map((user) => {
                  const isFollowing = followingIds.has(user.id);
                  const isWorking = workingUserId === user.id;
                  return (
                    <li key={user.id} className="flex items-center gap-3 py-3 first:pt-1">
                      <FriendAvatar user={user} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{displayName(user)}</p>
                        <p className="truncate text-xs text-[var(--text-muted)]">@{user.username}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void toggleFollow(user)}
                        disabled={isWorking}
                        aria-label={`${isFollowing ? 'Unfollow' : 'Follow'} ${displayName(user)}`}
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${isFollowing ? 'border border-[var(--border)] text-[var(--text-primary)] hover:border-rose-500/50 hover:text-rose-600 dark:hover:text-rose-400' : 'bg-[var(--accent-primary)] text-white hover:opacity-90'}`}
                      >
                        {isWorking
                          ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          : isFollowing
                            ? <UserMinus className="h-3.5 w-3.5" />
                            : <UserPlus className="h-3.5 w-3.5" />}
                        {isFollowing ? 'Unfollow' : 'Follow'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {normalizedSearch.replace(/\s/g, '').length < 2 && (
              <p className="mt-3 text-xs text-[var(--text-muted)]">Enter at least 2 letters to search.</p>
            )}
          </section>

          <section aria-labelledby="following-heading" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="following-heading" className="text-lg font-semibold text-[var(--text-primary)]">Following</h2>
              <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)]">
                {following.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Click any friend below to view their season points, global rank, and gameweek history.
            </p>
            {loading ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">Loading…</p>
            ) : following.length ? (
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {following.map((user) => (
                  <li key={user.id} className="group flex items-center gap-3 py-3 rounded-xl px-1.5 transition-colors hover:bg-[var(--surface)]">
                    <button
                      type="button"
                      onClick={() => setSelectedManager(user)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                      aria-label={`View ${displayName(user)} progress`}
                    >
                      <FriendAvatar user={user} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                          {displayName(user)}
                        </span>
                        <span className="block truncate text-xs text-[var(--text-muted)]">@{user.username}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleFollow(user)}
                      disabled={workingUserId === user.id}
                      aria-label={`Unfollow ${displayName(user)}`}
                      className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-60 dark:hover:text-rose-400"
                    >
                      {workingUserId === user.id
                        ? <LoaderCircle className="h-4 w-4 animate-spin" />
                        : <UserMinus className="h-4 w-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-6 text-center">
                <Users className="mx-auto h-7 w-7 text-[var(--text-muted)]" />
                <p className="mt-2 text-sm text-[var(--text-muted)]">You are not following anyone yet.</p>
              </div>
            )}
          </section>
        </aside>
      </div>
      {selectedManager && (
        <FriendProgressModal
          user={selectedManager}
          onClose={() => setSelectedManager(null)}
        />
      )}
    </div>
  );
}
