'use client';

import Image from 'next/image';
import { canOptimizeImage } from '@/lib/optimized-image';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { BrandLogo } from './BrandLogo';
import {
  Search,
  Command,
  Medal,
  Star,
  Settings,
  LogOut,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ThemeToggle } from './theme/ThemeToggle';
import { NotificationDropdown } from './NotificationDropdown';
import { QuickStatsBar } from './QuickStatsBar';
import { DashboardNavigation } from './DashboardNavigation';
import { useHeaderData } from '@/context/HeaderDataContext';
import { isPremiumUser } from '@/lib/premium';

const LazyCommandPalette = dynamic(
  () => import('./CommandPalette').then((module) => module.CommandPalette),
  { ssr: false },
);

// ── Page title map + section colour ──────────────────────────────────────────
const pageMeta: Record<string, { title: string; colour?: string }> = {
  '/dashboard':          { title: 'Dashboard' },
  '/squads':             { title: 'Squad Management',      colour: 'text-teal-500 dark:text-teal-400' },
  '/lineups':            { title: 'Active Lineup',         colour: 'text-teal-500 dark:text-teal-400' },
  '/transfers':          { title: 'Transfers & Market',    colour: 'text-teal-500 dark:text-teal-400' },
  '/gameweeks/planner':  { title: 'Squad Planner',         colour: 'text-teal-500 dark:text-teal-400' },
  '/players':            { title: 'Players Directory',     colour: 'text-purple-500 dark:text-purple-400' },
  '/tournaments':        { title: 'Tournaments',           colour: 'text-purple-500 dark:text-purple-400' },
  '/matches':            { title: 'Matches & Results',     colour: 'text-purple-500 dark:text-purple-400' },
  '/leagues':            { title: 'Leagues & Cups',        colour: 'text-amber-500 dark:text-amber-400' },
  '/leaderboard':        { title: 'Global Leaderboard',    colour: 'text-amber-500 dark:text-amber-400' },
  '/friends':            { title: 'Friends',               colour: 'text-amber-500 dark:text-amber-400' },
  '/gameweeks':          { title: 'Gameweek Schedule',     colour: 'text-amber-500 dark:text-amber-400' },
  '/analytics':          { title: 'Performance Analytics', colour: 'text-cyan-500 dark:text-cyan-400' },
  '/season-recap':       { title: 'Season Recap' },
  '/learn':              { title: 'Learn Hub' },
  '/guide':              { title: 'Manager Guide' },
  '/rules':              { title: 'League Rules' },
  '/profile':            { title: 'Manager Profile' },
  '/notifications':      { title: 'Notification Center' },
};

function getPageMeta(pathname: string): { title: string; colour?: string } {
  if (pageMeta[pathname]) return pageMeta[pathname];
  if (pathname.startsWith('/players/')) return { title: 'Player Profile', colour: 'text-purple-500 dark:text-purple-400' };
  if (pathname.startsWith('/matches/')) return { title: 'Match Details', colour: 'text-purple-500 dark:text-purple-400' };
  if (pathname.startsWith('/tournaments/')) return { title: 'Tournament', colour: 'text-purple-500 dark:text-purple-400' };
  if (pathname.startsWith('/leagues/')) return { title: 'League', colour: 'text-amber-500 dark:text-amber-400' };
  if (pathname.startsWith('/gameweeks/')) return { title: 'Gameweek', colour: 'text-amber-500 dark:text-amber-400' };
  return { title: 'Dota 2 Fantasy' };
}

// ── Breadcrumb / page title ───────────────────────────────────────────────────
function CurrentPageTitle() {
  const pathname = usePathname();
  const { title, colour } = getPageMeta(pathname);
  return (
    <h1 className={`text-sm font-bold tracking-wide ${colour ?? 'text-slate-800 dark:text-white'}`}>
      {title}
    </h1>
  );
}

