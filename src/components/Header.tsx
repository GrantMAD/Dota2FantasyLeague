'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Users,
  UserCheck,
  ArrowLeftRight,
  Trophy,
  Medal,
  Calendar,
  Swords,
  Gamepad2,
  BarChart3,
  Compass,
  ScrollText,
  UserRound,
  Search,
  Wallet,
  Clock,
  Command,
  X,
  Sparkles,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useMemo } from 'react';
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

type QuickStats = {
  bankBalance: number;
  freeTransfers: number;
  globalRank: number | null;
  totalPoints: number;
  gameweek: {
    gameweek_number: number;
    deadline: string;
    status: string;
  } | null;
};

type SearchResultItem = {
  id: string | number;
  title: string;
  subtitle: string;
  category: 'Players' | 'Navigation' | 'Pages';
  href: string;
  badge?: string;
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
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [playerResults, setPlayerResults] = useState<SearchResultItem[]>([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    async function loadQuickStats() {
      try {
        const response = await fetch('/api/dashboard/stats');
        if (!response.ok) return;
        const data = await response.json();
        setQuickStats({
          bankBalance: Number(data.bankBalance || 0),
          freeTransfers: Number(data.freeTransfers || 0),
          globalRank: data.globalRank ?? null,
          totalPoints: Number(data.totalPoints || 0),
          gameweek: data.gameweek || null,
        });
      } catch {
        // Soft fallback
      }
    }

    void loadQuickStats();
  }, []);

  // Global Ctrl+K / Cmd+K handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus search input when modal opens
  useEffect(() => {
    if (searchOpen) {
      const timer = window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [searchOpen]);

  // Live player search inside command palette
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPlayers(true);
      try {
        const res = await fetch(`/api/players?search=${encodeURIComponent(trimmed)}&limit=5`);
        if (!res.ok) return;
        const json = await res.json();
        const players = Array.isArray(json.data) ? json.data : [];
        setPlayerResults(
          players.map((p: {
            id: number;
            name: string;
            in_game_name?: string | null;
            primary_role?: string | null;
            current_price?: number | null;
            professional_teams?: { name: string } | null;
          }) => ({
            id: p.id,
            title: p.in_game_name || p.name,
            subtitle: `${p.professional_teams?.name || 'Free Agent'} • ${p.primary_role || 'Player'}`,
            category: 'Players' as const,
            href: `/players/${p.id}`,
            badge: p.current_price ? `$${Number(p.current_price).toFixed(1)}M` : undefined,
          }))
        );
      } catch {
        setPlayerResults([]);
      } finally {
        setIsSearchingPlayers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    function closePopups(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
        setNotificationMenuOpen(false);
        setSearchOpen(false);
      }
    }

    document.addEventListener('mousedown', closePopups);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closePopups);
      document.removeEventListener('keydown', closeOnEscape);
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
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/squads', label: 'Squad', icon: Users },
    { href: '/lineups', label: 'Lineups', icon: UserCheck },
    { href: '/transfers', label: 'Transfers', icon: ArrowLeftRight },
    { href: '/players', label: 'Players', icon: UserRound },
    { href: '/leagues', label: 'Leagues', icon: Trophy },
    { href: '/leaderboard', label: 'Leaderboard', icon: Medal },
    { href: '/gameweeks', label: 'Gameweeks', icon: Calendar },
    { href: '/tournaments', label: 'Tournaments', icon: Swords },
    { href: '/matches', label: 'Matches', icon: Gamepad2 },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const bottomNavLinks = [
    { href: '/guide', label: 'Guide', icon: Compass },
    { href: '/rules', label: 'League Rules', icon: ScrollText },
  ];

  // Breadcrumb label map
  const pageTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/squads': 'Squad Management',
    '/lineups': 'Active Lineup',
    '/transfers': 'Transfers & Market',
    '/players': 'Players Directory',
    '/leagues': 'Leagues & Cups',
    '/leaderboard': 'Global Leaderboard',
    '/gameweeks': 'Gameweek Schedule',
    '/tournaments': 'Tournaments',
    '/matches': 'Matches & Results',
    '/analytics': 'Performance Analytics',
    '/guide': 'Manager Guide',
    '/rules': 'League Rules',
    '/profile': 'Manager Profile',
    '/account': 'Account Settings',
    '/notifications': 'Notification Center',
  };

  const currentPageTitle = pageTitles[pathname] || (pathname.startsWith('/players/') ? 'Player Inspection' : 'Dota 2 Fantasy');

  // Format deadline countdown
  const deadlineCountdown = useMemo(() => {
    if (!quickStats?.gameweek?.deadline || !currentTime) return null;
    const deadlineMs = new Date(quickStats.gameweek.deadline).getTime();
    const diff = deadlineMs - currentTime;
    if (diff <= 0) return 'Deadline passed';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours < 24) {
      return `${hours}h ${mins}m`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }, [quickStats, currentTime]);

  const staticNavigationItems: SearchResultItem[] = useMemo(
    () => [
      { id: 'nav-dash', title: 'Dashboard', subtitle: 'Overview, stats and rank', category: 'Navigation', href: '/dashboard' },
      { id: 'nav-squads', title: 'My Squad', subtitle: 'Pitch formation and players', category: 'Navigation', href: '/squads' },
      { id: 'nav-lineups', title: 'Lineups', subtitle: 'Captain & Vice Captain pick', category: 'Navigation', href: '/lineups' },
      { id: 'nav-transfers', title: 'Transfer Market', subtitle: 'Buy and sell pro players', category: 'Navigation', href: '/transfers' },
      { id: 'nav-players', title: 'Players Directory', subtitle: 'Browse all pro statistics', category: 'Navigation', href: '/players' },
      { id: 'nav-leagues', title: 'Leagues', subtitle: 'Private & public standings', category: 'Navigation', href: '/leagues' },
      { id: 'nav-leaderboard', title: 'Leaderboard', subtitle: 'Top global fantasy managers', category: 'Navigation', href: '/leaderboard' },
      { id: 'nav-gameweeks', title: 'Gameweek Schedule', subtitle: 'Deadlines and fixtures', category: 'Navigation', href: '/gameweeks' },
      { id: 'nav-rules', title: 'League Rules', subtitle: 'Scoring system breakdown', category: 'Pages', href: '/rules' },
      { id: 'nav-guide', title: 'Manager Guide', subtitle: 'Tips and interactive tour', category: 'Pages', href: '/guide' },
    ],
    []
  );

  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return staticNavigationItems.slice(0, 5);
    }
    const query = searchQuery.toLowerCase().trim();
    const matchedPages = staticNavigationItems.filter(
      (item) => item.title.toLowerCase().includes(query) || item.subtitle.toLowerCase().includes(query)
    );
    return [...playerResults, ...matchedPages];
  }, [searchQuery, playerResults, staticNavigationItems]);

  return (
    <>
      <aside className={`dashboard-sidebar fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-slate-700 bg-slate-900 px-4 py-6 transition-[width] duration-200 md:flex ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`mb-6 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
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
          <button type="button" aria-label="Expand sidebar" onClick={() => setSidebarCollapsed(false)} className="mb-4 self-center rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
        <nav className="flex flex-1 flex-col justify-between overflow-y-auto overflow-x-hidden">
          <div className="space-y-1">
            {primaryNavLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={sidebarCollapsed ? link.label : undefined}
                  className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                    sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                  } ${
                    active
                      ? 'bg-amber-500/20 text-amber-500'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-amber-500' : 'text-slate-400'}`} />
                  {!sidebarCollapsed && <span className="truncate">{link.label}</span>}
                </Link>
              );
            })}
          </div>

          <div className="mt-auto border-t border-slate-800/80 pt-3 space-y-1">
            {bottomNavLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={sidebarCollapsed ? link.label : undefined}
                  className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                    sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                  } ${
                    active
                      ? 'bg-amber-500/20 text-amber-500'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-amber-500' : 'text-slate-400'}`} />
                  {!sidebarCollapsed && <span className="truncate">{link.label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      <header className="dashboard-header sticky top-0 z-40 border-b border-slate-700/80 bg-slate-900/95 backdrop-blur-md">
        <nav ref={userMenuRef} className="mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16 gap-4">
            
            {/* Mobile Brand */}
            <Link href="/" className="flex items-center gap-2 font-bold text-xl md:hidden shrink-0">
              <div className="w-8 h-8 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">D2</span>
              </div>
              <span className="bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                Fantasy
              </span>
            </Link>

            {/* Left: Breadcrumbs & Context Title (Desktop) */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Fantasy
              </span>
              <span className="text-slate-600 font-medium">/</span>
              <h1 className="text-sm font-bold text-white tracking-wide">
                {currentPageTitle}
              </h1>
            </div>

            {/* Center: Command Palette / Quick Search Trigger */}
            <div className="hidden lg:flex flex-1 max-w-xs xl:max-w-md mx-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all text-xs group shadow-inner"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-400 transition-colors" />
                  <span className="truncate">Search players, teams, leagues...</span>
                </div>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-900/80 border border-slate-700 rounded">
                  <Command className="h-2.5 w-2.5" /> K
                </kbd>
              </button>
            </div>

            {/* Right: Fantasy HUD Pills & Actions */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              
              {/* Quick Search Icon for Tablets & Smaller Screens */}
              <button
                type="button"
                aria-label="Open search"
                onClick={() => setSearchOpen(true)}
                className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>

              {/* Fantasy HUD Pills (Desktop) */}
              <div className="hidden sm:flex items-center gap-2">
                {/* Gameweek Deadline Status Pill */}
                {quickStats?.gameweek && (
                  <Link
                    href="/gameweeks"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-medium text-amber-400 transition-colors"
                    title={`GW${quickStats.gameweek.gameweek_number} Deadline`}
                  >
                    <Clock className="h-3.5 w-3.5 animate-pulse" />
                    <span>GW{quickStats.gameweek.gameweek_number}:</span>
                    <span className="font-semibold text-white">{deadlineCountdown || 'Active'}</span>
                  </Link>
                )}

                {/* Bank Balance Pill */}
                <Link
                  href="/transfers"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-xs text-slate-300 transition-colors"
                  title="Remaining Transfer Budget"
                >
                  <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-semibold text-emerald-400">
                    ${Number(quickStats?.bankBalance ?? 100).toFixed(1)}M
                  </span>
                </Link>

                {/* Free Transfers Chip */}
                <Link
                  href="/transfers"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-xs text-slate-300 transition-colors"
                  title="Available Free Transfers"
                >
                  <ArrowLeftRight className="h-3 w-3 text-cyan-400" />
                  <span>
                    <span className="font-semibold text-white">{quickStats?.freeTransfers ?? 1}</span> FT
                  </span>
                </Link>
              </div>

              {/* Vertical Divider */}
              <div className="hidden sm:block h-5 w-px bg-slate-700/80 mx-1" />

              {/* Theme Toggle */}
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>

              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  aria-label="Open notifications"
                  aria-expanded={notificationMenuOpen}
                  onClick={() => {
                    setNotificationMenuOpen(!notificationMenuOpen);
                    setUserMenuOpen(false);
                  }}
                  className="relative rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotifications > 0 && (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-slate-900" />
                  )}
                </button>
                {notificationMenuOpen && notificationMenu}
              </div>

              {/* User Avatar Menu */}
              <div className="relative">
                <button
                  type="button"
                  aria-label="Open user menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="h-9 w-9 overflow-hidden rounded-full border border-slate-600 bg-slate-800 text-sm font-bold text-white hover:border-amber-500 transition-colors flex items-center justify-center ring-2 ring-transparent hover:ring-amber-500/20"
                >
                  {profile?.avatar_url ? (
                    <Image src={profile.avatar_url} alt="User avatar" width={36} height={36} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </button>
                {userMenuOpen && userMenu}
              </div>

              {/* Mobile Navigation Toggle Button */}
              <button
                className="text-slate-400 hover:text-white md:hidden p-1.5"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle mobile menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-700 py-4 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {primaryNavLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                    isActive(link.href)
                      ? 'bg-amber-500/20 text-amber-500'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
            <div className="border-t border-slate-700/80 pt-2 mt-2">
              {bottomNavLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                      isActive(link.href)
                        ? 'bg-amber-500/20 text-amber-500'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-slate-700 pt-3 mt-3">
              <div className="px-4 py-2"><ThemeToggle /></div>
            </div>
          </div>
        )}
      </nav>

      {/* Command Palette Modal (Ctrl+K / Cmd+K) */}
      {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
              {/* Search Bar Input */}
              <div className="flex items-center px-4 border-b border-slate-700/80 bg-slate-800/40">
                <Search className="h-5 w-5 text-slate-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pro players, pages, rules... (Esc to close)"
                  className="w-full bg-transparent px-3 py-3.5 text-sm text-white placeholder-slate-400 focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 rounded text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <kbd className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                    ESC
                  </kbd>
                )}
              </div>

              {/* Results List */}
              <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                {isSearchingPlayers && (
                  <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                    Searching players...
                  </div>
                )}

                {filteredSearchResults.length === 0 && !isSearchingPlayers && (
                  <div className="p-8 text-center text-sm text-slate-400">
                    No results found for &ldquo;<span className="text-white">{searchQuery}</span>&rdquo;
                  </div>
                )}

                {filteredSearchResults.map((item) => (
                  <button
                    key={`${item.category}-${item.id}`}
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      router.push(item.href);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-800 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-md ${item.category === 'Players' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                        {item.category === 'Players' ? <Sparkles className="h-4 w-4" /> : <Compass className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-400">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    {item.badge && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Footer Helper */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 bg-slate-900/60 text-[11px] text-slate-500">
                <span>Select a result to navigate</span>
                <span>ESC to close</span>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
