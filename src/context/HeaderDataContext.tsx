'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import {
  PROFILE_UPDATED_EVENT,
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
  /** Call after the user marks a notification read to update local state. */
  markNotificationRead: (id: number) => void;
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

    function handleProfileUpdated(event: Event) {
      const update = (event as CustomEvent<Partial<HeaderProfile>>).detail;
      if (!update) {
        void loadProfile();
        return;
      }
      setProfile((current) => (current ? { ...current, ...update } : current));
    }

    window.addEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleProfileUpdated);
    };
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

  // ── Notifications ─────────────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/notifications?limit=5');
      if (!response.ok) return;
      const data = (await response.json()) as {
        notifications: HeaderNotification[];
        unreadCount: number;
      };
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (error) {
      console.error('Unable to load Header notifications:', error);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadNotifications(), 0);

    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refreshNotifications = async () => {
      try {
        const response = await fetchWithAuth('/api/notifications?limit=5');
        if (!response.ok) return;
        const data = (await response.json()) as {
          notifications: HeaderNotification[];
          unreadCount: number;
        };
        if (disposed) return;
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      } catch (error) {
        console.error('Failed to refresh notifications after realtime event:', error);
      }
    };

    const setupRealtime = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (disposed || !session?.user.id) return;

      channel = supabase
        .channel(`user-notifications:${session.user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_notifications',
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            const notification = payload.new as HeaderNotification;
            if (notification.is_read === false) {
              showNotificationToast(notification.title, notification.message, 7000);
            }
            void refreshNotifications();
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_notifications',
            filter: `user_id=eq.${session.user.id}`,
          },
          () => void refreshNotifications(),
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

    void setupRealtime().catch((error: unknown) => {
      if (!disposed) console.error('Unable to set up realtime notification subscription:', error);
    });

    return () => {
      disposed = true;
      window.clearTimeout(initialLoad);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadNotifications, showNotificationToast]);

  // ── Helpers exposed to consumers ─────────────────────────────────────────
  const markNotificationRead = useCallback((id: number) => {
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
  }, []);

  return (
    <HeaderDataContext.Provider
      value={{
        profile,
        quickStats,
        notifications,
        unreadCount,
        markNotificationRead,
        refreshQuickStats: loadQuickStats,
      }}
    >
      {children}
    </HeaderDataContext.Provider>
  );
}