// ── Deadline urgency banner ───────────────────────────────────────────────────
function DeadlineBanner({ deadline, gameweekNumber }: { deadline: string; gameweekNumber: number }) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => { window.clearTimeout(t); window.clearInterval(interval); };
  }, []);

  if (!now) return null;

  const diff = new Date(deadline).getTime() - now;
  if (diff <= 0 || diff > 24 * 60 * 60 * 1000) return null; // only show within 24h

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const isUrgent = diff < 6 * 60 * 60 * 1000; // under 6h = urgent

  return (
    <div className={`flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium ${isUrgent ? 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-slate-200/60 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400'} border-b ${isUrgent ? 'border-amber-500/20 dark:border-amber-500/20' : 'border-slate-300/60 dark:border-slate-700/60'}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${isUrgent ? 'bg-amber-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-500'}`} />
      <span>
        GW{gameweekNumber} deadline in{' '}
        <span className={`font-semibold ${isUrgent ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
          {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
        </span>
        {' '}— Finalize your lineup before it locks.
      </span>
      <Link href="/lineups" className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${isUrgent ? 'bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 dark:text-amber-400' : 'bg-slate-300/60 text-slate-600 hover:bg-slate-300 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
        Set Lineup →
      </Link>
    </div>
  );
}

// ── Main Header ───────────────────────────────────────────────────────────────
export const Header = memo(function Header() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchPlaceholderIdx, setSearchPlaceholderIdx] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  const { profile, quickStats } = useHeaderData();

  // Cycling search placeholder hints
  const searchPlaceholders = [
    'Search players, teams, leagues...',
    'Find a player by name...',
    'Look up a league...',
    'Search matches & tournaments...',
  ];
  useEffect(() => {
    const interval = window.setInterval(() => {
      setSearchPlaceholderIdx((i) => (i + 1) % searchPlaceholders.length);
    }, 3500);
    return () => window.clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setMobileMenuOpen(false);
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

  // ── Richer user menu ──────────────────────────────────────────────────────
  const userMenu = (
    <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
      {/* Profile header */}
      <Link
        href="/profile"
        aria-label="View your profile"
        onClick={() => setUserMenuOpen(false)}
        className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-white">
          {profile?.avatar_url ? (
            <Image src={profile.avatar_url} alt="" width={40} height={40} unoptimized={!canOptimizeImage(profile.avatar_url)} className="h-full w-full object-cover" />
          ) : initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
            {profile?.display_name || profile?.username || 'Account'}
          </span>
          {profile?.username && (
            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">@{profile.username}</span>
          )}
          <span className="mt-1 block text-xs font-semibold text-teal-700 dark:text-teal-300">
            View profile
          </span>
          {quickStats && (
            <span className="mt-2 flex items-center gap-3 text-[11px]">
              {quickStats.globalRank != null && (
                <span className="flex items-center gap-1 font-medium text-teal-600 dark:text-teal-400">
                  <Medal className="h-3 w-3" />
                  #{quickStats.globalRank.toLocaleString()}
                </span>
              )}
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <Star className="h-3 w-3 text-amber-400" />
                {quickStats.totalPoints} pts
              </span>
            </span>
          )}
        </span>
      </Link>
      {/* Menu links */}
      <div className="p-1.5">
        <Link
          href="/settings"
          onClick={() => setUserMenuOpen(false)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
        >
          <Settings className="h-4 w-4 text-slate-400" />
          Settings
        </Link>
        <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </div>
  );

  const gw = quickStats?.gameweek;

  return (
    <>
      <DashboardNavigation
        isAdmin={profile?.role === 'admin'}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuClose={closeMobileMenu}
        quickStats={quickStats}
      />

      <header className="dashboard-header sticky top-0 z-40 border-b border-slate-300/80 bg-white/95 backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/95">

        {/* Deadline urgency banner — DeadlineBanner handles its own time/visibility */}
        {gw?.deadline && (
          <DeadlineBanner deadline={gw.deadline} gameweekNumber={gw.gameweek_number} />
        )}

        <nav ref={userMenuRef} className="mx-auto px-3 sm:px-6">
          <div className="flex justify-between items-center h-16 gap-2 sm:gap-4">

            {/* Mobile Brand */}
            <Link href="/" className="flex items-center gap-2 font-bold text-xl md:hidden shrink-0">
              <BrandLogo className="h-8 w-8" />
              <span className="bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                Fantasy
              </span>
            </Link>

            {/* Left: Colour-coded Breadcrumb (Desktop) */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                Fantasy
              </span>
              <span className="text-slate-300 font-medium dark:text-slate-600">/</span>
              <CurrentPageTitle />
            </div>

            {/* Center: Command Palette Search (md+ — wider than before) */}
            <div className="hidden md:flex flex-1 max-w-xs lg:max-w-md xl:max-w-lg mx-2 lg:mx-4">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={searchOpen}
                onClick={() => setSearchOpen(true)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100/80 hover:bg-slate-200/80 hover:border-slate-300 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all text-xs group shadow-inner"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors shrink-0" />
                  <span className="truncate transition-opacity duration-500">
                    {searchPlaceholders[searchPlaceholderIdx]}
                  </span>
                </div>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded dark:bg-slate-900/80 dark:border-slate-700 shrink-0">
                  <Command className="h-2.5 w-2.5" /> K
                </kbd>
              </button>
            </div>

            {/* Right: HUD Pills & Actions */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto">

              {/* Quick Search Icon for Mobile only */}
              <button
                type="button"
                aria-label="Open search"
                aria-haspopup="dialog"
                aria-expanded={searchOpen}
                onClick={() => setSearchOpen(true)}
                className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>

              {/* Fantasy HUD Pills — now visible from xl instead of 2xl */}
              <QuickStatsBar quickStats={quickStats} isPremium={isPremiumUser(profile)} />

              {/* Vertical Divider */}
              <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-700/80 mx-1" />

              {/* Theme Toggle — always visible on sm+ */}
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>

              {/* Notifications */}
              <NotificationDropdown
                isOpen={notificationMenuOpen}
                onToggle={() => {
                  setNotificationMenuOpen(!notificationMenuOpen);
                  setUserMenuOpen(false);
                }}
                onClose={() => setNotificationMenuOpen(false)}
              />

              {/* User Avatar Menu */}
              <div className="relative">
                <button
                  type="button"
                  aria-label="Open user menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="h-9 w-9 overflow-hidden rounded-full border border-slate-300 bg-slate-100 text-sm font-bold text-slate-700 hover:border-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:border-teal-400 transition-colors flex items-center justify-center ring-2 ring-transparent hover:ring-teal-500/20 dark:hover:ring-teal-400/20"
                >
                  {profile?.avatar_url ? (
                    <Image src={profile.avatar_url} alt={`${profile.display_name || profile.username} avatar`} width={36} height={36} unoptimized={!canOptimizeImage(profile.avatar_url)} className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </button>
                {userMenuOpen && userMenu}
              </div>

              {/* Mobile Navigation Toggle */}
              <button
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white md:hidden p-1.5 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle mobile menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </nav>

        {searchOpen && <LazyCommandPalette onClose={() => setSearchOpen(false)} />}
      </header>
    </>
  );
});
