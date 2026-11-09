'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { canOptimizeImage } from '@/lib/optimized-image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  BarChart3,
  Bug,
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
import { BrandLogo } from './BrandLogo';
import { useHeaderData } from '@/context/HeaderDataContext';

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
      { href: '/friends', label: 'Friends', description: 'Follow managers and view their progress', icon: Users },
      { href: '/gameweeks', label: 'Gameweeks', description: 'View schedules and deadlines', icon: Calendar },
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
  { href: '/season-recap', label: 'Season Recap', description: 'Review a finished season', icon: Trophy },
  { href: '/learn', label: 'Learn', description: 'Rules, guides, and fantasy basics', icon: BookOpen },
  { href: '/report-issue', label: 'Report Issue', description: 'Report bugs, errors, or UI problems', icon: Bug },
];

const sectionHeaderColour: Record<string, string> = {
  'My Fantasy Team': 'text-teal-600 dark:text-teal-500',
  'Competitions':    'text-amber-600 dark:text-amber-500',
  'Dota Esports':   'text-purple-600 dark:text-purple-400',
  'Insights':        'text-cyan-600 dark:text-cyan-500',
};

function isActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

// ── NavBadge ──────────────────────────────────────────────────────────────────
function NavBadge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'warning' | 'info' }) {
  const colours = {
    default: 'bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    warning: 'bg-amber-500/20 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    info:    'bg-teal-500/20 text-teal-700 dark:bg-teal-500/20 dark:text-teal-400',
  };
  return (
    <span className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${colours[variant]}`}>
      {children}
    </span>
  );
}

// ── NavLink ───────────────────────────────────────────────────────────────────
function NavLink({
  link,
  collapsed,
  onClick,
  mobileStyle = false,
  badge,
}: {
  link: NavigationLink;
  collapsed: boolean;
  onClick?: () => void;
  mobileStyle?: boolean;
  badge?: React.ReactNode;
}) {
  const pathname = usePathname();
  const Icon = link.icon;
  const active = isActive(pathname, link.href);

  const layoutClasses = collapsed
    ? 'relative justify-center p-2.5'
    : mobileStyle
      ? 'gap-3 px-3 py-2.5'
      : 'items-start gap-3 px-3 py-2';

  const colourClasses = active
    ? 'border-l-[3px] border-teal-500 bg-teal-500/10 text-teal-600 dark:border-teal-400 dark:bg-teal-400/10 dark:text-teal-300'
    : 'border-l-[3px] border-transparent text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

  // Compensate padding so text doesn't shift when border appears
  const paddingFix = active && !collapsed ? 'pl-[calc(0.75rem_-_3px)]' : '';

  return (
    <div className="group relative">
      <Link
        href={link.href}
        title={collapsed ? `${link.label}: ${link.description}` : undefined}
        aria-label={collapsed ? `${link.label}: ${link.description}` : undefined}
        aria-current={active ? 'page' : undefined}
        onClick={onClick}
        className={`nav-active-indicator flex items-center rounded-lg text-sm transition-all duration-150 ${layoutClasses} ${colourClasses} ${paddingFix}`}
      >
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 transition-colors duration-150 ${active ? 'text-teal-500 dark:text-teal-400' : 'text-slate-400'}`} />

        {/* Animated label — fades/slides when collapsing */}
        <span
          className={`min-w-0 transition-all duration-150 ${collapsed ? 'w-0 overflow-hidden opacity-0 -translate-x-1 pointer-events-none' : 'opacity-100 translate-x-0 flex-1'}`}
        >
          <span className="flex items-center gap-1">
            <span className="block truncate font-medium">{link.label}</span>
            {badge}
          </span>
          <span className={`mt-0.5 block text-[10px] leading-tight ${active ? 'text-teal-600 dark:text-teal-300' : 'text-slate-400 dark:text-slate-500'}`}>
            {link.description}
          </span>
        </span>
      </Link>

      {/* Collapsed flyout tooltip */}
      {collapsed && (
        <div
          role="tooltip"
          className="pointer-events-none fixed left-20 ml-2 z-70 hidden max-w-xs -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-2xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 group-hover:pointer-events-auto group-hover:flex group-focus-within:pointer-events-auto group-focus-within:flex"
          style={{ top: 'auto' }}
        >
          <div className="flex items-center gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">{link.label}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{link.description}</p>
            </div>
            {badge && <div className="ml-1">{badge}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AdminLink ─────────────────────────────────────────────────────────────────
function AdminLink({ collapsed, onClick }: { collapsed: boolean; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname.startsWith('/admin');

  const layoutClasses = collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5';
  const colourClasses = active
    ? 'border-l-[3px] border-amber-500 bg-amber-500/15 text-amber-600 dark:border-amber-400 dark:bg-amber-400/10 dark:text-amber-400'
    : 'border-l-[3px] border-transparent text-amber-600/80 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400/80 dark:hover:bg-amber-500/10 dark:hover:text-amber-300';
  const paddingFix = active && !collapsed ? 'pl-[calc(0.75rem_-_3px)]' : '';

  return (
    <div className="group relative">
      <Link
        href="/admin/dashboard"
        title={collapsed ? 'Admin Console: Manage app operations' : undefined}
        aria-label={collapsed ? 'Admin Console: Manage app operations' : undefined}
        aria-current={active ? 'page' : undefined}
        onClick={onClick}
        className={`nav-active-indicator flex items-center rounded-lg text-sm font-medium transition-all duration-150 ${layoutClasses} ${colourClasses} ${paddingFix}`}
      >
        <Shield className="h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" />
        <span
          className={`min-w-0 transition-all duration-150 ${collapsed ? 'w-0 overflow-hidden opacity-0 -translate-x-1 pointer-events-none' : 'opacity-100 translate-x-0'}`}
        >
          <span className="block truncate">Admin Console</span>
          <span className={`mt-0.5 block truncate text-[10px] leading-tight ${active ? 'text-amber-600 dark:text-amber-300' : 'text-slate-400 dark:text-slate-500'}`}>
            Manage app operations
          </span>
        </span>
      </Link>

      {collapsed && (
        <div
          role="tooltip"
          className="pointer-events-none fixed left-20 ml-2 z-70 hidden max-w-xs -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-2xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 group-hover:pointer-events-auto group-hover:flex group-focus-within:pointer-events-auto group-focus-within:flex"
        >
          <div>
            <p className="text-xs font-semibold text-amber-500 dark:text-amber-400">Admin Console</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Manage app operations</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function DashboardNavigation({
  isAdmin,
  mobileMenuOpen,
  onMobileMenuClose,
}: {
  isAdmin: boolean;
  mobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
  quickStats?: unknown;
}) {
  const { profile, quickStats } = useHeaderData();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [now, setNow] = useState(0);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setNow(Date.now()); }, []);

  useEffect(() => {
    document.documentElement.dataset.sidebarCollapsed = String(sidebarCollapsed);
    try {
      window.localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
    } catch {
      // Ignore storage access errors
    }
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

  // ── Badge resolver ────────────────────────────────────────────────────────
  const freeTransfers = quickStats?.freeTransfers ?? 0;
  const isDeadlineSoon =
    now > 0 &&
    !!quickStats?.gameweek?.deadline &&
    (() => {
      const diff = new Date(quickStats!.gameweek!.deadline).getTime() - now;
      return diff > 0 && diff < 1000 * 60 * 60 * 6;
    })();

  function getBadge(href: string): React.ReactNode | undefined {
    if (href === '/transfers' && freeTransfers > 0) {
      return <NavBadge variant="info">{freeTransfers} FT</NavBadge>;
    }
    if ((href === '/lineups' || href === '/gameweeks/planner') && isDeadlineSoon) {
      return <NavBadge variant="warning">Soon</NavBadge>;
    }
    return undefined;
  }

  const initials = (profile?.display_name || profile?.username || 'U').slice(0, 1).toUpperCase();

  return (
    <>
      {/* ── Desktop Sidebar ───────────────────────────────────────────────── */}
      <aside className={`dashboard-sidebar fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-slate-300 bg-slate-100 px-4 py-6 transition-[width] duration-200 dark:border-slate-700 dark:bg-slate-900 md:flex ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>

        {/* Brand + Collapse Toggle */}
        <div className={`mb-6 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/dashboard" className="brand-logo-link flex items-center gap-2 px-2 font-bold text-xl">
            <BrandLogo className="brand-logo-hover h-8 w-8" />
            <span
              className={`bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent transition-all duration-150 ${sidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : 'opacity-100'}`}
            >
              Fantasy
            </span>
          </Link>
          {!sidebarCollapsed && (
            <button
              type="button"
              aria-label="Collapse sidebar"
              onClick={() => setSidebarCollapsed(true)}
              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <button
            type="button"
            aria-label="Expand sidebar"
            onClick={() => setSidebarCollapsed(false)}
            className="mb-4 self-center rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <nav className="no-scrollbar flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <div className="space-y-1">
            {navSections.map((section, idx) => (
              <section
                key={section.label}
                aria-label={section.label}
                className={idx > 0 ? 'border-t border-slate-200 dark:border-slate-800 pt-3 mt-1' : ''}
              >
                {/* Section header — fades when collapsed */}
                <h2
                  className={`mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all duration-150 ${sidebarCollapsed ? 'h-0 overflow-hidden opacity-0 mb-0' : 'opacity-100'}`}
                >
                  <span className={sectionHeaderColour[section.label] ?? 'text-slate-500 dark:text-slate-500'}>
                    {section.label}
                  </span>
                </h2>

                {/* "My Fantasy Team" gets a subtle card treatment */}
                <div className={`space-y-0.5 ${section.label === 'My Fantasy Team' ? 'rounded-xl bg-slate-200/60 dark:bg-slate-800/40 p-1' : ''}`}>
                  {section.links.map((link) => (
                    <NavLink
                      key={link.href}
                      link={link}
                      collapsed={sidebarCollapsed}
                      badge={getBadge(link.href)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* ── Bottom area: Resources + Admin ───────────────────────────── */}
          <div className="mt-auto border-t border-slate-200 dark:border-slate-800/80 pt-3">
            <h2
              className={`mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-all duration-150 ${sidebarCollapsed ? 'h-0 overflow-hidden opacity-0 mb-0' : 'opacity-100'}`}
            >
              Resources
            </h2>
            <div className="space-y-0.5">
              {bottomNavLinks.map((link) => (
                <NavLink key={link.href} link={link} collapsed={sidebarCollapsed} />
              ))}
            </div>

            {/* Admin Console — separated with its own divider */}
            {isAdmin && (
              <div className="mt-2 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                <AdminLink collapsed={sidebarCollapsed} />
              </div>
            )}
          </div>
        </nav>
      </aside>

      {/* ── Mobile Backdrop ───────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-55 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onMobileMenuClose}
        aria-hidden="true"
      />

      {/* ── Mobile Drawer ─────────────────────────────────────────────────── */}
      <div
        ref={mobileDrawerRef}
        className={`fixed inset-y-0 left-0 z-60 flex w-72 flex-col bg-slate-100 border-r border-slate-300 shadow-2xl transition-transform duration-300 ease-in-out dark:bg-slate-900 dark:border-slate-700/80 md:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Mobile navigation drawer"
        aria-hidden={!mobileMenuOpen}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-700/80 shrink-0">
          <Link href="/dashboard" onClick={onMobileMenuClose} className="brand-logo-link flex items-center gap-2 font-bold text-xl">
            <BrandLogo className="brand-logo-hover h-8 w-8" />
            <span className="bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">Fantasy</span>
          </Link>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={onMobileMenuClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile user identity strip */}
        {profile && (
          <div className="px-4 pt-3 pb-2 border-b border-slate-200 dark:border-slate-700/60 shrink-0">
            <Link
              href="/profile"
              onClick={onMobileMenuClose}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-200/70 dark:hover:bg-slate-800/70 transition-colors"
            >
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-300 bg-slate-200 dark:border-slate-600 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-white">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={`${profile.display_name || profile.username} avatar`}
                    width={36}
                    height={36}
                    unoptimized={!canOptimizeImage(profile.avatar_url)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                  {profile.display_name || profile.username}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {quickStats?.globalRank != null && (
                    <span className="text-[10px] font-medium text-teal-600 dark:text-teal-400">
                      #{quickStats.globalRank.toLocaleString()}
                    </span>
                  )}
                  {quickStats?.totalPoints !== undefined && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {quickStats.totalPoints} pts
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Mobile Swipe Left Pill Badge */}
        <div className="px-4 pt-2 pb-1 flex items-center justify-center shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300/70 bg-slate-200/80 px-2.5 py-0.5 text-[10px] font-medium text-slate-500 shadow-xs dark:border-slate-700/70 dark:bg-slate-800/80 dark:text-slate-400">
            <span aria-hidden="true" className="text-teal-500 dark:text-amber-400">←</span>
            <span>Swipe left to close</span>
          </span>
        </div>

        <nav className="no-scrollbar flex-1 overflow-y-auto px-3 py-2">
          <div className="space-y-1">
            {navSections.map((section, idx) => (
              <section
                key={section.label}
                aria-label={section.label}
                className={idx > 0 ? 'border-t border-slate-200 dark:border-slate-800 pt-3 mt-1' : ''}
              >
                <h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em]">
                  <span className={sectionHeaderColour[section.label] ?? 'text-slate-500 dark:text-slate-500'}>
                    {section.label}
                  </span>
                </h2>
                <div className={`space-y-0.5 ${section.label === 'My Fantasy Team' ? 'rounded-xl bg-slate-200/60 dark:bg-slate-800/40 p-1' : ''}`}>
                  {section.links.map((link) => (
                    <NavLink
                      key={link.href}
                      link={link}
                      collapsed={false}
                      onClick={onMobileMenuClose}
                      mobileStyle
                      badge={getBadge(link.href)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-3 border-t border-slate-200 dark:border-slate-700/80 pt-2">
            <h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-500">
              Resources
            </h2>
            <div className="space-y-0.5">
              {bottomNavLinks.map((link) => (
                <NavLink
                  key={link.href}
                  link={link}
                  collapsed={false}
                  onClick={onMobileMenuClose}
                  mobileStyle
                />
              ))}
            </div>

            {isAdmin && (
              <div className="mt-2 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                <AdminLink collapsed={false} onClick={onMobileMenuClose} />
              </div>
            )}
          </div>
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
