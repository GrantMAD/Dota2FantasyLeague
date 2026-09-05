'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import {
  Compass,
  Search,
  Sparkles,
  ArrowUpRight,
  LayoutDashboard,
  Users,
  UserCheck,
  ArrowLeftRight,
  UserRound,
  FileText,
  Trophy,
  Medal,
  Calendar,
  Gamepad2,
  Swords,
  BarChart3,
  User,
  Settings,
  Bell,
  Crown,
  HelpCircle,
  ScrollText,
  PlayCircle,
  Layers,
  CheckCircle2,
} from 'lucide-react';

interface GuidePageItem {
  href: string;
  name: string;
  description: string;
  badge?: string;
  stepsCount: number;
  icon: React.ComponentType<{ className?: string }>;
}

interface GuideSection {
  id: string;
  title: string;
  tagline: string;
  badge: string;
  description: string;
  pages: GuidePageItem[];
}

const guideSections: GuideSection[] = [
  {
    id: 'squad',
    title: 'Squad & Team Management',
    tagline: 'Core Roster Operations',
    badge: 'Core Gameplay',
    description: 'The essential tactical tools for scouting, drafting, setting formations, and trading players.',
    pages: [
      {
        href: '/dashboard',
        name: 'Command Center',
        description: 'Instant overview of your active squad value, bank balance, live points, rank, and gameweek alerts.',
        badge: 'Hub',
        stepsCount: 3,
        icon: LayoutDashboard,
      },
      {
        href: '/squads',
        name: 'Squad Overview',
        description: 'Visual pitch layout displaying your 5 starters, 3 bench substitutes, player roles, and prices.',
        badge: 'Roster',
        stepsCount: 4,
        icon: Users,
      },
      {
        href: '/lineups',
        name: 'Lineup & Captaincy',
        description: 'Deploy starters, designate Captain (2x points) and Vice-Captain, fill bench, and activate seasonal chips.',
        badge: 'Tactics',
        stepsCount: 5,
        icon: UserCheck,
      },
      {
        href: '/transfers',
        name: 'Transfer Market',
        description: 'Filter pro players, evaluate market valuations, plan budget allocation, and execute roster trades.',
        badge: 'Market',
        stepsCount: 3,
        icon: ArrowLeftRight,
      },
      {
        href: '/players',
        name: 'Players Directory',
        description: 'Comprehensive index of all professional Dota 2 athletes, filterable by role, pro team, and stats.',
        badge: 'Scouting',
        stepsCount: 3,
        icon: UserRound,
      },
      {
        href: '/players/1',
        name: 'Player Performance Profile',
        description: 'Detailed statistical inspection showing career fantasy averages, GPM/XPM breakdown, and price history.',
        badge: 'Telemetry',
        stepsCount: 3,
        icon: FileText,
      },
    ],
  },
  {
    id: 'competition',
    title: 'Competition & Esports',
    tagline: 'Global Tournaments & Leagues',
    badge: 'Competitive',
    description: 'Track real-world Dota 2 fixtures, tournament standings, global leaderboards, and league rivalries.',
    pages: [
      {
        href: '/leagues',
        name: 'Leagues & Communities',
        description: 'Create private or public leagues, join with invite codes, and challenge friends in Classic or H2H modes.',
        badge: 'Social',
        stepsCount: 3,
        icon: Trophy,
      },
      {
        href: '/leaderboard',
        name: 'Global Leaderboard',
        description: 'Real-time manager rankings across the entire platform, featuring country filters and rank velocity.',
        badge: 'Rankings',
        stepsCount: 3,
        icon: Medal,
      },
      {
        href: '/gameweeks',
        name: 'Gameweeks & Deadlines',
        description: 'Review lock deadlines, scoring windows, active matches, and historical gameweek summaries.',
        badge: 'Schedule',
        stepsCount: 3,
        icon: Calendar,
      },
      {
        href: '/matches',
        name: 'Live & Upcoming Matches',
        description: 'Live ticker of pro matches with tournament details, format, status, and upcoming fantasy schedules.',
        badge: 'Esports',
        stepsCount: 3,
        icon: Gamepad2,
      },
      {
        href: '/matches/1',
        name: 'Match Details & Log',
        description: 'Granular breakdown of draft picks, match outcome, game duration, and individual fantasy score contributions.',
        badge: 'Deep Dive',
        stepsCount: 3,
        icon: Swords,
      },
      {
        href: '/tournaments',
        name: 'Pro Tournaments Index',
        description: 'Tier-1 and Tier-2 Dota 2 events eligible for fantasy points, with dates, prize pools, and schedules.',
        badge: 'Circuits',
        stepsCount: 3,
        icon: Swords,
      },
    ],
  },
  {
    id: 'insights',
    title: 'Intelligence & Management',
    tagline: 'Account & Analytics',
    badge: 'System',
    description: 'Fine-tune preferences, analyze telemetry, monitor alerts, and review scoring governance.',
    pages: [
      {
        href: '/rules',
        name: 'League Rules & Scoring',
        description: 'The master scoring manual covering point values for kills, assists, objectives, chip rules, and deadlines.',
        badge: 'Rulebook',
        stepsCount: 3,
        icon: ScrollText,
      },
      {
        href: '/analytics',
        name: 'Performance Analytics',
        description: 'High-level fantasy meta metrics, ownership trends, captaincy popularity, and squad efficiency.',
        badge: 'Data',
        stepsCount: 3,
        icon: BarChart3,
      },
      {
        href: '/premium',
        name: 'Advanced Analytics',
        description: 'Cutting-edge predictive modeling, optimal lineup solvers, and automated transfer recommendations.',
        badge: 'Pro Tier',
        stepsCount: 3,
        icon: Crown,
      },
      {
        href: '/profile',
        name: 'Manager Profile',
        description: 'Public identity card showcasing your fantasy accolades, trophies, badges, and historic season stats.',
        badge: 'Identity',
        stepsCount: 3,
        icon: User,
      },
      {
        href: '/notifications',
        name: 'Activity Feed & Alerts',
        description: 'Real-time notifications for deadline reminders, price adjustments, match finishes, and league standings.',
        badge: 'Inbox',
        stepsCount: 3,
        icon: Bell,
      },
      {
        href: '/settings',
        name: 'Account & Appearance',
        description: 'Configure light/dark Competitive Esports themes, notification delivery channels, and account security.',
        badge: 'Preferences',
        stepsCount: 3,
        icon: Settings,
      },
      {
        href: '/help',
        name: 'Help Center & Support',
        description: 'Frequently asked questions, role guidelines, scoring clarifications, and direct user assistance.',
        badge: 'Support',
        stepsCount: 3,
        icon: HelpCircle,
      },
    ],
  },
];

