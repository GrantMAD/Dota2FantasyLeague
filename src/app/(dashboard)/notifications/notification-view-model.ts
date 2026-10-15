import type { NotificationRecord } from '@/types/fantasy';

export type NotificationCategory = 'all' | 'unread' | 'deadline' | 'market' | 'scoring' | 'league';

export const NOTIFICATION_CATEGORY_CACHE_TTL_MS = 60_000;

export interface NotificationCategoryCacheEntry {
  notifications: NotificationRecord[];
  unreadCount: number;
  nextCursor: string | null;
  fetchedAt: number;
}

export interface NotificationGroup {
  label: string;
  notifications: NotificationRecord[];
}

export function isNotificationCategoryCacheFresh(
  entry: NotificationCategoryCacheEntry,
  now = Date.now()
): boolean {
  return now - entry.fetchedAt < NOTIFICATION_CATEGORY_CACHE_TTL_MS;
}

export function markAllCachedNotificationsRead(
  cache: Map<NotificationCategory, NotificationCategoryCacheEntry>,
  now = Date.now()
): Map<NotificationCategory, NotificationCategoryCacheEntry> {
  return new Map([...cache].map(([category, entry]) => [
    category,
    {
      ...entry,
      notifications: category === 'unread'
        ? []
        : entry.notifications.map((notification) => ({ ...notification, is_read: true })),
      unreadCount: 0,
      nextCursor: category === 'unread' ? null : entry.nextCursor,
      fetchedAt: now,
    },
  ] as const));
}

export function markCachedNotificationRead(
  cache: Map<NotificationCategory, NotificationCategoryCacheEntry>,
  id: number,
  unreadCount: number,
  now = Date.now()
): Map<NotificationCategory, NotificationCategoryCacheEntry> {
  return new Map([...cache].map(([category, entry]) => {
    const notifications = entry.notifications
      .map((notification) => notification.id === id ? { ...notification, is_read: true } : notification)
      .filter((notification) => category !== 'unread' || !notification.is_read);
    return [
      category,
      {
        ...entry,
        notifications,
        unreadCount,
        nextCursor: category === 'unread' && notifications.length === 0 ? null : entry.nextCursor,
        fetchedAt: now,
      },
    ] as const;
  }));
}

export function removeReadCachedNotifications(
  cache: Map<NotificationCategory, NotificationCategoryCacheEntry>,
  now = Date.now()
): Map<NotificationCategory, NotificationCategoryCacheEntry> {
  return new Map([...cache].map(([category, entry]) => [
    category,
    {
      ...entry,
      notifications: entry.notifications.filter((notification) => !notification.is_read),
      fetchedAt: now,
    },
  ] as const));
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfLocalWeek(date: Date): Date {
  const start = startOfLocalDay(date);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

export function groupNotificationsByDay(
  notifications: NotificationRecord[],
  now = new Date()
): NotificationGroup[] {
  const today = startOfLocalDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = startOfLocalWeek(now);
  const groups = new Map<string, NotificationRecord[]>();

  for (const notification of notifications) {
    const createdAt = new Date(notification.created_at);
    const notificationDay = Number.isNaN(createdAt.getTime()) ? null : startOfLocalDay(createdAt);
    let label = 'Earlier';

    if (notificationDay && notificationDay.getTime() === today.getTime()) {
      label = 'Today';
    } else if (notificationDay && notificationDay.getTime() === yesterday.getTime()) {
      label = 'Yesterday';
    } else if (
      notificationDay &&
      notificationDay.getTime() >= weekStart.getTime() &&
      notificationDay.getTime() < yesterday.getTime()
    ) {
      label = 'This week';
    }

    const group = groups.get(label);
    if (group) group.push(notification);
    else groups.set(label, [notification]);
  }

  return [...groups].map(([label, groupedNotifications]) => ({
    label,
    notifications: groupedNotifications,
  }));
}
