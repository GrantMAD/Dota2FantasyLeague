'use client';

import Link from 'next/link';

const guideSections = [
  {
    title: 'Get Started',
    description: 'The public pages used to enter and understand the game.',
    pages: [
      { href: '/', name: 'Landing Page', description: 'Overview of Fantasy Dota 2 and the main sign-up and sign-in actions.' },
      { href: '/login', name: 'Sign In', description: 'Sign in with your email and password to access your account.' },
      { href: '/signup', name: 'Create Account', description: 'Register a new account with a username, email, and password.' },
      { href: '/forgot-password', name: 'Forgot Password', description: 'Request a secure password reset email.' },
      { href: '/rules', name: 'Rules', description: 'Learn squad rules, scoring, transfers, deadlines, and chips.' },
    ],
  },
  {
    title: 'Manage Your Fantasy Team',
    description: 'The core pages for building and managing your season.',
    pages: [
      { href: '/dashboard', name: 'Dashboard', description: 'See squad value, bank balance, points, rank, transfers, gameweek status, and league summaries.' },
      { href: '/squads', name: 'Squad', description: 'View your eight-player squad, player prices, roles, and captain markers.' },
      { href: '/lineups', name: 'Lineups', description: 'Choose your starting players, bench, captain, and vice-captain for a gameweek.' },
      { href: '/transfers', name: 'Transfers', description: 'Search the player market, compare form and prices, and make transfers.' },
      { href: '/players', name: 'Players', description: 'Browse professional players by role, team, price, and availability.' },
      { href: '/players/1', name: 'Player Details', description: 'Inspect an individual player, performance history, pricing, and fantasy statistics.' },
    ],
  },
  {
    title: 'Compete',
    description: 'Follow matches, gameweeks, rankings, tournaments, and leagues.',
    pages: [
      { href: '/leagues', name: 'Leagues', description: 'Create or join leagues and view classic standings or head-to-head fixtures.' },
      { href: '/leaderboard', name: 'Leaderboard', description: 'Compare global manager rankings, total points, and gameweek performance.' },
      { href: '/gameweeks', name: 'Gameweeks', description: 'Review active, upcoming, and completed gameweeks and their deadlines.' },
      { href: '/matches', name: 'Matches', description: 'Browse professional matches by schedule, status, team, or tournament.' },
      { href: '/matches/1', name: 'Match Details', description: 'View the teams, score, duration, tournament, gameweek, and detailed match information.' },
      { href: '/tournaments', name: 'Tournaments', description: 'Explore eligible professional tournaments and their schedules.' },
      { href: '/tournaments/1', name: 'Tournament Details', description: 'View a tournament and its associated matches.' },
    ],
  },
  {
    title: 'Account and Insights',
    description: 'Manage personal details, preferences, notifications, and analytics.',
    pages: [
      { href: '/profile', name: 'Profile', description: 'View your public manager identity and fantasy career summary.' },
      { href: '/account', name: 'Account', description: 'Update your username, country, timezone, and access password reset actions.' },
      { href: '/settings', name: 'Settings', description: 'Manage appearance, theme, and notification preferences.' },
      { href: '/notifications', name: 'Notifications', description: 'Read deadline, price, rank, and league updates, individually or all at once.' },
      { href: '/analytics', name: 'Analytics', description: 'Review platform metrics and analytics available to your account.' },
      { href: '/premium', name: 'Premium', description: 'Explore advanced analytics and premium fantasy tools.' },
      { href: '/help', name: 'Help Center', description: 'Find frequently asked questions and support information.' },
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-10 max-w-3xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-400">Fantasy Dota 2 Guide</p>
        <h1 className="mb-3 text-3xl font-bold text-white md:text-4xl">Everything in one place</h1>
        <p className="text-slate-400">Use this guide to understand what each user-facing page contains and when to use it.</p>
      </div>

      <div className="space-y-10">
        {guideSections.map((section) => (
          <section key={section.title}>
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
              <p className="mt-1 text-sm text-slate-400">{section.description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {section.pages.map((page) => (
                <Link key={page.href} href={`${page.href}?guide=1`} className="group rounded-xl border border-slate-700 bg-slate-800/50 p-5 transition-colors hover:border-cyan-500/60 hover:bg-slate-800">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-white group-hover:text-cyan-300">{page.name}</h3>
                    <span className="shrink-0 text-xs text-slate-500">{page.href}</span>
                  </div>
                  <p className="text-sm leading-6 text-slate-400">{page.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
