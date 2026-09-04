'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from './theme/ThemeToggle';

type HeaderProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type HeaderNotification = {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.sidebarCollapsed = String(sidebarCollapsed);
    window.localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch('/api/user/profile');
        if (!response.ok) return;
        const data = (await response.json()) as { profile: HeaderProfile | null };
        setProfile(data.profile);
      } catch {
        // Keep the initials fallback when the profile is unavailable.
      }
    }

    void loadProfile();
  }, []);

  useEffect(() => {
    async function loadNotifications() {
      try {
        const response = await fetch('/api/notifications?limit=5');
        if (!response.ok) return;
        const data = (await response.json()) as { notifications: HeaderNotification[] };
        setNotifications(data.notifications ?? []);
      } catch {
        setNotifications([]);
      }
    }

    void loadNotifications();
  }, []);

  useEffect(() => {
    function closeUserMenu(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    function closeUserMenuOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
        setNotificationMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', closeUserMenu);
    document.addEventListener('keydown', closeUserMenuOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeUserMenu);
      document.removeEventListener('keydown', closeUserMenuOnEscape);
    };
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } finally {
      setUserMenuOpen(false);
      setNotificationMenuOpen(false);
      router.push('/login');
      router.refresh();
    }
  };

  const initials = (profile?.display_name || profile?.username || 'U').slice(0, 1).toUpperCase();
  const unreadNotifications = notifications.filter((notification) => !notification.is_read).length;
  const formatNotificationTime = (createdAt: string) => {
    if (!currentTime) return 'Recently';
    const minutes = Math.max(0, Math.floor((currentTime - new Date(createdAt).getTime()) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };
  const userMenu = (
    <div className="absolute right-0 top-12 z-50 w-48 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
      <div className="border-b border-slate-700 px-3 py-2">
        <p className="truncate text-sm font-medium text-white">{profile?.display_name || profile?.username || 'Account'}</p>
        {profile?.username && <p className="truncate text-xs text-slate-400">@{profile.username}</p>}
      </div>
      <Link href="/profile" onClick={() => setUserMenuOpen(false)} className="mt-1 block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
        Profile
      </Link>
      <Link href="/account" onClick={() => setUserMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
        Account
      </Link>
      <button onClick={handleSignOut} disabled={signingOut} className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-60">
        {signingOut ? 'Signing Out...' : 'Sign Out'}
      </button>
    </div>
  );
  const notificationMenu = (
    <div className="absolute right-0 top-12 z-50 w-80 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
        <p className="text-sm font-semibold text-white">Notifications</p>
        {unreadNotifications > 0 && <span className="text-xs text-cyan-400">{unreadNotifications} unread</span>}
      </div>
      {notifications.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-slate-400">You are all caught up.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          {notifications.map((notification) => (
            <div key={notification.id} className={`border-b border-slate-800 px-3 py-3 last:border-b-0 ${notification.is_read ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-white">{notification.title}</p>
                <span className="shrink-0 text-[11px] text-slate-500">{formatNotificationTime(notification.created_at)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{notification.message}</p>
            </div>
          ))}
        </div>
      )}
      <Link href="/notifications" onClick={() => setNotificationMenuOpen(false)} className="mt-2 block rounded-md border border-slate-700 px-3 py-2 text-center text-sm font-medium text-cyan-400 hover:bg-slate-800 hover:text-cyan-300">
        View All Notifications
      </Link>
    </div>
  );

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const primaryNavLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/squads', label: 'Squad' },
    { href: '/lineups', label: 'Lineups' },
    { href: '/transfers', label: 'Transfers' },
    { href: '/leagues', label: 'Leagues' },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/gameweeks', label: 'Gameweeks' },
    { href: '/tournaments', label: 'Tournaments' },
    { href: '/matches', label: 'Matches' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/guide', label: 'Guide' },
  ];

  const allNavLinks = primaryNavLinks;

  return (
    <>
      <aside className={`dashboard-sidebar fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-slate-700 bg-slate-900 px-4 py-6 transition-[width] duration-200 md:flex ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`mb-8 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/dashboard" className="flex items-center gap-2 px-2 font-bold text-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-amber-500 to-orange-600">
              <span className="font-bold text-white">D2</span>
            </div>
            {!sidebarCollapsed && <span className="bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">Fantasy</span>}
          </Link>
          {!sidebarCollapsed && (
            <button type="button" aria-label="Collapse sidebar" onClick={() => setSidebarCollapsed(true)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
        </div>
        {sidebarCollapsed && (
          <button type="button" aria-label="Expand sidebar" onClick={() => setSidebarCollapsed(false)} className="mb-6 self-center rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
        <nav className="flex flex-1 flex-col gap-1">
          {allNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              title={sidebarCollapsed ? link.label : undefined}
              className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${sidebarCollapsed ? 'text-center' : ''} ${
                isActive(link.href)
                  ? 'bg-amber-500/20 text-amber-500'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {sidebarCollapsed ? link.label.slice(0, 1) : link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <header className="dashboard-header sticky top-0 z-40 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
      <nav ref={userMenuRef} className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl md:hidden">
            <div className="w-8 h-8 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">D2</span>
            </div>
            <span className="bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
              Fantasy
            </span>
          </Link>

          <div className="hidden flex-1 md:block" />

          {/* User Menu (Desktop) */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <div className="relative">
              <button type="button" aria-label="Open notifications" aria-expanded={notificationMenuOpen} onClick={() => { setNotificationMenuOpen(!notificationMenuOpen); setUserMenuOpen(false); }} className="relative rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-slate-900" />}
              </button>
              {notificationMenuOpen && notificationMenu}
            </div>
            <div className="relative">
              <button type="button" aria-label="Open user menu" aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen(!userMenuOpen)} className="h-9 w-9 overflow-hidden rounded-full border border-slate-600 bg-slate-800 text-sm font-bold text-white hover:border-amber-500">
                {profile?.avatar_url ? <Image src={profile.avatar_url} alt="User avatar" width={36} height={36} unoptimized className="h-full w-full object-cover" /> : initials}
              </button>
              {userMenuOpen && userMenu}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-3 md:hidden">
            <div className="relative">
              <button type="button" aria-label="Open notifications" aria-expanded={notificationMenuOpen} onClick={() => { setNotificationMenuOpen(!notificationMenuOpen); setUserMenuOpen(false); }} className="relative rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-slate-900" />}
              </button>
              {notificationMenuOpen && notificationMenu}
            </div>
            <div className="relative">
              <button type="button" aria-label="Open user menu" aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen(!userMenuOpen)} className="h-9 w-9 overflow-hidden rounded-full border border-slate-600 bg-slate-800 text-sm font-bold text-white hover:border-amber-500">
                {profile?.avatar_url ? <Image src={profile.avatar_url} alt="User avatar" width={36} height={36} unoptimized className="h-full w-full object-cover" /> : initials}
              </button>
              {userMenuOpen && userMenu}
            </div>
            <button
              className="text-slate-400 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-700 py-4 space-y-2">
            {allNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-4 py-2 rounded-lg font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-slate-700 pt-4 mt-4">
              <div className="px-4 py-2"><ThemeToggle /></div>
            </div>
          </div>
        )}
      </nav>
      </header>
    </>
  );
}
