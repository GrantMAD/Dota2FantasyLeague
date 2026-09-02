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

const adminMenuItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/data-jobs', label: 'Data Jobs', icon: Zap },
  { href: '/admin/observability', label: 'Observability', icon: Activity },
  { href: '/admin/data-quality', label: 'Data Quality', icon: AlertCircle },
  { href: '/admin/players', label: 'Players', icon: Users },
  { href: '/admin/teams', label: 'Teams', icon: Trophy },
  { href: '/admin/fantasy-teams', label: 'Fantasy Teams', icon: Swords },
  { href: '/admin/leagues', label: 'Leagues', icon: Shield },
  { href: '/admin/seasons', label: 'Seasons', icon: Calendar },
  { href: '/admin/gameweeks', label: 'Gameweeks', icon: Gamepad2 },
  { href: '/admin/matches', label: 'Matches', icon: BarChart3 },
  { href: '/admin/scoring', label: 'Scoring Rules', icon: CheckCircle },
  { href: '/admin/pricing', label: 'Pricing', icon: DollarSign },
  { href: '/admin/audit', label: 'Audit Log', icon: Database },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-gray-800 bg-gray-800">
      {/* Logo / Home */}
      <div className="border-b border-gray-700 p-6">
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

      {/* Navigation */}
      <nav className="space-y-2 p-4">
        {adminMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-gray-700 bg-gray-800/50 p-4">
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
