'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  LayoutDashboard,
  Medal,
  Shield,
  Swords,
  Trophy,
  UserCheck,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { ThemeToggle } from './theme/ThemeToggle';

type NavigationLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type NavigationSection = {
  label: string;
  links: NavigationLink[];
};

const navSections: NavigationSection[] = [
  {
    label: 'Overview',
    links: [
      { href: '/dashboard', label: 'Dashboard', description: 'Your points, rank, and updates', icon: LayoutDashboard },
    ],
  },
  {
    label: 'My Fantasy Team',
    links: [
      { href: '/squads', label: 'Squad', description: 'Manage your players and budget', icon: Users },
      { href: '/lineups', label: 'Lineups', description: 'Set starters and captain picks', icon: UserCheck },
      { href: '/transfers', label: 'Transfers', description: 'Browse players and make transfers', icon: ArrowLeftRight },
      { href: '/gameweeks/planner', label: 'Squad Planner', description: 'Check availability and fixtures', icon: Calendar },
    ],
  },
  {
    label: 'Competitions',
    links: [
      { href: '/leagues', label: 'Leagues', description: 'Create or follow league standings', icon: Trophy },
      { href: '/leaderboard', label: 'Leaderboard', description: 'Compare global manager ranks', icon: Medal },
      { href: '/gameweeks', label: 'Gameweeks', description: 'View schedules and deadlines', icon: Calendar },
      { href: '/season-recap', label: 'Season Recap', description: 'Review a finished season', icon: Trophy },
    ],
  },
  {
    label: 'Dota Esports',
    links: [
      { href: '/players', label: 'Players', description: 'Explore pro player stats', icon: UserRound },
      { href: '/tournaments', label: 'Tournaments', description: 'Follow tournament results', icon: Swords },
      { href: '/matches', label: 'Matches', description: 'Browse match schedules and results', icon: Gamepad2 },
    ],
  },
  {
    label: 'Insights',
    links: [
      { href: '/analytics', label: 'Analytics', description: 'Explore fantasy performance data', icon: BarChart3 },
    ],
  },
];

const bottomNavLinks: NavigationLink[] = [
  { href: '/learn', label: 'Learn', description: 'Rules, guides, and fantasy basics', icon: BookOpen },
];

function isActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function DashboardNavigation({
  pathname,
  isAdmin,
  mobileMenuOpen,
  onMobileMenuClose,
}: {
  pathname: string;
  isAdmin: boolean;
  mobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.sidebarCollapsed = String(sidebarCollapsed);
    window.localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const drawer = mobileDrawerRef.current;
    if (!drawer) return;

    function handleTouchStart(event: TouchEvent) {
      touchStartXRef.current = event.touches[0].clientX;
      touchStartYRef.current = event.touches[0].clientY;
    }

    function handleTouchEnd(event: TouchEvent) {
      const deltaX = event.changedTouches[0].clientX - touchStartXRef.current;
      const deltaY = event.changedTouches[0].clientY - touchStartYRef.current;
      if (deltaX < -50 && Math.abs(deltaX) > Math.abs(deltaY)) onMobileMenuClose();
    }

    drawer.addEventListener('touchstart', handleTouchStart, { passive: true });
    drawer.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      drawer.removeEventListener('touchstart', handleTouchStart);
      drawer.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onMobileMenuClose]);

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
        <nav className="no-scrollbar flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <div className="space-y-4">
            {navSections.map((section) => (
              <section key={section.label} aria-label={section.label}>
                {!sidebarCollapsed && (
                  <h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {section.label}
                  </h2>
                )}
                <div className="space-y-1">
                  {section.links.map((link) => {
                    const Icon = link.icon;
                    const active = isActive(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        title={sidebarCollapsed ? `${link.label}: ${link.description}` : undefined}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-center rounded-lg text-sm transition-colors ${sidebarCollapsed ? 'justify-center p-2.5' : 'items-start gap-3 px-3 py-2'} ${active ? 'bg-amber-500/20 text-amber-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                      >
                        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${active ? 'text-amber-500' : 'text-slate-400'}`} />
                        {!sidebarCollapsed && (
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{link.label}</span>
                            <span className={`mt-0.5 block text-[10px] leading-tight ${active ? 'text-amber-200/70' : 'text-slate-500'}`}>
                              {link.description}
                            </span>
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-auto border-t border-slate-800/80 pt-3">
            {!sidebarCollapsed && (
              <h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Resources
              </h2>
            )}
            <div className="space-y-1">
              {bottomNavLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={sidebarCollapsed ? `${link.label}: ${link.description}` : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center rounded-lg text-sm transition-colors ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'} ${active ? 'bg-amber-500/20 text-amber-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-amber-500' : 'text-slate-400'}`} />
                    {!sidebarCollapsed && (
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{link.label}</span>
                        <span className="mt-0.5 block truncate text-[10px] leading-tight text-slate-500">{link.description}</span>
                      </span>
                    )}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  title={sidebarCollapsed ? 'Admin Console: Manage app operations' : undefined}
                  aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
                  className={`flex items-center rounded-lg text-sm font-medium transition-colors ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'} ${pathname.startsWith('/admin') ? 'bg-amber-500/20 text-amber-400 font-semibold' : 'text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300'}`}
                >
                  <Shield className="h-5 w-5 shrink-0 text-amber-400" />
                  {!sidebarCollapsed && (
                    <span className="min-w-0">
                      <span className="block truncate">Admin Console</span>
                      <span className="mt-0.5 block truncate text-[10px] leading-tight text-amber-400/60">Manage app operations</span>
                    </span>
                  )}
                </Link>
              )}
            </div>
          </div>
        </nav>
      </aside>

      <div
        className={`fixed inset-0 z-55 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onMobileMenuClose}
        aria-hidden="true"
      />
      <div
        ref={mobileDrawerRef}
        className={`fixed inset-y-0 left-0 z-60 flex w-72 flex-col bg-slate-900 border-r border-slate-700/80 shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Mobile navigation drawer"
        aria-hidden={!mobileMenuOpen}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700/80 shrink-0">
          <Link href="/dashboard" onClick={onMobileMenuClose} className="flex items-center gap-2 font-bold text-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-amber-500 to-orange-600">
              <span className="font-bold text-white">D2</span>
            </div>
            <span className="bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">Fantasy</span>
          </Link>
          <button type="button" aria-label="Close navigation menu" onClick={onMobileMenuClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="px-4 pt-1.5 pb-0.5 text-[10px] text-slate-600 flex items-center gap-1 shrink-0">
          <span aria-hidden="true">←</span> Swipe left to close
        </p>
        <nav className="no-scrollbar flex-1 overflow-y-auto px-3 py-2">
          <div className="space-y-4">
            {navSections.map((section) => (
              <section key={section.label} aria-label={section.label}>
                <h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{section.label}</h2>
                <div className="space-y-0.5">
                  {section.links.map((link) => {
                    const Icon = link.icon;
                    const active = isActive(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${active ? 'bg-amber-500/20 text-amber-500' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                        onClick={onMobileMenuClose}
                      >
                        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${active ? 'text-amber-500' : 'text-slate-400'}`} />
                        <span className="min-w-0">
                          <span className="block font-medium">{link.label}</span>
                          <span className={`mt-0.5 block text-xs leading-tight ${active ? 'text-amber-200/70' : 'text-slate-500'}`}>{link.description}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-3 border-t border-slate-700/80 pt-2">
            <h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Resources</h2>
            <div className="space-y-0.5">
              {bottomNavLinks.map((link) => {
                const Icon = link.icon;
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${active ? 'bg-amber-500/20 text-amber-500' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    onClick={onMobileMenuClose}
                  >
                    <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${active ? 'text-amber-500' : 'text-slate-400'}`} />
                    <span className="min-w-0">
                      <span className="block font-medium">{link.label}</span>
                      <span className="mt-0.5 block text-xs leading-tight text-slate-500">{link.description}</span>
                    </span>
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors ${pathname.startsWith('/admin') ? 'bg-amber-500/20 text-amber-400 font-semibold' : 'text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-300'}`}
                  onClick={onMobileMenuClose}
                >
                  <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  <span className="min-w-0">
                    <span className="block">Admin Console</span>
                    <span className="mt-0.5 block text-xs leading-tight text-amber-400/60">Manage app operations</span>
                  </span>
                </Link>
              )}
            </div>
          </div>
        </nav>
        <div className="border-t border-slate-700 px-4 py-3 shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
