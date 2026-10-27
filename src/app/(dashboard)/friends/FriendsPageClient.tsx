'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Activity,
  Award,
  ClipboardList,
  LoaderCircle,
  Search,
  Sparkles,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

interface FriendProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  followed_at?: string;
  is_following?: boolean;
}

interface FriendActivity {
  activity_id: string;
  activity_type: 'transfer' | 'chip' | 'lineup' | 'gameweek_score';
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  season_id: number;
  season_name: string;
  gameweek_id: number;
  gameweek_number: number | null;
  title: string;
  players_in: string[] | null;
  players_out: string[] | null;
  chip: string | null;
  gameweek_points: number | string | null;
  total_points: number | string | null;
  gameweek_rank: number | null;
  previous_gameweek_rank: number | null;
  global_rank: number | null;
  updated_at: string;
  lineup_changes: Array<{
    slot: string;
    from: string | null;
    to: string | null;
  }> | null;
}

interface FriendProgress {
  manager: FriendProfile;
  season: {
    id: number;
    name: string;
    total_points: number;
    global_rank: number | null;
    gameweeks: Array<{
      id: number;
      gameweek_number: number;
      gameweek_points: number;
      total_points: number;
      rank: number;
      updated_at: string;
    }>;
  } | null;
}

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

function Avatar({ user }: { user: Pick<FriendProfile, 'username' | 'display_name' | 'avatar_url'> }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-muted)] text-sm font-bold text-[var(--text-primary)]">
      {user.avatar_url ? (
        <Image
          src={user.avatar_url}
          alt=""
          width={44}
          height={44}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        displayName(user).slice(0, 1).toUpperCase()
      )}
    </div>
  );
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

function FriendProgressModal({
  user,
  onClose,
}: {
  user: FriendProfile;
  onClose: () => void;
}) {
  const [progress, setProgress] = useState<FriendProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadProgress() {
      try {
        const response = await fetchWithAuth(`/api/friends/${encodeURIComponent(user.id)}/progress`, {
          signal: controller.signal,
        });
        const data = await response.json() as FriendProgress & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Unable to load manager progress.');
        if (!controller.signal.aborted) setProgress(data);
      } catch (loadError: unknown) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load manager progress.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProgress();
    return () => controller.abort();
  }, [user.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    closeButtonRef.current?.focus();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-progress-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 shadow-2xl sm:p-7"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar user={user} />
            <div>
              <h2 id="friend-progress-title" className="text-xl font-bold text-[var(--text-primary)]">{displayName(user)}</h2>
              <p className="text-sm text-[var(--text-muted)]">@{user.username}</p>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close manager progress" className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]">
            <X className="h-5 w-5" />
          </button>
        </header>

        {loading ? (
          <div role="status" className="flex min-h-32 items-center justify-center text-sm text-[var(--text-muted)]">
            <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> Loading progress…
          </div>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">{error}</p>
        ) : progress?.season ? (
          <>
            <p className="mb-4 text-sm font-medium text-[var(--text-muted)]">{progress.season.name}</p>
            <div className="mb-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--surface)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Season points</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{formatPoints(progress.season.total_points)}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Global rank</p>
                <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                  {progress.season.global_rank ? `#${progress.season.global_rank.toLocaleString()}` : 'Unranked'}
                </p>
              </div>
            </div>
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <Award className="h-4 w-4 text-[var(--accent-primary)]" /> Gameweek history
            </h3>
            {progress.season.gameweeks.length ? (
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="bg-[var(--surface)] text-xs uppercase text-[var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Gameweek</th>
                      <th className="px-4 py-3">Points</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {progress.season.gameweeks.map((gameweek) => (
                      <tr key={gameweek.id} className="text-[var(--text-primary)]">
                        <td className="px-4 py-3">GW {gameweek.gameweek_number}</td>
                        <td className="px-4 py-3">{formatPoints(gameweek.gameweek_points)}</td>
                        <td className="px-4 py-3">{formatPoints(gameweek.total_points)}</td>
                        <td className="px-4 py-3">#{gameweek.rank.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">No closed gameweek scores have been recorded yet.</p>
            )}
          </>
        ) : (
          <p className="rounded-xl bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">There is no active or completed season to show yet.</p>
        )}
      </section>
    </div>
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
                      <Avatar user={user} />
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
            {loading ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">Loading…</p>
            ) : following.length ? (
              <ul className="mt-2 divide-y divide-[var(--border)]">
                {following.map((user) => (
                  <li key={user.id} className="flex items-center gap-3 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedManager(user)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                      aria-label={`View ${displayName(user)} progress`}
                    >
                      <Avatar user={user} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{displayName(user)}</span>
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
