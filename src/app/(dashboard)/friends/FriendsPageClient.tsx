'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Activity,
  ClipboardList,
  LoaderCircle,
  Search,
  Sparkles,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

import type { FriendProfile, FriendActivity, FriendProgress } from '@/types/friends';
import { FriendAvatar, FriendProgressModal } from '@/components/friends/FriendProgressModal';

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
  onOpenManager,
}: {
  activity: FriendActivity;
  onOpenManager: (userId: string) => void;
}) {
  const rankChange = activity.previous_gameweek_rank !== null && activity.gameweek_rank !== null
    ? activity.previous_gameweek_rank - activity.gameweek_rank
    : null;
  const Icon = activity.activity_type === 'transfer'
    ? ArrowLeftRight
    : activity.activity_type === 'chip'
      ? Sparkles
      : activity.activity_type === 'lineup'
        ? ClipboardList
        : Trophy;
  return (
    <article className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 sm:p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={() => onOpenManager(activity.user_id)}
            className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
          >
            {displayName(activity)}
          </button>
          <span className="text-sm text-[var(--text-muted)]">@{activity.username}</span>
          <time className="ml-auto text-xs text-[var(--text-muted)]" dateTime={activity.updated_at}>
            {formatRelativeTime(activity.updated_at)}
          </time>
        </div>
        <p className="mt-1 font-medium text-[var(--text-primary)]">{activity.title}</p>
        {activity.activity_type === 'transfer' && (
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {activity.players_in?.map((player) => (
              <span key={`in-${player}`} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
                Bought {player}
              </span>
            ))}
            {activity.players_out?.map((player) => (
              <span key={`out-${player}`} className="rounded-full bg-rose-500/10 px-2.5 py-1 text-rose-700 dark:text-rose-300">
                Sold {player}
              </span>
            ))}
          </div>
        )}
        {activity.activity_type === 'lineup' && (
          <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
            {activity.lineup_changes?.length ? activity.lineup_changes.map((change) => (
              <li key={change.slot}>
                <span className="font-medium text-[var(--text-primary)]">{change.slot}:</span>{' '}
                {change.from ?? 'Empty'} <span aria-label="changed to">→</span> {change.to ?? 'Empty'}
              </li>
            )) : (
              <li>Detailed player changes are not available for this older lineup update.</li>
            )}
          </ul>
        )}
        {activity.activity_type === 'gameweek_score' && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {activity.gameweek_points === null ? 'Score updated' : `${formatPoints(activity.gameweek_points)} points`}
            {activity.gameweek_rank ? ` · Global gameweek rank #${activity.gameweek_rank.toLocaleString()}` : ''}
            {rankChange !== null && rankChange !== 0
              ? ` · ${Math.abs(rankChange).toLocaleString()} places ${rankChange > 0 ? 'up' : 'down'}`
              : ''}
          </p>
        )}
        {activity.activity_type !== 'gameweek_score' && activity.gameweek_number && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{activity.season_name} · Gameweek {activity.gameweek_number}</p>
        )}
      </div>
    </article>
  );
}



export default function FriendsPageClient() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FriendProfile[]>([]);
  const [following, setFollowing] = useState<FriendProfile[]>([]);
  const [activities, setActivities] = useState<FriendActivity[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [workingUserId, setWorkingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedManager, setSelectedManager] = useState<FriendProfile | null>(null);

  const followingIds = useMemo(() => new Set(following.map((user) => user.id)), [following]);
  const normalizedSearch = search.trim();

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
        setActivities(feedData.activities ?? []);
        setNextCursor(feedData.nextCursor ?? null);
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
  }, []);

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
            <div className="space-y-3">
              {activities.map((activity) => (
                <ActivityCard
                  key={activity.activity_id}
                  activity={activity}
                  onOpenManager={openManager}
                />
              ))}
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
