'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  Bug,
  CalendarDays,
  CheckCircle2,
  Clock,
  Info,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import type { NotificationRecord as Notification } from '@/types/fantasy';
import {
  groupNotificationsByDay,
  isNotificationCategoryCacheFresh,
  markAllCachedNotificationsRead,
  markCachedNotificationRead,
  removeReadCachedNotifications,
  type NotificationCategory,
  type NotificationCategoryCacheEntry,
} from './notification-view-model';

const categories: Array<{ key: NotificationCategory; label: string; countKey?: string }> = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'deadline', label: 'Deadlines' },
  { key: 'market', label: 'Market' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'league', label: 'Leagues' },
];

export default function NotificationsPage() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory>('all');
  const paginationController = useRef<AbortController | null>(null);
  const categoryCache = useRef(new Map<NotificationCategory, NotificationCategoryCacheEntry>());

  useEffect(() => {
    const controller = new AbortController();
    paginationController.current?.abort();
    paginationController.current = null;

    const cached = categoryCache.current.get(activeCategory);

    if (cached && isNotificationCategoryCacheFresh(cached)) {
      return () => {
        controller.abort();
        paginationController.current?.abort();
      };
    }

    async function fetchNotifications() {
      if (!cached) setLoading(true);
      try {
        const params = new URLSearchParams({ category: activeCategory });
        const res = await fetchWithAuth(`/api/notifications?${params.toString()}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const data = (await res.json()) as {
          notifications?: Notification[];
          unreadCount?: number;
          nextCursor?: string | null;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Failed to load notifications');
        const entry = {
          notifications: data.notifications ?? [],
          unreadCount: data.unreadCount ?? 0,
          nextCursor: data.nextCursor ?? null,
          fetchedAt: Date.now(),
        };
        categoryCache.current.set(activeCategory, entry);
        setNotifications(entry.notifications);
        setUnreadCount(entry.unreadCount);
        setNextCursor(entry.nextCursor);
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load notifications');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void fetchNotifications();

    return () => {
      controller.abort();
      paginationController.current?.abort();
    };
  }, [activeCategory]);

  const loadMoreNotifications = async () => {
    if (!nextCursor || loadingMore) return;
    const controller = new AbortController();
    paginationController.current = controller;
    setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        category: activeCategory,
        cursor: nextCursor,
      });
      const response = await fetchWithAuth(`/api/notifications?${params.toString()}`, { signal: controller.signal });
      const data = (await response.json()) as {
        notifications?: Notification[];
        unreadCount?: number;
        nextCursor?: string | null;
        error?: string;
      };
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error || 'Failed to load more notifications');
      const existing = categoryCache.current.get(activeCategory)?.notifications ?? notifications;
      const existingIds = new Set(existing.map((notification) => notification.id));
      const mergedNotifications = [
        ...existing,
        ...(data.notifications ?? []).filter((notification) => !existingIds.has(notification.id)),
      ];
      const entry = {
        notifications: mergedNotifications,
        unreadCount: data.unreadCount ?? unreadCount,
        nextCursor: data.nextCursor ?? null,
        fetchedAt: Date.now(),
      };
      categoryCache.current.set(activeCategory, entry);
      setNotifications(entry.notifications);
      setUnreadCount(entry.unreadCount);
      setNextCursor(entry.nextCursor);
    } catch (requestError: unknown) {
      if (!controller.signal.aborted) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load more notifications');
      }
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
      if (paginationController.current === controller) paginationController.current = null;
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/notifications/${id}/read`, { method: 'PUT' });
      if (res.ok) {
        const wasUnread = notifications.some((notification) => notification.id === id && !notification.is_read);
        const nextUnreadCount = wasUnread ? Math.max(0, unreadCount - 1) : unreadCount;
        categoryCache.current = markCachedNotificationRead(
          categoryCache.current,
          id,
          nextUnreadCount
        );
        setNotifications((current) => current
          .map((item) => item.id === id ? { ...item, is_read: true } : item)
          .filter((item) => activeCategory !== 'unread' || !item.is_read));
        setUnreadCount(nextUnreadCount);
        if (activeCategory === 'unread' && notifications.length <= 1) setNextCursor(null);
        toast.info('Marked as Read');
      } else {
        toast.error('Action Failed', 'Could not mark notification as read');
      }
    } catch (requestError) {
      void requestError;
      toast.error('Action Failed', 'Could not mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    setMarkingAllRead(true);
    try {
      const response = await fetchWithAuth('/api/notifications', { method: 'PUT' });
      if (!response.ok) throw new Error('Failed to mark notifications as read');
      categoryCache.current = markAllCachedNotificationsRead(categoryCache.current);
      setNotifications((current) => activeCategory === 'unread'
        ? []
        : current.map((notification) => ({ ...notification, is_read: true })));
      setUnreadCount(0);
      if (activeCategory === 'unread') setNextCursor(null);
      toast.info('All Notifications Marked as Read');
    } catch (requestError) {
      const msg = requestError instanceof Error ? requestError.message : 'Failed to mark notifications as read';
      setError(msg);
      toast.error('Action Failed', msg);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleClearRead = async () => {
    try {
      const response = await fetchWithAuth('/api/notifications', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear read notifications');
      categoryCache.current = removeReadCachedNotifications(categoryCache.current);
      setNotifications((current) => current.filter((notification) => !notification.is_read));
      toast.success('Cleared', 'Read notifications have been removed');
    } catch (requestError) {
      const msg = requestError instanceof Error ? requestError.message : 'Failed to clear read notifications';
      setError(msg);
      toast.error('Action Failed', msg);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'issue_report_status':
        return <div className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/15 text-violet-300"><Bug className="h-5 w-5" /></div>;
      case 'gameweek_deadline':
      case 'lineup_deadline':
      case 'deadline_reminder':
      case 'deadline':
        return (
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-red-500/30 bg-red-500/15 text-red-300">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
        );
      case 'price_change':
      case 'transfer_market':
      case 'wildcard_used':
        return (
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-300">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
        );
      case 'score_posted':
      case 'gameweek_result':
      case 'rank_movement':
        return (
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
          </div>
        );
      case 'league_activity':
      case 'league_result':
      case 'h2h_result':
        return (
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/15 text-cyan-300">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3h14a2 2 0 012 2v14l-4-3-4 3-4-3-4 3V5a2 2 0 012-2z"></path></svg>
          </div>
        );
      default:
        return (
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-slate-300">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
        );
    }
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getActionHref = (type: string) => {
    switch (type) {
      case 'gameweek_deadline':
      case 'lineup_deadline':
      case 'deadline_reminder':
      case 'deadline':
        return '/lineups';
      case 'price_change':
      case 'transfer_market':
      case 'wildcard_used':
        return '/transfers';
      case 'score_posted':
      case 'gameweek_result':
      case 'rank_movement':
        return '/gameweeks';
      case 'rank_update':
        return '/leaderboard';
      case 'player_removed':
      case 'system':
      case 'player_unavailable':
        return '/transfers';
      case 'league_activity':
      case 'league_result':
      case 'h2h_result':
        return '/leagues';
      case 'issue_report_status':
        return '/report-issue';
      default:
        return '/dashboard';
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case 'gameweek_deadline':
      case 'lineup_deadline':
      case 'deadline_reminder':
      case 'deadline':
        return 'Set Lineup Now';
      case 'price_change':
      case 'transfer_market':
      case 'wildcard_used':
        return 'Open Transfer Market';
      case 'score_posted':
      case 'gameweek_result':
      case 'rank_movement':
        return 'View Gameweek';
      case 'rank_update':
        return 'View Leaderboard';
      case 'player_removed':
        return 'Replace Player';
      case 'system':
      case 'player_unavailable':
        return 'Review Squad';
      case 'league_activity':
      case 'league_result':
      case 'h2h_result':
        return 'Open League';
      case 'issue_report_status':
        return 'View Report';
      default:
        return 'View Feed';
    }
  };

  const getNotificationPresentation = (notification: Notification) => {
    const type = notification.type;
    const priceChange = Number(notification.metadata?.price_change ?? 0);
    if (type === 'issue_report_status') {
      return {
        Icon: Bug,
        label: 'Issue report',
        iconTone: 'text-violet-700 dark:text-violet-300',
        iconSurface: 'border-violet-500/30 bg-violet-500/10',
        rowTone: 'border-l-violet-500',
      };
    }
    if (type === 'player_removed' || type === 'player_unavailable' || (type === 'system' && notification.metadata?.player_id)) {
      return {
        Icon: AlertTriangle,
        label: 'Squad alert',
        iconTone: 'text-rose-700 dark:text-rose-300',
        iconSurface: 'border-rose-500/30 bg-rose-500/10',
        rowTone: 'border-l-rose-500',
      };
    }
    if (['gameweek_deadline', 'lineup_deadline', 'deadline_reminder', 'deadline'].includes(type)) {
      return {
        Icon: Clock,
        label: 'Deadline',
        iconTone: 'text-amber-700 dark:text-amber-300',
        iconSurface: 'border-amber-500/30 bg-amber-500/10',
        rowTone: 'border-l-amber-500',
      };
    }
    if (type === 'price_change' && priceChange < 0) {
      return {
        Icon: TrendingDown,
        label: 'Market',
        iconTone: 'text-rose-700 dark:text-rose-300',
        iconSurface: 'border-rose-500/30 bg-rose-500/10',
        rowTone: 'border-l-rose-500',
      };
    }
    if (['price_change', 'transfer_market', 'wildcard_used'].includes(type)) {
      return {
        Icon: TrendingUp,
        label: 'Market',
        iconTone: 'text-emerald-700 dark:text-emerald-300',
        iconSurface: 'border-emerald-500/30 bg-emerald-500/10',
        rowTone: 'border-l-emerald-500',
      };
    }
    if (['league_activity', 'league_result', 'league_invite', 'h2h_result'].includes(type)) {
      return {
        Icon: Trophy,
        label: 'League',
        iconTone: 'text-violet-700 dark:text-violet-300',
        iconSurface: 'border-violet-500/30 bg-violet-500/10',
        rowTone: 'border-l-violet-500',
      };
    }
    if (['score_posted', 'gameweek_result', 'rank_movement', 'rank_update'].includes(type)) {
      return {
        Icon: TrendingUp,
        label: 'Scoring',
        iconTone: 'text-emerald-700 dark:text-emerald-300',
        iconSurface: 'border-emerald-500/30 bg-emerald-500/10',
        rowTone: 'border-l-emerald-500',
      };
    }
    return {
      Icon: Info,
      label: 'Update',
      iconTone: 'text-[var(--text-secondary)]',
      iconSurface: 'border-[var(--border)] bg-[var(--surface-raised)]',
      rowTone: 'border-l-[var(--border)]',
    };
  };

  const getActionForNotification = (notification: Notification) => {
    const { type, metadata } = notification;
    const playerId = Number(metadata?.player_id);
    const gameweekId = Number(metadata?.gameweek_id);
    if (['player_unavailable', 'system'].includes(type) && Number.isInteger(playerId) && playerId > 0) {
      return { href: `/players/${playerId}`, label: 'View Player' };
    }
    if (type === 'player_removed') return { href: '/transfers', label: 'Replace Player' };
    if (['gameweek_result', 'score_posted'].includes(type) && Number.isInteger(gameweekId) && gameweekId > 0) {
      return { href: `/gameweeks/${gameweekId}`, label: 'View Gameweek' };
    }
    if (type === 'rank_update') return { href: '/leaderboard', label: 'View Leaderboard' };
    if (type === 'issue_report_status') {
      const reportId = Number(metadata?.issue_report_id);
      return {
        href: Number.isSafeInteger(reportId) && reportId > 0 ? `/report-issue?report=${reportId}` : '/report-issue',
        label: 'View Report',
      };
    }
    return { href: getActionHref(type), label: getActionLabel(type) };
  };

  const visibleNotifications = notifications;

  const getEmptyStateConfig = (category: NotificationCategory) => {
    switch (category) {
      case 'deadline':
        return {
          icon: Clock,
          color: 'text-amber-700 border-amber-500/30 bg-amber-500/10 dark:text-amber-300',
          title: 'No deadline alerts',
          description: 'You have no pending lineup locks, transfer cutoffs, or upcoming gameweek deadlines.',
          actionHref: '/lineups',
          actionText: 'Check Lineup',
        };
      case 'market':
        return {
          icon: TrendingUp,
          color: 'text-emerald-700 border-emerald-500/30 bg-emerald-500/10 dark:text-emerald-300',
          title: 'No market updates',
          description: 'No player price changes, transfer market trends, or chip alerts to report right now.',
          actionHref: '/transfers',
          actionText: 'Browse Market',
        };
      case 'scoring':
        return {
          icon: Sparkles,
          color: 'text-emerald-700 border-emerald-500/30 bg-emerald-500/10 dark:text-emerald-300',
          title: 'No scoring updates',
          description: 'Scores, match completions, and fantasy point adjustments will appear here when games conclude.',
          actionHref: '/gameweeks',
          actionText: 'View Gameweeks',
        };
      case 'league':
        return {
          icon: Trophy,
          color: 'text-violet-700 border-violet-500/30 bg-violet-500/10 dark:text-violet-300',
          title: 'No league activity',
          description: 'No head-to-head match results, rank movements, or commissioner messages yet.',
          actionHref: '/leagues',
          actionText: 'Go to Leagues',
        };
      case 'unread':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
          title: 'No unread notifications',
          description: "You're all caught up! All your notifications have been marked as read.",
          actionHref: null,
          actionText: null,
        };
      case 'all':
      default:
        return {
          icon: Bell,
          color: 'text-[var(--text-secondary)] border-[var(--border)] bg-[var(--surface-raised)]',
          title: 'You are all caught up',
          description: 'No fantasy alerts or notifications right now. Check back during upcoming match days!',
          actionHref: '/dashboard',
          actionText: 'Back to Dashboard',
        };
    }
  };

  const emptyConfig = getEmptyStateConfig(activeCategory);
  const EmptyIcon = emptyConfig.icon;
  const notificationGroups = groupNotificationsByDay(visibleNotifications);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="mb-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-800 dark:text-cyan-300">
            Fantasy Alert Center
          </div>
          <h1 className="text-3xl font-black text-[var(--text-primary)]">Notifications</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Deadline alerts, market moves, league updates, and gameweek score changes.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={markingAllRead}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {markingAllRead ? 'Marking as read...' : `Mark all read · ${unreadCount}`}
            </button>
          )}
          {notifications.some((notification) => notification.is_read) && (
            <button type="button" onClick={handleClearRead} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
              Clear read
            </button>
          )}
          <Link href="/settings?section=notifications" className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
            Notification preferences
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2">
        {categories.map((category) => {
          const count = category.key === 'unread' ? unreadCount : null;
          const isActive = activeCategory === category.key;
          return (
            <button
              key={category.key}
              type="button"
              onClick={() => {
                const cached = categoryCache.current.get(category.key);
                setNotifications(cached?.notifications ?? []);
                setUnreadCount(cached?.unreadCount ?? unreadCount);
                setNextCursor(cached?.nextCursor ?? null);
                setLoading(!cached);
                setError(null);
                setLoadingMore(false);
                setActiveCategory(category.key);
              }}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${isActive ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-900 dark:text-cyan-200' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]'}`}
            >
              <span>{category.label}</span>
              {count !== null && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-cyan-500/20 text-current' : 'bg-[var(--surface-raised)] text-[var(--text-muted)]'}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          [1, 2, 3, 4].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
          ))
        ) : visibleNotifications.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border ${emptyConfig.color}`}>
              <EmptyIcon className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-white">{emptyConfig.title}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">{emptyConfig.description}</p>
            {emptyConfig.actionHref && emptyConfig.actionText && (
              <div className="mt-6">
                <Link
                  href={emptyConfig.actionHref}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300 transition hover:bg-cyan-500/20 hover:text-cyan-200"
                >
                  {emptyConfig.actionText}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <>
          {notificationGroups.map((group) => (
            <section key={group.label} aria-labelledby={`notification-group-${group.label.toLowerCase().replaceAll(' ', '-')}`}>
              <h2
                id={`notification-group-${group.label.toLowerCase().replaceAll(' ', '-')}`}
                className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-cyan-700 dark:text-cyan-300">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <span>{group.label === 'Earlier' ? 'Earlier This Season' : group.label}</span>
                <span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true" />
                <span className="rounded-full bg-[var(--surface-raised)] px-2 py-1 text-[10px] font-medium text-[var(--text-muted)]">
                  {group.notifications.length}
                </span>
              </h2>
              <div className="space-y-4">
                {group.notifications.map((notification) => {
                  const presentation = getNotificationPresentation(notification);
                  const NotificationIcon = presentation.Icon;
                  const action = getActionForNotification(notification);
                  const dateTitle = new Date(notification.created_at).toLocaleString();
                  const gameweekNumber = Number(notification.metadata?.gameweek_number);

                  return (
                    <div key={notification.id} className={`flex flex-col gap-3 rounded-xl border border-l-4 bg-[var(--surface)] p-4 transition-colors md:flex-row md:items-start ${
                      notification.is_read
                        ? 'border-[var(--border)] border-l-[var(--border)] opacity-75'
                        : `${presentation.rowTone} hover:bg-[var(--surface-raised)]`
                    }`}>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${presentation.iconSurface} ${presentation.iconTone}`}>
                        {presentation.label === 'Update'
                          ? getIconForType(notification.type)
                          : <NotificationIcon className="h-5 w-5" aria-hidden="true" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${presentation.iconSurface} ${presentation.iconTone}`}>
                              {presentation.label}
                            </span>
                            {!notification.is_read && (
                              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-800 dark:text-cyan-300">
                                Unread
                              </span>
                            )}
                          </div>
                          <time title={dateTitle} dateTime={notification.created_at} className="text-xs text-[var(--text-muted)]">{timeAgo(notification.created_at)}</time>
                        </div>

                        <h3 className="text-base font-semibold text-[var(--text-primary)]">{notification.title}</h3>
                        <p className="mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">{notification.message}</p>
                        {Number.isInteger(gameweekNumber) && gameweekNumber > 0 && (
                          <p className="mt-2 text-xs font-medium text-[var(--text-muted)]">Gameweek {gameweekNumber}</p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <Link href={action.href} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-cyan-400">
                            {action.label} →
                          </Link>
                          {!notification.is_read && (
                            <button type="button" onClick={() => handleMarkAsRead(notification.id)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {!loading && nextCursor && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => void loadMoreNotifications()}
                disabled={loadingMore}
                className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-500/20 disabled:cursor-wait disabled:opacity-60 dark:text-cyan-300"
              >
                {loadingMore ? 'Loading...' : 'Load more notifications'}
              </button>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
