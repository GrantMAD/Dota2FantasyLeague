import {
  groupNotificationsByDay,
  isNotificationCategoryCacheFresh,
  markAllCachedNotificationsRead,
  NOTIFICATION_CATEGORY_CACHE_TTL_MS,
  type NotificationCategory,
  type NotificationCategoryCacheEntry,
} from './notification-view-model';
import type { NotificationRecord } from '@/types/fantasy';

function notification(id: number, createdAt: Date | string): NotificationRecord {
  return {
    id,
    type: 'gameweek_result',
    title: `Notification ${id}`,
    message: 'Test notification',
    is_read: false,
    created_at: typeof createdAt === 'string' ? createdAt : createdAt.toISOString(),
  };
}

describe('notification view model', () => {
  it('keeps category results fresh for one minute, then treats them as stale', () => {
    const fetchedAt = 10_000;
    const entry = {
      notifications: [],
      unreadCount: 0,
      nextCursor: null,
      fetchedAt,
    };

    expect(isNotificationCategoryCacheFresh(entry, fetchedAt + NOTIFICATION_CATEGORY_CACHE_TTL_MS - 1)).toBe(true);
    expect(isNotificationCategoryCacheFresh(entry, fetchedAt + NOTIFICATION_CATEGORY_CACHE_TTL_MS)).toBe(false);
  });

  it('groups loaded notifications by local Today, Yesterday, This week, and Earlier dates', () => {
    const now = new Date(2026, 9, 15, 12);
    const notifications = [
      notification(1, new Date(2026, 9, 15, 10)),
      notification(2, new Date(2026, 9, 14, 10)),
      notification(3, new Date(2026, 9, 12, 10)),
      notification(4, new Date(2026, 9, 11, 10)),
      notification(5, 'invalid'),
    ];

    expect(groupNotificationsByDay(notifications, now).map(({ label, notifications: items }) => [
      label,
      items.map(({ id }) => id),
    ])).toEqual([
      ['Today', [1]],
      ['Yesterday', [2]],
      ['This week', [3]],
      ['Earlier', [4, 5]],
    ]);
  });

  it('combines notifications from separate loaded pages into the same day group', () => {
    const now = new Date(2026, 9, 15, 12);
    const groups = groupNotificationsByDay([
      notification(1, new Date(2026, 9, 15, 10)),
      notification(2, new Date(2026, 9, 15, 9)),
    ], now);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Today');
    expect(groups[0].notifications.map(({ id }) => id)).toEqual([1, 2]);
  });

  it('marks every cached category read and empties the unread category after a global bulk-read action', () => {
    const unread = notification(1, new Date(2026, 9, 15, 10));
    const read = { ...notification(2, new Date(2026, 9, 14, 10)), is_read: true };
    const cache = new Map<NotificationCategory, NotificationCategoryCacheEntry>([
      ['all', {
        notifications: [unread, read],
        unreadCount: 3,
        nextCursor: 'all-next',
        fetchedAt: 1,
      }],
      ['deadline', {
        notifications: [unread],
        unreadCount: 3,
        nextCursor: null,
        fetchedAt: 1,
      }],
      ['unread', {
        notifications: [unread],
        unreadCount: 3,
        nextCursor: 'unread-next',
        fetchedAt: 1,
      }],
    ]);

    const updated = markAllCachedNotificationsRead(cache, 20);

    expect(updated.get('all')).toMatchObject({
      notifications: [{ id: 1, is_read: true }, { id: 2, is_read: true }],
      unreadCount: 0,
      nextCursor: 'all-next',
      fetchedAt: 20,
    });
    expect(updated.get('deadline')?.notifications[0].is_read).toBe(true);
    expect(updated.get('unread')).toMatchObject({
      notifications: [],
      unreadCount: 0,
      nextCursor: null,
      fetchedAt: 20,
    });
    expect(cache.get('all')?.notifications[0].is_read).toBe(false);
  });
});
