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
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import type { FriendActivity } from '@/types/friends';

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
  kind: 'price_change' | 'availability';
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

type FeedFilter = 'all' | 'friends' | 'squad' | 'tournaments';

type FeedItem =
  | { type: 'friend'; data: FriendActivity }
  | { type: 'update'; data: WhatsNewUpdate }
  | { type: 'tournament'; data: WhatsNewEvent };

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

export function DashboardWhatsNew({ whatsNew }: DashboardWhatsNewProps) {
  const { gameweek, events, updates } = whatsNew;
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [friendActivities, setFriendActivities] = useState<FriendActivity[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadFriendFeed() {
      try {
        const response = await fetchWithAuth('/api/friends/feed?limit=6');
        const data = (await response.json()) as { activities?: FriendActivity[]; error?: string };
        if (response.ok && !cancelled && data.activities) {
          setFriendActivities(data.activities.slice(0, 6));
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

  // If there are no real squad updates yet, provide mock sample updates so user can preview how they look
  const displayUpdates: WhatsNewUpdate[] =
    updates && updates.length > 0
      ? updates
      : [
          {
            id: 991,
            kind: 'price_change',
            title: 'Ame (Xtreme Gaming)',
            message: 'Price increased +$0.5M (Now $6.0M)',
            createdAt: new Date().toISOString(),
            href: '/players/509',
          },
          {
            id: 992,
            kind: 'availability',
            title: 'Yatoro (Team Spirit)',
            message: 'Swap required: Inactive on starting roster for GW2',
            createdAt: new Date().toISOString(),
            href: '/players/727',
          },
        ];

  // Interleave feed items: friend activity & squad alerts take priority
  const allFeedItems: FeedItem[] = [
    ...friendActivities.map((f) => ({ type: 'friend' as const, data: f })),
    ...displayUpdates.map((u) => ({ type: 'update' as const, data: u })),
    ...(events || []).map((e) => ({ type: 'tournament' as const, data: e })),
  ];

  const tournamentCount = events?.length ?? 0;
  const squadUpdateCount = displayUpdates.length;
  const friendActivityCount = friendActivities.length;

  const filteredItems = allFeedItems.filter((item) => {
    if (filter === 'friends') return item.type === 'friend';
    if (filter === 'squad') return item.type === 'update';
    if (filter === 'tournaments') return item.type === 'tournament';
    return true;
  });

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
                  <h3 className="mt-1 text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    Round in Progress: {completedMatches} of {totalMatches} Matches Concluded
                  </h3>

                  {/* Progress Indicator */}
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="w-24 sm:w-32 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
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
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Roster Lock
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
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
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all shrink-0"
                >
                  <span>GW Info</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── ROW 2: Thin, Clean Feed Rows ── */}
        {allFeedItems.length > 0 && (
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
                    {allFeedItems.length}
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

            {/* Thin Rows List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                  {filter === 'friends'
                    ? 'No recent friend activity. Follow managers on the Friends page to see their moves here!'
                    : 'No items match this filter.'}
                </div>
              ) : (
                filteredItems.map((item) => {
                  if (item.type === 'friend') {
                    const activity = item.data;
                    const name = activity.display_name?.trim() || activity.username;

                    return (
                      <Link
                        key={`f-${activity.activity_id}`}
                        href="/friends"
                        className="group relative flex items-center justify-between gap-3 px-4 py-2.5 border-l-3 border-l-teal-500/80 bg-linear-to-r from-teal-500/[0.04] to-transparent hover:bg-teal-500/[0.07] transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-teal-500/30 bg-teal-500/10 text-xs font-bold text-teal-600 dark:text-teal-400 transition-transform group-hover:scale-105"
                          >
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
                            <span className="text-slate-300 dark:text-slate-700">·</span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors truncate">
                              {name}
                            </span>
                            <span className="text-slate-300 dark:text-slate-700">·</span>
                            <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                              {activity.title}
                            </span>

                            {activity.activity_type === 'transfer' && (
                              <div className="hidden lg:flex items-center gap-1 text-[10px]">
                                {activity.players_in?.map((p) => (
                                  <span key={`in-${p}`} className="rounded bg-emerald-500/10 px-1 py-0.2 text-emerald-600 dark:text-emerald-400">
                                    +{p}
                                  </span>
                                ))}
                                {activity.players_out?.map((p) => (
                                  <span key={`out-${p}`} className="rounded bg-rose-500/10 px-1 py-0.2 text-rose-600 dark:text-rose-400">
                                    -{p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            {formatRelativeTime(activity.updated_at)}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-teal-500 dark:group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </Link>
                    );
                  }

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
                      dot: 'bg-amber-500',
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
                            <span className="text-slate-300 dark:text-slate-700">·</span>
                            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate">
                              {event.title}
                            </h4>
                            {matchSummary && (
                              <span className="hidden md:inline text-xs text-slate-400 dark:text-slate-500 truncate">
                                ({matchSummary})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            {formatUtcDate(event.startedAt)}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </Link>
                    );
                  }

                  // Player Updates (Price Change or Availability/Swap alert)
                  const update = item.data;
                  const isAvailability = update.kind === 'availability';
                  const Icon = isAvailability ? AlertTriangle : TrendingUp;

                  const updateTheme = isAvailability
                    ? {
                        border: 'border-l-rose-500/80',
                        bgGradient: 'from-rose-500/[0.04] to-transparent',
                        hoverBg: 'hover:bg-rose-500/[0.07]',
                        badge: 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400',
                        text: 'text-rose-600 dark:text-rose-400',
                      }
                    : {
                        border: 'border-l-emerald-500/80',
                        bgGradient: 'from-emerald-500/[0.04] to-transparent',
                        hoverBg: 'hover:bg-emerald-500/[0.07]',
                        badge: 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                        text: 'text-emerald-600 dark:text-emerald-400',
                      };

                  return (
                    <Link
                      key={`u-${update.id}`}
                      href={update.href}
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
                            {isAvailability ? 'Squad Alert' : 'Price Change'}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate">
                            {update.title}
                          </h4>
                          <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400 truncate">
                            {update.message}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {formatUtcDate(update.createdAt)}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all" />
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
