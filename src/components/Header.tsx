'use client';

import Image from 'next/image';
import { canOptimizeImage } from '@/lib/optimized-image';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { BrandLogo } from './BrandLogo';
import {
  Search,
  Command,
  Shield,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ThemeToggle } from './theme/ThemeToggle';
import { NotificationDropdown } from './NotificationDropdown';
import { QuickStatsBar } from './QuickStatsBar';
import { DashboardNavigation } from './DashboardNavigation';
import { useHeaderData } from '@/context/HeaderDataContext';

const LazyCommandPalette = dynamic(
  () => import('./CommandPalette').then((module) => module.CommandPalette),
  { ssr: false },
);

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/squads': 'Squad Management',
  '/lineups': 'Active Lineup',
  '/transfers': 'Transfers & Market',
  '/players': 'Players Directory',
  '/leagues': 'Leagues & Cups',
  '/leaderboard': 'Global Leaderboard',
  '/gameweeks': 'Gameweek Schedule',
  '/gameweeks/planner': 'My Gameweek Planner',
  '/season-recap': 'Season Recap',
  '/tournaments': 'Tournaments',
  '/matches': 'Matches & Results',
  '/analytics': 'Performance Analytics',
  '/learn': 'Learn Hub',
  '/guide': 'Manager Guide',
  '/rules': 'League Rules',
  '/profile': 'Manager Profile',
  '/account': 'Account Settings',
  '/notifications': 'Notification Center',
};

function CurrentPageTitle() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || (pathname.startsWith('/players/') ? 'Player Inspection' : 'Dota 2 Fantasy');

  return <h1 className="text-sm font-bold tracking-wide text-white">{title}</h1>;
}

export const Header = memo(function Header() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  // All persistent data comes from context – never re-fetched on navigation
  const { profile, quickStats } = useHeaderData();

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
  const userMenu = (
    <div className="absolute right-0 top-12 z-50 w-48 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-xl">
      <div className="border-b border-slate-700 px-3 py-2">
        <p className="truncate text-sm font-medium text-white">{profile?.display_name || profile?.username || 'Account'}</p>
        {profile?.username && <p className="truncate text-xs text-slate-400">@{profile.username}</p>}
      </div>
      <Link href="/profile" onClick={() => setUserMenuOpen(false)} className="mt-1 block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
        Profile
      </Link>
      <Link href="/settings" onClick={() => setUserMenuOpen(false)} className="block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
        Settings
      </Link>
      {profile?.role === 'admin' && (
        <Link
          href="/admin/dashboard"
          onClick={() => setUserMenuOpen(false)}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 border-t border-slate-700/60 mt-1 pt-2"
        >
          <Shield className="h-4 w-4 text-amber-400" />
          <span>Admin Console</span>
        </Link>
      )}
      <button onClick={handleSignOut} disabled={signingOut} className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-60">
        {signingOut ? 'Signing Out...' : 'Sign Out'}
      </button>
    </div>
  );
  return (
    <>
      <DashboardNavigation
        isAdmin={profile?.role === 'admin'}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuClose={closeMobileMenu}
        quickStats={quickStats}
      />

      <header className="dashboard-header sticky top-0 z-40 border-b border-slate-700/80 bg-slate-900/95 backdrop-blur-md">
        <nav ref={userMenuRef} className="mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-16 gap-4">
            
            {/* Mobile Brand */}
            <Link href="/" className="flex items-center gap-2 font-bold text-xl md:hidden shrink-0">
              <BrandLogo className="h-8 w-8" />
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
              <CurrentPageTitle />
            </div>

            {/* Center: Command Palette / Quick Search Trigger */}
            <div className="hidden lg:flex flex-1 max-w-xs xl:max-w-md mx-2">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={searchOpen}
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
                aria-haspopup="dialog"
                aria-expanded={searchOpen}
                onClick={() => setSearchOpen(true)}
                className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>

              {/* Fantasy HUD Pills (Desktop) */}
              <QuickStatsBar quickStats={quickStats} />

              {/* Vertical Divider */}
              <div className="hidden sm:block h-5 w-px bg-slate-700/80 mx-1" />

              {/* Theme Toggle */}
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
                  className="h-9 w-9 overflow-hidden rounded-full border border-slate-600 bg-slate-800 text-sm font-bold text-white hover:border-amber-500 transition-colors flex items-center justify-center ring-2 ring-transparent hover:ring-amber-500/20"
                >
                  {profile?.avatar_url ? (
                    <Image src={profile.avatar_url} alt={`${profile.display_name || profile.username} avatar`} width={36} height={36} unoptimized={!canOptimizeImage(profile.avatar_url)} className="h-full w-full object-cover" />
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

      </nav>

      {searchOpen && <LazyCommandPalette onClose={() => setSearchOpen(false)} />}
      </header>

    </>
  );
});
