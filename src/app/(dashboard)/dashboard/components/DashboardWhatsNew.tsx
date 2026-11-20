'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Trophy,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Flame,
  Radio,
  Users,
  ChevronDown,
  CheckCheck,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import type { FriendActivity } from '@/types/friends';
import { keepLatestGameweekScoreActivities } from './friend-activity';

export interface WhatsNewEvent {
  kind: 'tournament';
  id: number;
  title: string;
  startedAt: string;
  href: string;
  tier?: string | null;
  seriesCount?: number;
  matchCount?: number;
  bestOfFormats?: number[];
  deadline?: string | null;
  matchStatuses?: Record<string, number>;
}

export interface WhatsNewGameweek {
  id: number;
  number: number;
  status: string;
  startsAt: string;
  isCurrent: boolean;
  endsSoon: boolean;
  deadline: string;
  matchCount: number;
  matchStatuses: Record<string, number>;
  href: string;
}

export interface WhatsNewUpdate {
  id: number;
  kind: 'price_change' | 'availability' | 'league' | 'live_match';
  title: string;
  message: string;
  createdAt: string;
  href: string;
}

export interface WhatsNewData {
  events: WhatsNewEvent[];
  gameweek: WhatsNewGameweek | null;
  updates: WhatsNewUpdate[];
}

interface DashboardWhatsNewProps {
  whatsNew: WhatsNewData;
}

export type FeedFilter = 'all' | 'friends' | 'squad' | 'tournaments';

export type WhatsNewCategory =
  | 'price_change'
  | 'availability'
  | 'live_match'
  | 'league'
  | 'tournament'
  | 'friend';

export type FeedItemChild =
  | { type: 'friend'; data: FriendActivity }
  | { type: 'update'; data: WhatsNewUpdate }
  | { type: 'tournament'; data: WhatsNewEvent };

export interface FeedGroupItem {
  type: 'group';
  category: WhatsNewCategory;
  count: number;
  label: string;
  title: string;
  preview: string;
  latestDate: string;
  items: FeedItemChild[];
}

export type FeedItem = FeedItemChild | FeedGroupItem;

