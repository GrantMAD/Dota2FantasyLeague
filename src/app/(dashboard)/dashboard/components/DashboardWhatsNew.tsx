'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Trophy,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Flame,
  Radio,
} from 'lucide-react';

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

type FeedFilter = 'all' | 'tournaments' | 'squad';

export function DashboardWhatsNew({ whatsNew }: DashboardWhatsNewProps) {
  const { gameweek, events, updates } = whatsNew;
  const [filter, setFilter] = useState<FeedFilter>('all');
  const hasEvents = events && events.length > 0;
  const hasUpdates = updates && updates.length > 0;

  if (!gameweek && !hasEvents && !hasUpdates) {
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
  const displayUpdates: WhatsNewUpdate[] = (updates && updates.length > 0)
    ? updates
    : [
        {
          id: 991,
          kind: 'price_change',
          title: 'Ame (Xtreme Gaming)',
          message: 'Price increased +$0.3M (Now $10.5M)',
          createdAt: new Date().toISOString(),
          href: '/players/1',
        },
        {
          id: 992,
          kind: 'availability',
          title: 'Yatoro (Team Spirit)',
          message: 'Swap required: Inactive on starting roster for GW2',
          createdAt: new Date().toISOString(),
          href: '/players/2',
        },
      ];

  // Compile full feed list
  const allFeedItems = [
    ...(events || []).map((e) => ({ type: 'tournament' as const, data: e })),
    ...displayUpdates.map((u) => ({ type: 'update' as const, data: u })),
  ];

  const tournamentCount = events?.length ?? 0;
  const squadUpdateCount = displayUpdates.length;

  const filteredItems = allFeedItems.filter((item) => {
    if (filter === 'tournaments') return item.type === 'tournament';
    if (filter === 'squad') return item.type === 'update';
    return true;
  });

  return (
    <section aria-label="What's New Updates" className="mb-8 space-y-3.5">
      {/* ── ROW 1: Dedicated Gameweek Command Banner ── */}
      {gameweek && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 sm:p-5 shadow-sm dark:shadow-md transition-all">
          {/* Subtle Accent Edge */}
          <div
            className="absolute top-0 left-0 bottom-0 w-1.5 bg-linear-to-b from-amber-500 to-orange-500"
            aria-hidden="true"
          />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-1 sm:pl-2">
            {/* Gameweek Badge & Round Info */}
            <div className="flex items-center gap-3.5">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400">
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
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                    {gameweek.isCurrent ? 'Current Round' : 'Next Round'}
                  </span>
                  {liveMatchesCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {liveMatchesCount} Live
                    </span>
                  )}
                  {gameweek.endsSoon && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                      <Flame className="h-3 w-3" /> Ends Soon
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-3 mt-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Gameweek {gameweek.number}
                  </h2>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {completedMatches} of {totalMatches} matches finished
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
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden shadow-xs dark:shadow-md">
          {/* Feed Header with Filtering Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mr-1.5 hidden md:inline">
                Updates:
              </span>

              {/* Pill: All */}
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  filter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <span>All</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    filter === 'all'
                      ? 'bg-slate-800 text-slate-200 dark:bg-slate-200 dark:text-slate-800'
                      : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {allFeedItems.length}
                </span>
              </button>

              {/* Pill: Tournaments */}
              <button
                type="button"
                onClick={() => setFilter('tournaments')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  filter === 'tournaments'
                    ? 'bg-amber-500 text-white shadow-2xs shadow-amber-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <Trophy className="h-3 w-3" />
                <span>Tournaments</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    filter === 'tournaments'
                      ? 'bg-amber-600 text-amber-50'
                      : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {tournamentCount}
                </span>
              </button>

              {/* Pill: Squad Updates */}
              <button
                type="button"
                onClick={() => setFilter('squad')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  filter === 'squad'
                    ? 'bg-emerald-600 text-white shadow-2xs shadow-emerald-600/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <TrendingUp className="h-3 w-3" />
                <span>Squad Updates</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    filter === 'squad'
                      ? 'bg-emerald-700 text-emerald-50'
                      : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {squadUpdateCount}
                </span>
              </button>
            </div>

            <Link
              href="/tournaments"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors inline-flex items-center gap-1 shrink-0 self-end sm:self-auto"
            >
              <span>View tournaments</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Thin Rows List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                No items match this filter.
              </div>
            ) : (
              filteredItems.map((item, index) => {
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

                // Harmonious color themes for each tournament row
                const rowThemes = [
                  {
                    border: 'border-l-amber-500/80',
                    bgGradient: 'from-amber-500/[0.04] to-transparent',
                    hoverBg: 'hover:bg-amber-500/[0.07]',
                    iconBg: 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
                    dot: 'bg-amber-500',
                  },
                  {
                    border: 'border-l-blue-500/80',
                    bgGradient: 'from-blue-500/[0.04] to-transparent',
                    hoverBg: 'hover:bg-blue-500/[0.07]',
                    iconBg: 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400',
                    dot: 'bg-blue-500',
                  },
                  {
                    border: 'border-l-emerald-500/80',
                    bgGradient: 'from-emerald-500/[0.04] to-transparent',
                    hoverBg: 'hover:bg-emerald-500/[0.07]',
                    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                    dot: 'bg-emerald-500',
                  },
                  {
                    border: 'border-l-purple-500/80',
                    bgGradient: 'from-purple-500/[0.04] to-transparent',
                    hoverBg: 'hover:bg-purple-500/[0.07]',
                    iconBg: 'bg-purple-500/10 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400',
                    dot: 'bg-purple-500',
                  },
                  {
                    border: 'border-l-rose-500/80',
                    bgGradient: 'from-rose-500/[0.04] to-transparent',
                    hoverBg: 'hover:bg-rose-500/[0.07]',
                    iconBg: 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400',
                    dot: 'bg-rose-500',
                  },
                  {
                    border: 'border-l-cyan-500/80',
                    bgGradient: 'from-cyan-500/[0.04] to-transparent',
                    hoverBg: 'hover:bg-cyan-500/[0.07]',
                    iconBg: 'bg-cyan-500/10 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
                    dot: 'bg-cyan-500',
                  },
                ];
                const theme = rowThemes[index % rowThemes.length];

                return (
                  <Link
                    key={`t-${event.id}`}
                    href={event.href}
                    className={`group relative flex items-center justify-between gap-3 px-4 py-2.5 border-l-3 ${theme.border} bg-linear-to-r ${theme.bgGradient} ${theme.hoverBg} transition-all`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${theme.iconBg} transition-transform group-hover:scale-105`}>
                        <Trophy className="h-3.5 w-3.5" />
                      </div>

                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                          Tournament
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate">
                          {event.title}
                        </h4>
                        {event.tier && (
                          <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                            {event.tier}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {matchSummary && (
                        <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500">
                          {matchSummary}
                        </span>
                      )}
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
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${updateTheme.text}`}
                      >
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
            }))}
          </div>
        </div>
      )}
    </section>
  );
}