export default function GuidePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredSections = useMemo(() => {
    return guideSections
      .filter((section) => selectedCategory === 'all' || section.id === selectedCategory)
      .map((section) => {
        const matchingPages = section.pages.filter((page) => {
          if (!searchQuery.trim()) return true;
          const query = searchQuery.toLowerCase();
          return (
            page.name.toLowerCase().includes(query) ||
            page.description.toLowerCase().includes(query) ||
            page.href.toLowerCase().includes(query) ||
            page.badge?.toLowerCase().includes(query)
          );
        });
        return { ...section, pages: matchingPages };
      })
      .filter((section) => section.pages.length > 0);
  }, [searchQuery, selectedCategory]);

  const totalTours = useMemo(() => {
    return guideSections.reduce((acc, s) => acc + s.pages.length, 0);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Hero Header */}
      <div className="relative mb-10 overflow-hidden rounded-2xl border border-slate-700/80 bg-linear-to-br from-slate-900 via-slate-900/95 to-slate-950 p-6 sm:p-10 shadow-2xl">
        {/* Glow ambient effects */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <Compass className="h-3.5 w-3.5 animate-spin-slow" />
              Interactive Tour Directory
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Interactive Guide & <span className="bg-linear-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">Feature Walkthroughs</span>
            </h1>
            <p className="text-base text-slate-300 sm:text-lg">
              Explore step-by-step interactive walkthroughs for every screen in Fantasy Dota 2. Click any card to launch the live guided overlay directly on that page.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex shrink-0 flex-wrap gap-3 sm:gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-800/80 px-4 py-3 shadow-inner">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{totalTours}</div>
                <div className="text-xs text-slate-400">Guided Tours</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-800/80 px-4 py-3 shadow-inner">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">100%</div>
                <div className="text-xs text-slate-400">Step-by-Step</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-8 flex flex-col gap-3 border-t border-slate-800/80 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Modules' },
              { id: 'squad', label: 'Squad & Lineups' },
              { id: 'competition', label: 'Competitions' },
              { id: 'insights', label: 'Insights & Rules' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  selectedCategory === tab.id
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'border border-slate-700/70 bg-slate-800/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guides (e.g. captain, pitch)..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900/90 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Sections Grid */}
      <div className="space-y-12">
        {filteredSections.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-12 text-center">
            <Compass className="mx-auto h-12 w-12 text-slate-600 mb-3" />
            <h3 className="text-lg font-semibold text-white">No guide tours matched your search</h3>
            <p className="mt-1 text-sm text-slate-400">Try adjusting your keywords or clearing the category filter.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-cyan-400 hover:bg-slate-700"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filteredSections.map((section) => (
            <section key={section.id} className="space-y-5">
              <div className="flex flex-col gap-1 border-b border-slate-800 pb-3 sm:flex-row sm:items-baseline sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-1 rounded-full bg-cyan-500" />
                  <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{section.title}</h2>
                  <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-xs font-medium text-slate-400">
                    {section.pages.length} tours
                  </span>
                </div>
                <p className="text-xs text-slate-400 sm:text-right">{section.description}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.pages.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Link
                      key={page.href}
                      href={`${page.href}?guide=1`}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900/60 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500/50 hover:bg-slate-800/90 hover:shadow-xl hover:shadow-cyan-500/10"
                    >
                      {/* Top Accent Gradient Line */}
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-transparent via-cyan-500/0 to-transparent transition-all duration-300 group-hover:via-cyan-400" />

                      <div>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800 text-cyan-400 transition-colors group-hover:border-cyan-500/40 group-hover:bg-cyan-500/10 group-hover:text-cyan-300">
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 group-hover:text-slate-300">
                              {page.badge}
                            </span>
                          </div>

                          <div className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-800/50 px-2.5 py-0.5 text-[11px] font-medium text-slate-400 transition-colors group-hover:border-cyan-500/30 group-hover:bg-cyan-500/10 group-hover:text-cyan-300">
                            <span>{page.stepsCount} steps</span>
                          </div>
                        </div>

                        <h3 className="text-base font-bold text-white transition-colors group-hover:text-cyan-300">
                          {page.name}
                        </h3>
                        <p className="mt-2 text-xs leading-relaxed text-slate-400 line-clamp-3 group-hover:text-slate-300">
                          {page.description}
                        </p>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-slate-800/80 pt-3.5 text-xs">
                        <span className="font-mono text-[11px] text-slate-400">{page.href}</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-cyan-400 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-300">
                          Launch Tour
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Footer Banner Directing to League Rules */}
      <div className="mt-14 rounded-xl border border-slate-800 bg-linear-to-r from-slate-900 via-slate-900/90 to-slate-950 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-amber-400" />
              Looking for Scoring Math & Rules?
            </h3>
            <p className="text-sm text-slate-400">
              Read the comprehensive breakdown on kill multipliers, match bonuses, transfer deadlines, and seasonal chip activations.
            </p>
          </div>
          <Link
            href="/rules"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-linear-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-bold text-slate-950 transition-all hover:brightness-110 shadow-lg shadow-amber-500/20"
          >
            Read Game Rules
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