export function formatRelativeTime(value: string) {
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

export function getCategoryTheme(category: WhatsNewCategory) {
  switch (category) {
    case 'price_change':
      return {
        label: 'Price Changes',
        singleLabel: 'Price Change',
        itemNoun: 'price changes',
        icon: TrendingUp,
        border: 'border-l-emerald-500/80',
        bgGradient: 'from-emerald-500/[0.04] to-transparent',
        hoverBg: 'hover:bg-emerald-500/[0.07]',
        badge: 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        text: 'text-emerald-600 dark:text-emerald-400',
        chevronColor: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'availability':
      return {
        label: 'Squad Alerts',
        singleLabel: 'Squad Alert',
        itemNoun: 'squad alerts',
        icon: AlertTriangle,
        border: 'border-l-rose-500/80',
        bgGradient: 'from-rose-500/[0.04] to-transparent',
        hoverBg: 'hover:bg-rose-500/[0.07]',
        badge: 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400',
        text: 'text-rose-600 dark:text-rose-400',
        chevronColor: 'text-rose-600 dark:text-rose-400',
      };
    case 'live_match':
      return {
        label: 'Live Matches',
        singleLabel: 'Live Match',
        itemNoun: 'live matches',
        icon: Radio,
        border: 'border-l-cyan-500/80',
        bgGradient: 'from-cyan-500/[0.04] to-transparent',
        hoverBg: 'hover:bg-cyan-500/[0.07]',
        badge: 'bg-cyan-500/10 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
        text: 'text-cyan-600 dark:text-cyan-400',
        chevronColor: 'text-cyan-600 dark:text-cyan-400',
      };
    case 'league':
      return {
        label: 'League Updates',
        singleLabel: 'League Update',
        itemNoun: 'league updates',
        icon: Trophy,
        border: 'border-l-violet-500/80',
        bgGradient: 'from-violet-500/[0.04] to-transparent',
        hoverBg: 'hover:bg-violet-500/[0.07]',
        badge: 'bg-violet-500/10 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400',
        text: 'text-violet-600 dark:text-violet-400',
        chevronColor: 'text-violet-600 dark:text-violet-400',
      };
    case 'tournament':
      return {
        label: 'Active Tournaments',
        singleLabel: 'Tournament',
        itemNoun: 'tournaments',
        icon: Trophy,
        border: 'border-l-amber-500/80',
        bgGradient: 'from-amber-500/[0.04] to-transparent',
        hoverBg: 'hover:bg-amber-500/[0.07]',
        badge: 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
        text: 'text-amber-600 dark:text-amber-400',
        chevronColor: 'text-amber-600 dark:text-amber-400',
      };
    case 'friend':
      return {
        label: 'Friend Activity',
        singleLabel: 'Friend Move',
        itemNoun: 'friend moves',
        icon: Users,
        border: 'border-l-teal-500/80',
        bgGradient: 'from-teal-500/[0.04] to-transparent',
        hoverBg: 'hover:bg-teal-500/[0.07]',
        badge: 'bg-teal-500/10 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400',
        text: 'text-teal-600 dark:text-teal-400',
        chevronColor: 'text-teal-600 dark:text-teal-400',
      };
  }
}

export function groupFeedItems(rawFeedItems: FeedItemChild[], filter: FeedFilter): FeedItem[] {
  if (filter === 'tournaments') {
    return rawFeedItems.filter((i) => i.type === 'tournament');
  }

  if (filter === 'friends') {
    return rawFeedItems.filter((i) => i.type === 'friend');
  }

  const friends: FriendActivity[] = [];
  const availabilityUpdates: WhatsNewUpdate[] = [];
  const liveMatchUpdates: WhatsNewUpdate[] = [];
  const priceChanges: WhatsNewUpdate[] = [];
  const leagueUpdates: WhatsNewUpdate[] = [];
  const tournamentEvents: WhatsNewEvent[] = [];

  for (const item of rawFeedItems) {
    if (item.type === 'friend') {
      friends.push(item.data);
    } else if (item.type === 'tournament') {
      tournamentEvents.push(item.data);
    } else if (item.type === 'update') {
      if (item.data.kind === 'price_change') {
        priceChanges.push(item.data);
      } else if (item.data.kind === 'live_match') {
        liveMatchUpdates.push(item.data);
      } else if (item.data.kind === 'league') {
        leagueUpdates.push(item.data);
      } else {
        availabilityUpdates.push(item.data);
      }
    }
  }

  const result: FeedItem[] = [];

  const addCategory = (
    category: WhatsNewCategory,
    items: FeedItemChild[],
    titleGenerator: (count: number, first: FeedItemChild) => { title: string; preview: string; latestDate: string },
    label: string,
  ) => {
    if (items.length === 0) return;
    if (items.length === 1) {
      result.push(items[0]);
    } else {
      const { title, preview, latestDate } = titleGenerator(items.length, items[0]);
      result.push({
        type: 'group',
        category,
        count: items.length,
        label,
        title,
        preview,
        latestDate,
        items,
      });
    }
  };

  if (filter === 'all') {
    addCategory(
      'friend',
      friends.map((f) => ({ type: 'friend' as const, data: f })),
      (count, first) => {
        const f = first.data as FriendActivity;
        const name = f.display_name?.trim() || f.username;
        return {
          title: `${count} Friend Moves`,
          preview: `Latest: ${name} · ${f.title}`,
          latestDate: f.updated_at,
        };
      },
      'Friend Activity',
    );

    addCategory(
      'availability',
      availabilityUpdates.map((u) => ({ type: 'update' as const, data: u })),
      (count, first) => {
        const u = first.data as WhatsNewUpdate;
        return {
          title: `${count} Squad Alerts`,
          preview: `Latest: ${u.title}`,
          latestDate: u.createdAt,
        };
      },
      'Squad Alert',
    );

    addCategory(
      'live_match',
      liveMatchUpdates.map((u) => ({ type: 'update' as const, data: u })),
      (count, first) => {
        const u = first.data as WhatsNewUpdate;
        return {
          title: `${count} Live Match Alerts`,
          preview: `Latest: ${u.title}`,
          latestDate: u.createdAt,
        };
      },
      'Live Match',
    );

    addCategory(
      'price_change',
      priceChanges.map((u) => ({ type: 'update' as const, data: u })),
      (count, first) => {
        const u = first.data as WhatsNewUpdate;
        return {
          title: `${count} Price Changes`,
          preview: `Latest: ${u.title}`,
          latestDate: u.createdAt,
        };
      },
      'Price Change',
    );

    addCategory(
      'league',
      leagueUpdates.map((u) => ({ type: 'update' as const, data: u })),
      (count, first) => {
        const u = first.data as WhatsNewUpdate;
        return {
          title: `${count} League Updates`,
          preview: `Latest: ${u.title}`,
          latestDate: u.createdAt,
        };
      },
      'League Update',
    );

    addCategory(
      'tournament',
      tournamentEvents.map((e) => ({ type: 'tournament' as const, data: e })),
      (count, first) => {
        const e = first.data as WhatsNewEvent;
        return {
          title: `${count} Active Tournaments`,
          preview: `Latest: ${e.title}`,
          latestDate: e.startedAt,
        };
      },
      'Tournament',
    );
  } else if (filter === 'squad') {
    addCategory(
      'availability',
      availabilityUpdates.map((u) => ({ type: 'update' as const, data: u })),
      (count, first) => {
        const u = first.data as WhatsNewUpdate;
        return {
          title: `${count} Squad Alerts`,
          preview: `Latest: ${u.title}`,
          latestDate: u.createdAt,
        };
      },
      'Squad Alert',
    );

    addCategory(
      'live_match',
      liveMatchUpdates.map((u) => ({ type: 'update' as const, data: u })),
      (count, first) => {
        const u = first.data as WhatsNewUpdate;
        return {
          title: `${count} Live Match Alerts`,
          preview: `Latest: ${u.title}`,
          latestDate: u.createdAt,
        };
      },
      'Live Match',
    );

    addCategory(
      'price_change',
      priceChanges.map((u) => ({ type: 'update' as const, data: u })),
      (count, first) => {
        const u = first.data as WhatsNewUpdate;
        return {
          title: `${count} Price Changes`,
          preview: `Latest: ${u.title}`,
          latestDate: u.createdAt,
        };
      },
      'Price Change',
    );

    addCategory(
      'league',
      leagueUpdates.map((u) => ({ type: 'update' as const, data: u })),
      (count, first) => {
        const u = first.data as WhatsNewUpdate;
        return {
          title: `${count} League Updates`,
          preview: `Latest: ${u.title}`,
          latestDate: u.createdAt,
        };
      },
      'League Update',
    );
  }

  return result;
}

export function DashboardWhatsNew({ whatsNew }: DashboardWhatsNewProps) {
  const { gameweek, events, updates } = whatsNew;
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [friendActivities, setFriendActivities] = useState<FriendActivity[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadFriendFeed() {
      try {
        const response = await fetchWithAuth('/api/friends/feed?limit=6');
        const data = (await response.json()) as { activities?: FriendActivity[]; error?: string };
        if (response.ok && !cancelled && data.activities) {
          setFriendActivities(keepLatestGameweekScoreActivities(data.activities).slice(0, 6));
        }
      } catch {
        // Silently keep empty list if friends feed fails or user is offline
      }
    }
    void loadFriendFeed();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasEvents = events && events.length > 0;
  const hasUpdates = updates && updates.length > 0;
  const hasFriends = friendActivities.length > 0;

  if (!gameweek && !hasEvents && !hasUpdates && !hasFriends) {
    return null;
  }

  const formatUtcDate = (date: string) =>
    new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(date));

  // Compute live & completed matches for gameweek
  const completedMatches = gameweek?.matchStatuses?.completed ?? 0;
  const liveMatchesCount = gameweek?.matchStatuses?.in_progress ?? 0;
  const totalMatches = gameweek?.matchCount ?? 0;

  const tournamentCount = events?.length ?? 0;
  const squadUpdateCount = updates.length;
  const friendActivityCount = friendActivities.length;

  // Interleave feed items: friend activity & squad alerts take priority
  const rawFeedItems: FeedItemChild[] = [
    ...friendActivities.map((f) => ({ type: 'friend' as const, data: f })),
    ...updates.map((u) => ({ type: 'update' as const, data: u })),
    ...(events || []).map((e) => ({ type: 'tournament' as const, data: e })),
  ];

  const totalRawCount = rawFeedItems.length;
  const feedItems = groupFeedItems(rawFeedItems, filter);

  // Group expansion controls
  const groupedCategoriesInFeed = feedItems
    .filter((item): item is FeedGroupItem => item.type === 'group')
    .map((g) => g.category);
  const hasAccordionGroups = groupedCategoriesInFeed.length > 0;
  const areAllExpanded =
    hasAccordionGroups &&
    groupedCategoriesInFeed.every((cat) => Boolean(expandedCategories[cat]));

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryKey]: !prev[categoryKey],
    }));
  };

  const toggleAllExpanded = () => {
    if (areAllExpanded) {
      setExpandedCategories({});
    } else {
      const next: Record<string, boolean> = {};
      for (const cat of groupedCategoriesInFeed) {
        next[cat] = true;
      }
      setExpandedCategories(next);
    }
  };

  const handleMarkSingleRead = (id: number) => {
    void fetchWithAuth(`/api/notifications/${id}/read`, { method: 'PUT' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Mark notification read failed (${response.status}).`);
        }
        window.dispatchEvent(new Event('fantasy:whats-new-refresh'));
      })
      .catch((error: unknown) => {
        console.error('Failed to mark dashboard notification read:', error);
      });
  };

  const handleMarkCategoryRead = async (itemsToMark: WhatsNewUpdate[]) => {
    try {
      await Promise.all(
        itemsToMark.map((u) =>
          fetchWithAuth(`/api/notifications/${u.id}/read`, { method: 'PUT' }).catch(() => null),
        ),
      );
      window.dispatchEvent(new Event('fantasy:whats-new-refresh'));
    } catch (error) {
      console.error('Failed to mark category notifications read:', error);
    }
  };

  return (
    <section aria-label="What's New Updates" className="mb-8 space-y-3.5">
      {/* ── ROW 1: Dedicated Gameweek Command Banner ── */}
      {gameweek && (
        <div
          className="relative overflow-hidden rounded-2xl p-4 sm:p-5 transition-all"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow:
              '0 4px 24px color-mix(in srgb, var(--accent-primary) 12%, transparent), 0 1px 4px rgba(0,0,0,0.18)',
            animation: 'wn-enter 340ms cubic-bezier(.22,1,.36,1) both',
          }}
        >
          {/* Subtle Accent Edge */}
          <div
            className="absolute top-0 left-0 bottom-0 w-2"
            style={{
              background: 'linear-gradient(180deg, var(--accent-primary), var(--accent-secondary))',
              boxShadow: '2px 0 12px color-mix(in srgb, var(--accent-primary) 50%, transparent)',
            }}
            aria-hidden="true"
          />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-1 sm:pl-2">
            {/* Gameweek Badge & Round Info */}
            <div className="flex items-center gap-3.5">
              <div
                className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)',
                  color: 'var(--accent-primary)',
                }}
              >
                <Radio className="h-6 w-6" />
                {liveMatchesCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
                    style={{
                      background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
                      color: 'var(--accent-primary)',
                    }}
                  >
                    <span>Gameweek {gameweek.number}</span>
                  </span>

                  {liveMatchesCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                      <Flame className="h-3 w-3 animate-pulse text-emerald-500" />
                      <span>{liveMatchesCount} Live Match{liveMatchesCount > 1 ? 'es' : ''}</span>
                    </span>
                  )}

                  {gameweek.endsSoon && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                      Final Hours
                    </span>
                  )}
                </div>

                {/* Headline Title */}
                <h3 className="mt-1 text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
                  Round in Progress: {completedMatches} of {totalMatches} Matches Concluded
                </h3>

                {/* Progress Indicator */}
                <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <div className="w-24 sm:w-32 h-1.5 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-teal-500 to-cyan-400 rounded-full transition-all duration-500"
                      style={{
                        width: `${totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono">
                    {totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0}% Closed
                  </span>
                </div>
              </div>
            </div>

            {/* Roster Lock & Actions */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col md:text-right pr-2">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                  Roster Lock
                </span>
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  {formatUtcDate(gameweek.deadline)} UTC
                </span>
              </div>

              <Link
                href="/lineups"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 transition-all shrink-0"
              >
                <span>Edit Lineup</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={gameweek.href}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-all shrink-0"
              >
                <span>GW Info</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── ROW 2: Thin, Clean Feed Rows with Accordion Groups ── */}
      {feedItems.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden transition-all"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow:
              '0 4px 24px color-mix(in srgb, var(--accent-primary) 10%, transparent), 0 1px 4px rgba(0,0,0,0.14)',
            animation: 'wn-enter 380ms cubic-bezier(.22,1,.36,1) 60ms both',
          }}
        >
          {/* Feed Header with Filtering Pills */}
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5"
            style={{
              background: 'color-mix(in srgb, var(--accent-primary) 5%, var(--surface-raised))',
              borderBottom: '1px solid color-mix(in srgb, var(--accent-primary) 18%, var(--border))',
            }}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="text-xs font-bold uppercase tracking-wider mr-1.5 hidden md:inline"
                style={{ color: 'var(--text-muted)' }}
              >
                Updates:
              </span>

              {/* Pill: All */}
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer"
                style={{
                  background: filter === 'all' ? 'var(--text-primary)' : 'transparent',
                  color: filter === 'all' ? 'var(--background)' : 'var(--text-secondary)',
                }}
              >
                <span>All</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                  style={{
                    background:
                      filter === 'all'
                        ? 'color-mix(in srgb, var(--background) 30%, transparent)'
                        : 'var(--surface-muted)',
                    color: filter === 'all' ? 'var(--background)' : 'var(--text-muted)',
                  }}
                >
                  {totalRawCount}
                </span>
              </button>

              {/* Pill: Friends (Social Priority) */}
              <button
                type="button"
                onClick={() => setFilter('friends')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer"
                style={{
                  background: filter === 'friends' ? 'var(--accent-primary)' : 'transparent',
                  color: filter === 'friends' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                <Users className="h-3 w-3" />
                <span>Friends</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                  style={{
                    background: filter === 'friends' ? 'rgba(0,0,0,0.2)' : 'var(--surface-muted)',
                    color: filter === 'friends' ? '#ffffff' : 'var(--text-muted)',
                  }}
                >
                  {friendActivityCount}
                </span>
              </button>

              {/* Pill: Squad Updates (highlighted priority) */}
              <button
                type="button"
                onClick={() => setFilter('squad')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer"
                style={{
                  background: filter === 'squad' ? '#10b981' : 'transparent',
                  color: filter === 'squad' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                <TrendingUp className="h-3 w-3" />
                <span>Squad Alerts</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                  style={{
                    background: filter === 'squad' ? 'rgba(0,0,0,0.2)' : 'var(--surface-muted)',
                    color: filter === 'squad' ? '#ffffff' : 'var(--text-muted)',
                  }}
                >
                  {squadUpdateCount}
                </span>
              </button>

              {/* Pill: Tournaments */}
              <button
                type="button"
                onClick={() => setFilter('tournaments')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer"
                style={{
                  background: filter === 'tournaments' ? '#f59e0b' : 'transparent',
                  color: filter === 'tournaments' ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                <Trophy className="h-3 w-3" />
                <span>Tournaments</span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                  style={{
                    background: filter === 'tournaments' ? 'rgba(0,0,0,0.2)' : 'var(--surface-muted)',
                    color: filter === 'tournaments' ? '#ffffff' : 'var(--text-muted)',
                  }}
                >
                  {tournamentCount}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
              {hasAccordionGroups && (
                <>
                  <button
                    type="button"
                    onClick={toggleAllExpanded}
                    className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{areAllExpanded ? 'Collapse all' : 'Expand all'}</span>
                  </button>
                  <span className="text-[var(--border)] hidden sm:inline" aria-hidden="true">
                    |
                  </span>
                </>
              )}

              <Link
                href="/friends"
                className="text-xs font-semibold transition-colors inline-flex items-center gap-1 hover:opacity-80"
                style={{ color: 'var(--accent-primary)' }}
              >
                <span>Friends Hub</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Thin Rows List with Expandable Accordions */}
          <div className="divide-y divide-[var(--border)]">
            {feedItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                {filter === 'friends'
                  ? 'No recent friend activity. Follow managers on the Friends page to see their moves here!'
                  : filter === 'squad'
                    ? 'No squad alerts right now.'
                  : 'No items match this filter.'}
              </div>
            ) : (
              feedItems.map((item) => {
                // ── Accordion Group Row ──
                if (item.type === 'group') {
                  const group = item;
                  const theme = getCategoryTheme(group.category);
                  const Icon = theme.icon;
                  const isExpanded = Boolean(expandedCategories[group.category]);
                  const updatesInGroup = group.items
                    .filter((i): i is { type: 'update'; data: WhatsNewUpdate } => i.type === 'update')
                    .map((i) => i.data);

                  return (
                    <div key={`group-${group.category}`} className="flex flex-col">
                      {/* Accordion Summary Header Button */}
                      <button
                        type="button"
                        onClick={() => toggleCategory(group.category)}
                        aria-expanded={isExpanded}
                        aria-controls={`group-content-${group.category}`}
                        className={`group relative flex w-full items-center justify-between gap-3 px-4 py-2.5 border-l-3 ${theme.border} bg-linear-to-r ${theme.bgGradient} ${theme.hoverBg} transition-all cursor-pointer text-left`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${theme.badge} transition-transform group-hover:scale-105`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>

                          <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                            <span className={`text-[11px] font-semibold shrink-0 ${theme.text}`}>
                              {theme.label}
                            </span>
                            <span className="text-[var(--border)]">·</span>
                            <h4 className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors truncate">
                              {group.title}
                            </h4>
                            <span className="hidden md:inline text-xs text-[var(--text-muted)] truncate">
                              ({group.preview})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${theme.badge}`}
                          >
                            {group.count} {group.count === 1 ? 'item' : 'items'}
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
                            {formatUtcDate(group.latestDate)}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
                            <span className="text-[11px] font-medium hidden xs:inline">
                              {isExpanded ? 'Collapse' : 'Expand'}
                            </span>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180 text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                              }`}
                            />
                          </div>
                        </div>
                      </button>

                      {/* Accordion Expanded Child Items */}
                      {isExpanded && (
                        <div
                          id={`group-content-${group.category}`}
                          className="divide-y divide-[var(--border)] border-t border-[var(--border)] bg-[var(--surface-raised)]/10"
                        >
                          {updatesInGroup.length > 1 && (
                            <div className="flex items-center justify-between px-4 sm:px-10 py-1.5 bg-[var(--surface-muted)]/20 text-[11px] text-[var(--text-muted)]">
                              <span>Showing all {group.count} {theme.itemNoun}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleMarkCategoryRead(updatesInGroup);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                              >
                                <CheckCheck className="h-3 w-3" />
                                <span>Mark all {updatesInGroup.length} as read</span>
                              </button>
                            </div>
                          )}

                          {group.items.map((child) => {
                            if (child.type === 'friend') {
                              const activity = child.data;
                              const name = activity.display_name?.trim() || activity.username;

                              return (
                                <Link
                                  key={`sub-f-${activity.activity_id}`}
                                  href={`/friends?activityId=${encodeURIComponent(activity.activity_id)}`}
                                  className="group/child relative flex items-center justify-between gap-3 pl-8 sm:pl-10 pr-4 py-2 border-l-3 border-l-teal-500/60 bg-[var(--surface-raised)]/20 hover:bg-[var(--surface-raised)]/60 transition-all"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-teal-500/30 bg-teal-500/10 text-[10px] font-bold text-teal-600 dark:text-teal-400 transition-transform group-hover/child:scale-105">
                                      {activity.avatar_url ? (
                                        <Image
                                          src={activity.avatar_url}
                                          alt=""
                                          width={20}
                                          height={20}
                                          unoptimized
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        name.slice(0, 1).toUpperCase()
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                                      <span className="text-xs font-semibold text-[var(--text-primary)] group-hover/child:text-teal-600 dark:group-hover/child:text-teal-400 transition-colors truncate">
                                        {name}
                                      </span>
                                      <span className="text-[var(--border)]">·</span>
                                      <span className="text-xs text-[var(--text-secondary)] truncate">
                                        {activity.title}
                                      </span>

                                      {activity.activity_type === 'transfer' && (
                                        <div className="hidden lg:flex items-center gap-1 text-[10px]">
                                          {activity.players_in?.map((p) => (
                                            <span
                                              key={`in-${p}`}
                                              className="rounded bg-emerald-500/10 px-1 py-0.2 text-emerald-600 dark:text-emerald-400"
                                            >
                                              +{p}
                                            </span>
                                          ))}
                                          {activity.players_out?.map((p) => (
                                            <span
                                              key={`out-${p}`}
                                              className="rounded bg-rose-500/10 px-1 py-0.2 text-rose-600 dark:text-rose-400"
                                            >
                                              -{p}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2.5 shrink-0">
                                    <span className="text-[10px] text-[var(--text-muted)]">
                                      {formatRelativeTime(activity.updated_at)}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-[var(--text-muted)] group-hover/child:text-teal-500 dark:group-hover/child:text-teal-400 group-hover/child:translate-x-0.5 transition-all" />
                                  </div>
                                </Link>
                              );
                            }

                            if (child.type === 'tournament') {
                              const event = child.data;
                              const matchSummary = [
                                event.seriesCount ? `${event.seriesCount} series` : null,
                                event.matchCount ? `${event.matchCount} matches` : null,
                                event.bestOfFormats && event.bestOfFormats.length > 0
                                  ? `Bo${event.bestOfFormats.join('/Bo')}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ');

                              return (
                                <Link
                                  key={`sub-t-${event.id}`}
                                  href={event.href}
                                  className="group/child relative flex items-center justify-between gap-3 pl-8 sm:pl-10 pr-4 py-2 border-l-3 border-l-amber-500/60 bg-[var(--surface-raised)]/20 hover:bg-[var(--surface-raised)]/60 transition-all"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 transition-transform group-hover/child:scale-105">
                                      <Trophy className="h-3 w-3" />
                                    </div>

                                    <div className="flex items-center gap-2 min-w-0">
                                      {event.tier && (
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">
                                          {event.tier}
                                        </span>
                                      )}
                                      <span className="text-[var(--border)]">·</span>
                                      <h4 className="text-xs font-semibold text-[var(--text-primary)] group-hover/child:text-[var(--text-primary)] transition-colors truncate">
                                        {event.title}
                                      </h4>
                                      {matchSummary && (
                                        <span className="hidden md:inline text-xs text-[var(--text-muted)] truncate">
                                          ({matchSummary})
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2.5 shrink-0">
                                    <span className="text-[10px] text-[var(--text-muted)]">
                                      {formatUtcDate(event.startedAt)}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-[var(--text-muted)] group-hover/child:text-[var(--text-primary)] group-hover/child:translate-x-0.5 transition-all" />
                                  </div>
                                </Link>
                              );
                            }

                            // Sub-item: Update (price_change, availability, live_match, league)
                            const update = child.data;
                            const subTheme = getCategoryTheme(update.kind);
                            const SubIcon = subTheme.icon;

                            return (
                              <Link
                                key={`sub-u-${update.id}`}
                                href={update.href}
                                onClick={() => handleMarkSingleRead(update.id)}
                                className={`group/child relative flex items-center justify-between gap-3 pl-8 sm:pl-10 pr-4 py-2 border-l-3 ${subTheme.border} bg-[var(--surface-raised)]/20 hover:bg-[var(--surface-raised)]/60 transition-all`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${subTheme.badge} transition-transform group-hover/child:scale-105`}
                                  >
                                    <SubIcon className="h-3 w-3" />
                                  </div>

                                  <div className="flex items-center gap-2 min-w-0">
                                    <h4 className="text-xs font-semibold text-[var(--text-primary)] group-hover/child:text-[var(--text-primary)] transition-colors truncate">
                                      {update.title}
                                    </h4>
                                    <span className="hidden md:inline text-xs text-[var(--text-muted)] truncate">
                                      {update.message}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                  <span className="text-[10px] text-[var(--text-muted)]">
                                    {formatUtcDate(update.createdAt)}
                                  </span>
                                  <ArrowRight className="h-3 w-3 text-[var(--text-muted)] group-hover/child:text-[var(--text-primary)] group-hover/child:translate-x-0.5 transition-all" />
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // ── Standalone Friend Row ──
                if (item.type === 'friend') {
                  const activity = item.data;
                  const name = activity.display_name?.trim() || activity.username;

                  return (
                    <Link
                      key={`f-${activity.activity_id}`}
                      href={`/friends?activityId=${encodeURIComponent(activity.activity_id)}`}
                      className="group relative flex items-center justify-between gap-3 px-4 py-2.5 border-l-3 border-l-teal-500/80 bg-linear-to-r from-teal-500/[0.04] to-transparent hover:bg-teal-500/[0.07] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-teal-500/30 bg-teal-500/10 text-xs font-bold text-teal-600 dark:text-teal-400 transition-transform group-hover:scale-105">
                          {activity.avatar_url ? (
                            <Image
                              src={activity.avatar_url}
                              alt=""
                              width={28}
                              height={28}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            name.slice(0, 1).toUpperCase()
                          )}
                        </div>

                        <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                          <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 shrink-0">
                            Friend Move
                          </span>
                          <span className="text-[var(--border)]">·</span>
                          <span className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors truncate">
                            {name}
                          </span>
                          <span className="text-[var(--border)]">·</span>
                          <span className="text-xs text-[var(--text-secondary)] truncate">
                            {activity.title}
                          </span>

                          {activity.activity_type === 'transfer' && (
                            <div className="hidden lg:flex items-center gap-1 text-[10px]">
                              {activity.players_in?.map((p) => (
                                <span
                                  key={`in-${p}`}
                                  className="rounded bg-emerald-500/10 px-1 py-0.2 text-emerald-600 dark:text-emerald-400"
                                >
                                  +{p}
                                </span>
                              ))}
                              {activity.players_out?.map((p) => (
                                <span
                                  key={`out-${p}`}
                                  className="rounded bg-rose-500/10 px-1 py-0.2 text-rose-600 dark:text-rose-400"
                                >
                                  -{p}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {formatRelativeTime(activity.updated_at)}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] group-hover:text-teal-500 dark:group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Link>
                  );
                }

                // ── Standalone Tournament Row ──
                if (item.type === 'tournament') {
                  const event = item.data;
                  const matchSummary = [
                    event.seriesCount ? `${event.seriesCount} series` : null,
                    event.matchCount ? `${event.matchCount} matches` : null,
                    event.bestOfFormats && event.bestOfFormats.length > 0
                      ? `Bo${event.bestOfFormats.join('/Bo')}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  const rowTheme = {
                    border: 'border-l-amber-500/80',
                    bgGradient: 'from-amber-500/[0.04] to-transparent',
                    hoverBg: 'hover:bg-amber-500/[0.07]',
                    iconBg: 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
                  };

                  return (
                    <Link
                      key={`t-${event.id}`}
                      href={event.href}
                      className={`group relative flex items-center justify-between gap-3 px-4 py-2.5 border-l-3 ${rowTheme.border} bg-linear-to-r ${rowTheme.bgGradient} ${rowTheme.hoverBg} transition-all`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${rowTheme.iconBg} transition-transform group-hover:scale-105`}
                        >
                          <Trophy className="h-3.5 w-3.5" />
                        </div>

                        <div className="flex items-center gap-2 min-w-0">
                          {event.tier && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">
                              {event.tier}
                            </span>
                          )}
                          <span className="text-[var(--border)]">·</span>
                          <h4 className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors truncate">
                            {event.title}
                          </h4>
                          {matchSummary && (
                            <span className="hidden md:inline text-xs text-[var(--text-muted)] truncate">
                              ({matchSummary})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {formatUtcDate(event.startedAt)}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Link>
                  );
                }

                // ── Standalone Update Row ──
                const update = item.data;
                const updateTheme = getCategoryTheme(update.kind);
                const Icon = updateTheme.icon;

                return (
                  <Link
                    key={`u-${update.id}`}
                    href={update.href}
                    onClick={() => handleMarkSingleRead(update.id)}
                    className={`group relative flex items-center justify-between gap-3 px-4 py-2.5 border-l-3 ${updateTheme.border} bg-linear-to-r ${updateTheme.bgGradient} ${updateTheme.hoverBg} transition-all`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${updateTheme.badge} transition-transform group-hover:scale-105`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[11px] font-semibold shrink-0 ${updateTheme.text}`}>
                          {updateTheme.singleLabel}
                        </span>
                        <span className="text-[var(--border)]">·</span>
                        <h4 className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors truncate">
                          {update.title}
                        </h4>
                        <span className="hidden md:inline text-xs text-[var(--text-muted)] truncate">
                          {update.message}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {formatUtcDate(update.createdAt)}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
