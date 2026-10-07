'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Trophy,
  Calendar,
  Gamepad2,
  BarChart3,
  DollarSign,
  Zap,
  Settings,
  AlertCircle,
  Database,
  CheckCircle,
  Activity,
  Shield,
  Swords,
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
      { href: '/admin/data-quality', label: 'Data Quality', description: 'Review provider conflicts and metrics', icon: AlertCircle },
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

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-800 bg-gray-800">
      {/* Logo / Home */}
      <div className="border-b border-gray-700 p-6 shrink-0">
        <Link href="/admin/dashboard" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
            <LayoutDashboard className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="font-bold text-white">Admin</h2>
            <p className="text-xs text-gray-400">Console</p>
          </div>
        </Link>
      </div>

      {/* Navigation — scrolls independently if items overflow */}
      <nav className="no-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
        {adminMenuSections.map((section) => (
          <section key={section.label} aria-label={section.label}>
            <h2 className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
              {section.label}
            </h2>
            <div className="space-y-1">
              {section.links.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-start gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                    }`}
                  >
                    <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${isActive ? 'text-amber-400' : 'text-gray-400'}`} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.label}</span>
                      <span className={`mt-0.5 block text-[10px] leading-tight ${isActive ? 'text-amber-200/70' : 'text-gray-500'}`}>
                        {item.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      {/* Footer — stays pinned at the bottom via flex column */}
      <div className="shrink-0 border-t border-gray-700 bg-gray-800/50 p-4">
        <div className="text-xs text-gray-500">
          <p>v0.1.0</p>
          <p className="mt-1">
            <Link href="/" className="text-gray-400 hover:text-gray-300">
              Back to App
            </Link>
          </p>
        </div>
      </div>
    </aside>
  );
}
