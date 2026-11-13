'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import {
  type HeaderNotification,
  type HeaderProfile,
  type QuickStats,
} from '@/components/header-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeaderDataContextValue {
  profile: HeaderProfile | null;
  quickStats: QuickStats | null;
  notifications: HeaderNotification[];
  unreadCount: number;
  /** Apply a successful profile update to the shared header state. */
  updateProfile: (update: Partial<HeaderProfile>) => void;
  /** Call after the user marks a notification read to update local state. */
  markNotificationRead: (id: number) => void;
  /** Mark all notifications as read in local state. */
  markAllNotificationsRead: () => void;
  /** Dismiss/remove a single notification from local state. */
  dismissNotification: (id: number) => void;
  /** Force-refresh quick-stats (e.g. after a transfer). */
  refreshQuickStats: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const HeaderDataContext = createContext<HeaderDataContextValue | null>(null);

export function useHeaderData(): HeaderDataContextValue {
  const ctx = useContext(HeaderDataContext);
  if (!ctx) throw new Error('useHeaderData must be used inside <HeaderDataProvider>');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider – lives in the root layout so it is NEVER unmounted on navigation
// ---------------------------------------------------------------------------

export function HeaderDataProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRequestId = useRef(0);
  const activeNotificationUserId = useRef<string | null>(null);
  const showNotificationToast = useToast().info;

  // ── Profile ──────────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/user/profile');
      if (!response.ok) return;
      const data = (await response.json()) as { profile: HeaderProfile | null };
      setProfile(data.profile);
    } catch {
      // silently keep previous value
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadProfile(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadProfile]);

  // ── Quick Stats ───────────────────────────────────────────────────────────
  const loadQuickStats = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/user/quick-stats');
      if (!response.ok) return;
      const data = await response.json();
      setQuickStats({
        bankBalance: Number(data.bankBalance || 0),
        freeTransfers: Number(data.freeTransfers || 0),
        globalRank: data.globalRank ?? null,
        totalPoints: Number(data.totalPoints || 0),
        gameweek: data.gameweek || null,
      });
    } catch (error) {
      console.error('Unable to load Header quick stats:', error);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadQuickStats(), 0);
    window.addEventListener('fantasy:stats-updated', loadQuickStats);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener('fantasy:stats-updated', loadQuickStats);
    };
  }, [loadQuickStats]);

  // ── Auth state changes ────────────────────────────────────────────────────
  // Reload profile + stats when a new user signs in, clear them on sign-out.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        void loadProfile();
        void loadQuickStats();
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setQuickStats(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [loadProfile, loadQuickStats]);

  // ── Notifications ─────────────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    const requestId = ++notificationRequestId.current;
    try {
      const response = await fetchWithAuth('/api/notifications?limit=5');
      if (!response.ok || requestId !== notificationRequestId.current) return;
      const data = (await response.json()) as {
        notifications: HeaderNotification[];
        unreadCount: number;
      };
      if (requestId !== notificationRequestId.current) return;
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (error) {
      if (requestId === notificationRequestId.current) {
        console.error('Unable to load Header notifications:', error);
      }
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const clearNotifications = () => {
      notificationRequestId.current += 1;
      setNotifications([]);
      setUnreadCount(0);
    };

    const subscribeToUser = (userId: string | null) => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
      if (!userId) return;

      channel = supabase
        .channel(`user-notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (disposed || activeNotificationUserId.current !== userId) return;
            const notification = payload.new as HeaderNotification;
            if (notification.is_read === false) {
              showNotificationToast(notification.title, notification.message, 7000);
            }
            void loadNotifications();
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            if (!disposed && activeNotificationUserId.current === userId) {
              void loadNotifications();
            }
          },
        )
        .subscribe((status, error) => {
          if (disposed) return;
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            const msg = error?.message ?? status;
            if (msg.includes('1006') || msg.includes('socket closed')) {
              console.warn('[Realtime] Notification channel disconnected:', msg);
            } else {
              console.error('Realtime notification subscription failed:', msg);
            }
          }
        });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (disposed) return;

      if (event === 'SIGNED_OUT') {
        activeNotificationUserId.current = null;
        clearNotifications();
        subscribeToUser(null);
        return;
      }

      if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN') return;

      const userId = session?.user.id ?? null;
      if (userId !== activeNotificationUserId.current) {
        activeNotificationUserId.current = userId;
        clearNotifications();
      }
      subscribeToUser(userId);
      if (userId) void loadNotifications();
    });

    return () => {
      disposed = true;
      subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadNotifications, showNotificationToast]);

  // ── Helpers exposed to consumers ─────────────────────────────────────────
  const updateProfile = useCallback((update: Partial<HeaderProfile>) => {
    if (!profile) {
      void loadProfile();
      return;
    }
    setProfile((current) => current ? { ...current, ...update } : current);
  }, [loadProfile, profile]);

  const markNotificationRead = useCallback((id: number) => {
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((current) =>
      current.map((n) => ({ ...n, is_read: true })),
    );
    setUnreadCount(0);
  }, []);

  const dismissNotification = useCallback((id: number) => {
    setNotifications((current) => {
      const target = current.find((n) => n.id === id);
      if (target && !target.is_read) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      return current.filter((n) => n.id !== id);
    });
  }, []);

  return (
    <HeaderDataContext.Provider
      value={{
        profile,
        quickStats,
        notifications,
        unreadCount,
        updateProfile,
        markNotificationRead,
        markAllNotificationsRead,
        dismissNotification,
        refreshQuickStats: loadQuickStats,
      }}
    >
      {children}
    </HeaderDataContext.Provider>
  );
}
