'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bug,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  DollarSign,
  Gamepad2,
  LayoutDashboard,
  Menu,
  Settings,
  Shield,
  Swords,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';

const adminMenuSections = [
  {
    label: 'Overview',
    links: [
      { href: '/admin/dashboard', label: 'Dashboard', description: 'Review system and league metrics', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operations',
    links: [
      { href: '/admin/data-jobs', label: 'Data Jobs', description: 'Run and monitor background jobs', icon: Zap },
      { href: '/admin/observability', label: 'Observability', description: 'Inspect job health and failures', icon: Activity },
      { href: '/admin/telemetry', label: 'Telemetry', description: 'Search API and data-access activity', icon: BarChart3 },
      { href: '/admin/data-quality', label: 'Data Quality', description: 'Review provider conflicts and metrics', icon: AlertCircle },
      { href: '/admin/issue-reports', label: 'Issue Reports', description: 'Review user-submitted bugs and status updates', icon: Bug },
      { href: '/admin/audit', label: 'Audit Log', description: 'Review administrative changes', icon: Database },
    ],
  },
  {
    label: 'Competition',
    links: [
      { href: '/admin/fantasy-teams', label: 'Fantasy Teams', description: 'Inspect manager squads and budgets', icon: Swords },
      { href: '/admin/leagues', label: 'Leagues', description: 'Manage fantasy leagues', icon: Shield },
      { href: '/admin/seasons', label: 'Seasons', description: 'Configure competition seasons', icon: Calendar },
      { href: '/admin/gameweeks', label: 'Gameweeks', description: 'Manage gameweek status and dates', icon: Gamepad2 },
      { href: '/admin/scoring', label: 'Scoring Rules', description: 'Configure fantasy scoring', icon: CheckCircle },
      { href: '/admin/pricing', label: 'Pricing', description: 'Review player market prices', icon: DollarSign },
    ],
  },
  {
    label: 'Dota Data',
    links: [
      { href: '/admin/players', label: 'Players', description: 'Manage player records and roles', icon: Users },
      { href: '/admin/teams', label: 'Teams', description: 'Manage professional team records', icon: Trophy },
      { href: '/admin/matches', label: 'Matches', description: 'Review and sync match data', icon: BarChart3 },
    ],
  },
  {
    label: 'Configuration',
    links: [
      { href: '/admin/settings', label: 'Settings', description: 'Manage admin preferences', icon: Settings },
    ],
  },
];

const sectionColours: Record<string, string> = {
  Operations: 'text-cyan-600 dark:text-cyan-400',
  Competition: 'text-amber-600 dark:text-amber-400',
  'Dota Data': 'text-purple-600 dark:text-purple-400',
  Configuration: 'text-slate-500 dark:text-slate-400',
};

function AdminNavigation({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigation" className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
      <div className="space-y-1">
        {adminMenuSections.map((section, index) => (
          <section
            key={section.label}
            aria-label={section.label}
            className={index > 0 ? 'mt-2 border-t border-slate-200 pt-3 dark:border-slate-800' : ''}
          >
            <h2
              className={`mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all duration-150 ${
                collapsed ? 'mb-0 h-0 overflow-hidden opacity-0' : 'opacity-100'
              }`}
            >
              <span className={sectionColours[section.label] ?? 'text-slate-500 dark:text-slate-400'}>
                {section.label}
              </span>
            </h2>
            <div className="space-y-0.5">
              {section.links.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const activeColour = active
                  ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:border-amber-400 dark:bg-amber-400/10 dark:text-amber-300'
                  : 'border-transparent text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

                return (
                  <div key={item.href} className="group relative">
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      aria-label={collapsed ? `${item.label}: ${item.description}` : undefined}
                      title={collapsed ? `${item.label}: ${item.description}` : undefined}
                      onClick={onNavigate}
                      className={`nav-active-indicator flex min-h-10 items-center rounded-lg border-l-[3px] text-sm transition-all duration-150 ${
                        collapsed ? 'justify-center px-2.5 py-2' : 'gap-3 px-3 py-2'
                      } ${activeColour} ${active && !collapsed ? 'pl-[calc(0.75rem_-_3px)]' : ''}`}
                    >
                      <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400'}`} />
                      <span className={`min-w-0 transition-all duration-150 ${
                        collapsed ? 'pointer-events-none w-0 -translate-x-1 overflow-hidden opacity-0' : 'flex-1 translate-x-0 opacity-100'
                      }`}>
                        <span className="block truncate font-medium">{item.label}</span>
                        <span className={`mt-0.5 block text-[10px] leading-tight ${
                          active ? 'text-amber-700/80 dark:text-amber-200/80' : 'text-slate-500 dark:text-slate-500'
                        }`}>
                          {item.description}
                        </span>
                      </span>
                    </Link>
                    {collapsed ? (
                      <div
                        role="tooltip"
                        className="pointer-events-none absolute left-full top-1/2 z-70 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-2xl backdrop-blur-md group-hover:block group-focus-within:block dark:border-slate-700 dark:bg-slate-900/95"
                      >
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.label}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.description}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </nav>
  );
}

export default function AdminSidebar() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('admin-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  function toggleCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem('admin-sidebar-collapsed', String(next));
      } catch {
        // Keep the control functional when storage is unavailable.
      }
      return next;
    });
  }

  return (
    <>
      <aside
        className={`hidden h-full shrink-0 flex-col border-r border-slate-200 bg-slate-100 px-3 py-5 transition-[width] duration-200 dark:border-slate-700 dark:bg-slate-900 md:flex ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className={`mb-5 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/admin/dashboard" aria-label="Admin Console home" className="flex items-center gap-2 overflow-hidden px-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </span>
            <span className={`min-w-0 transition-all duration-150 ${sidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : 'opacity-100'}`}>
              <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">Admin</span>
              <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">Console</span>
            </span>
          </Link>
          {!sidebarCollapsed ? (
            <button
              type="button"
              aria-label="Collapse admin sidebar"
              onClick={toggleCollapsed}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
        </div>
        {sidebarCollapsed ? (
          <button
            type="button"
            aria-label="Expand admin sidebar"
            onClick={toggleCollapsed}
            className="mb-3 self-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : null}

        <AdminNavigation collapsed={sidebarCollapsed} />

        <div className={`mt-2 shrink-0 border-t border-slate-200 pt-3 dark:border-slate-800 ${sidebarCollapsed ? 'px-1' : 'px-2'}`}>
          {sidebarCollapsed ? (
            <Link
              href="/"
              aria-label="Back to App"
              title="Back to App"
              className="flex min-h-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </Link>
          ) : (
            <>
              <p className="text-[10px] text-slate-500 dark:text-slate-500">v0.1.0</p>
              <Link href="/" className="mt-1 inline-block text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Back to App
              </Link>
            </>
          )}
        </div>
      </aside>

      <div
        className={`fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          mobileMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />
      <button
        type="button"
        aria-label="Open admin navigation"
        aria-expanded={mobileMenuOpen}
        onClick={() => setMobileMenuOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-lg border border-slate-200 bg-slate-100 p-2 text-slate-600 shadow-sm transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white md:hidden"
      >
        <LayoutDashboard className="h-5 w-5" />
      </button>
      <aside
        aria-label="Mobile admin navigation"
        aria-hidden={!mobileMenuOpen}
        inert={!mobileMenuOpen}
        className={`fixed inset-y-0 left-0 z-60 flex w-72 flex-col border-r border-slate-200 bg-slate-100 shadow-2xl transition-transform duration-300 dark:border-slate-700 dark:bg-slate-900 md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-700">
          <Link href="/admin/dashboard" onClick={closeMobileMenu} className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
              <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </span>
            <span>
              <span className="block text-sm font-bold text-slate-900 dark:text-white">Admin Console</span>
              <span className="block text-[10px] text-slate-500 dark:text-slate-400">Manage app operations</span>
            </span>
          </Link>
          <button
            type="button"
            aria-label="Close admin navigation"
            onClick={closeMobileMenu}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <AdminNavigation collapsed={false} onNavigate={closeMobileMenu} />
        <div className="shrink-0 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <Link href="/" onClick={closeMobileMenu} className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            Back to App
          </Link>
        </div>
      </aside>
    </>
  );
}
