'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useHeaderData } from '@/context/HeaderDataContext';
import type { HeaderNotification } from './header-types';

function notificationHref(type: string) {
  switch (type) {
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
  const { notifications, unreadCount, markNotificationRead } = useHeaderData();
  const [currentTime, setCurrentTime] = useState(0);

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
        className="relative rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-slate-900" />
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
            <p className="text-sm font-semibold text-white">Notifications</p>
            {unreadCount > 0 && <span className="text-xs text-cyan-400">{unreadCount} unread</span>}
          </div>
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">You are all caught up.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notificationHref(notification.type)}
                  onClick={() => void handleNotificationClick(notification)}
                  className={`block border-b border-slate-800 px-3 py-3 transition hover:bg-slate-800/60 last:border-b-0 ${notification.is_read ? 'opacity-70' : 'bg-slate-800/20'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {!notification.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />}
                      <p className="truncate text-sm font-medium text-white">{notification.title}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500">{formatNotificationTime(notification.created_at)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{notification.message}</p>
                </Link>
              ))}
            </div>
          )}
          <Link href="/notifications" onClick={onClose} className="mt-2 block rounded-md border border-slate-700 px-3 py-2 text-center text-sm font-medium text-cyan-400 hover:bg-slate-800 hover:text-cyan-300">
            View All Notifications
          </Link>
        </div>
      )}
    </div>
  );
}
