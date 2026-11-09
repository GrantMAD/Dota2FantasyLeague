'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useHeaderData } from '@/context/HeaderDataContext';
import type { HeaderNotification } from './header-types';

function notificationHref(notification: HeaderNotification) {
  const leagueId = Number(notification.metadata?.league_id);
  if (Number.isSafeInteger(leagueId) && leagueId > 0) {
    return `/leagues?leagueId=${leagueId}`;
  }

  const gameweekId = Number(notification.metadata?.gameweek_id);
  if (
    ['gameweek_result', 'score_posted'].includes(notification.type) &&
    Number.isSafeInteger(gameweekId) &&
    gameweekId > 0
  ) {
    return `/gameweeks/${gameweekId}`;
  }

  const playerId = Number(notification.metadata?.player_id);
  if (notification.type === 'player_removed') {
    return '/transfers';
  }
  if (
    notification.type === 'player_unavailable' &&
    Number.isSafeInteger(playerId) &&
    playerId > 0
  ) {
    return `/players/${playerId}`;
  }

  switch (notification.type) {
    case 'gameweek_deadline':
    case 'lineup_deadline':
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
    case 'league_activity':
    case 'league_result':
    case 'h2h_result':
      return '/leagues';
    default:
      return '/notifications';
  }
}

export function NotificationDropdown({
  isOpen,
  onToggle,
  onClose,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotification,
  } = useHeaderData();
  const [currentTime, setCurrentTime] = useState(0);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [bellRinging, setBellRinging] = useState(false);
  const prevUnreadRef = useRef(unreadCount);

  // Ring the bell when unread count increases (new notification arrived)
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setBellRinging(true);
      const t = window.setTimeout(() => setBellRinging(false), 700);
      return () => window.clearTimeout(t);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

  const handleNotificationClick = async (notification: HeaderNotification) => {
    onClose();
    if (!notification.is_read) {
      markNotificationRead(notification.id);
      try {
        const response = await fetchWithAuth(`/api/notifications/${notification.id}/read`, { method: 'PUT' });
        if (!response.ok) throw new Error(`Mark notification read failed (${response.status}).`);
      } catch (error) {
        console.error('Failed to mark notification read:', error);
      }
    }
  };

  const handleInlineMarkAsRead = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    markNotificationRead(id);
    try {
      const response = await fetchWithAuth(`/api/notifications/${id}/read`, { method: 'PUT' });
      if (!response.ok) throw new Error(`Mark notification read failed (${response.status}).`);
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  };

  const handleDismiss = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    dismissNotification(id);
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMarkingAll || unreadCount === 0) return;
    setIsMarkingAll(true);
    markAllNotificationsRead();
    try {
      const response = await fetchWithAuth('/api/notifications', { method: 'PUT' });
      if (!response.ok) throw new Error(`Mark all notifications read failed (${response.status}).`);
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const formatNotificationTime = (createdAt: string) => {
    if (!currentTime) return 'Recently';
    const minutes = Math.max(0, Math.floor((currentTime - new Date(createdAt).getTime()) / 60_000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Open notifications"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="relative rounded-full p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
      >
        <Bell className={`h-5 w-5 ${bellRinging ? 'animate-bell-ring' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan-500 ring-2 ring-white dark:ring-slate-900" />
        )}
      </button>
      {isOpen && (
        <div className="animate-dropdown-in absolute right-0 top-12 z-50 w-84 sm:w-96 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Notifications</p>
              {unreadCount > 0 && (
                <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isMarkingAll}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-300 transition-colors disabled:opacity-50"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">You are all caught up.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group relative flex items-start justify-between gap-3 px-3 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    notification.is_read ? 'opacity-75' : 'bg-slate-50/60 dark:bg-slate-800/25'
                  }`}
                >
                  <Link
                    href={notificationHref(notification)}
                    onClick={() => void handleNotificationClick(notification)}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-1.5">
                      {!notification.is_read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-500 ring-2 ring-cyan-500/30 dark:bg-cyan-400" />
                      )}
                      <p className={`truncate text-sm font-semibold ${notification.is_read ? 'text-slate-500 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                        {notification.title}
                      </p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {notification.message}
                    </p>
                    <span className="mt-1.5 block text-[11px] text-slate-400 dark:text-slate-500">
                      {formatNotificationTime(notification.created_at)}
                    </span>
                  </Link>

                  <div className="flex shrink-0 items-center gap-1 pt-0.5">
                    {!notification.is_read && (
                      <button
                        type="button"
                        onClick={(e) => void handleInlineMarkAsRead(e, notification.id)}
                        className="rounded p-1 text-slate-400 hover:bg-cyan-500/20 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors"
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDismiss(e, notification.id)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:text-slate-500 dark:hover:text-slate-300 transition-colors opacity-70 group-hover:opacity-100"
                      title="Dismiss from list"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/notifications"
            onClick={onClose}
            className="mt-2 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-cyan-600 hover:bg-slate-100 hover:text-cyan-700 dark:border-slate-700/80 dark:bg-slate-800/40 dark:text-cyan-300 dark:hover:bg-slate-800 dark:hover:text-cyan-200 transition-colors"
          >
            View All Notifications
          </Link>
        </div>
      )}
    </div>
  );
}
