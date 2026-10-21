import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Compass,
  Crown,
  Gauge,
  HelpCircle,
  LineChart,
  ScrollText,
  Shield,
  Sparkles,
  Users,
  ChevronRight,
  Trophy
} from 'lucide-react';

const quickRules = [
  { label: 'Squad size', value: '8 players', href: '/rules#squad', icon: Users, color: 'text-cyan-500 dark:text-cyan-400' },
  { label: 'Starting roles', value: '5 positions', href: '/rules#squad', icon: Shield, color: 'text-emerald-500 dark:text-emerald-400' },
  { label: 'Starting budget', value: '$100.0M', href: '/rules#squad', icon: Gauge, color: 'text-amber-500 dark:text-amber-400' },
  { label: 'Captain bonus', value: '2.0x points', href: '/rules#captain', icon: Crown, color: 'text-amber-500 dark:text-amber-400' },
  { label: 'Free transfers', value: '1 per gameweek', href: '/rules#transfers', icon: ArrowRight, color: 'text-cyan-500 dark:text-cyan-400' },
  { label: 'Lock window', value: 'Gameweek deadline', href: '/rules#deadlines', icon: Calendar, color: 'text-rose-500 dark:text-rose-400' },
];

const learningPath = [
  {
    step: 1,
    title: 'Start with Basics',
    description: 'Learn fantasy scoring, roster rules, and gameweek lock windows.',
    href: '/rules',
    badge: 'Step 1',
    label: 'Read Rules',
    icon: BookOpen,
  },
  {
    step: 2,
    title: 'Draft Your Squad',
    description: 'Build your 8-man roster under the $100M competitive salary cap.',
    href: '/squads',
    badge: 'Step 2',
    label: 'Assemble Squad',
    icon: Users,
  },
  {
    step: 3,
    title: 'Set Tactical Lineup',
    description: 'Designate your Captain for 2x points and choose seasonal chips.',
    href: '/lineups',
    badge: 'Step 3',
    label: 'Lock Starters',
    icon: Shield,
  },
  {
    step: 4,
    title: 'Compete & Climb',
    description: 'Join private or public leagues, scout transfers, and climb ranks.',
    href: '/leagues',
    badge: 'Step 4',
    label: 'Join Leagues',
    icon: Trophy,
  },
];

const actions = [
  {
    title: 'Build your squad',
    description: 'Draft your eight-player roster within the season budget.',
    href: '/squads',
    label: 'Open Squad',
    icon: Users,
    tag: 'Roster',
  },
  {
    title: 'Set your lineup',
    description: 'Assign roles, captaincy, bench players, and chips.',
    href: '/lineups',
    label: 'Set Lineup',
    icon: Shield,
    tag: 'Tactics',
  },
  {
    title: 'Check the next deadline',
    description: 'Review the active gameweek and lock countdown.',
    href: '/gameweeks',
    label: 'View Gameweeks',
    icon: Calendar,
    tag: 'Schedule',
  },
  {
    title: 'Explore the market',
    description: 'Compare player prices, form, and fantasy value.',
    href: '/transfers',
    label: 'Open Transfers',
    icon: LineChart,
    tag: 'Market',
  },
];

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-10 sm:px-6 lg:px-8">
      {/* Ambient Dota Lighting Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-10 shadow-2xl">
        {/* Glow ambient background effects */}
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 right-1/3 h-60 w-60 rounded-full bg-amber-500/10 blur-3xl" />
        
        {/* Tricolor Glowing Top Accent Stripe */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 via-teal-400 to-amber-400" />

        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">
            <BookOpen className="h-3.5 w-3.5" />
            Fantasy learning center
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-5xl">
            Learn the game.{' '}
            <span className="bg-gradient-to-r from-cyan-500 to-teal-400 bg-clip-text text-transparent">
              Make better calls.
            </span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
            Start with interactive walkthroughs, inspect official scoring rules, and master tactical squad mechanics to climb the global leaderboard.
          </p>
          <div className="mt-7 flex flex-wrap gap-3.5">
            <Link
              href="/guide"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 shadow-md shadow-cyan-500/20"
            >
              <Compass className="h-4 w-4" /> Start Interactive Guide <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/rules"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-slate-500 shadow-sm"
            >
              <ScrollText className="h-4 w-4 text-amber-500" /> Read Rules & Scoring
            </Link>
          </div>
        </div>

        {/* 4-Step Interactive Pathway Cards */}
        <div className="relative mt-10 border-t border-[var(--border)] pt-8">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Recommended Manager Path
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {learningPath.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group relative flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-600 dark:text-cyan-300">
                        {item.badge}
                      </span>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--text-muted)] group-hover:text-cyan-500">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-cyan-600 dark:group-hover:text-cyan-300">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                      {item.description}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-2.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                    <span>{item.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Feature Cards: Guide & Rules */}
      <section className="grid gap-6 md:grid-cols-2">
        <Link
          href="/guide"
          className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-xl"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
              <Compass className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-[var(--text-muted)] transition group-hover:translate-x-1 group-hover:text-cyan-500" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
            Interactive walkthroughs
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">Manager Guide</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
            Launch step-by-step interactive tours for every screen, with difficulty badges, estimated durations, and direct spotlight triggers.
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-cyan-600 dark:text-cyan-400">
            Browse guided tours <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <Link
          href="/rules"
          className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/50 hover:shadow-xl"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ScrollText className="h-6 w-6" />
            </div>
            <ArrowRight className="h-5 w-5 text-[var(--text-muted)] transition group-hover:translate-x-1 group-hover:text-amber-500" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
            Official reference
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">Rules & Scoring</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
            Explore squad requirements, combat & objective scoring points, captaincy, chips, transfer fees, and the Under the Hood mathematical engine.
          </p>
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-amber-600 dark:text-amber-400">
            Open the rulebook <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </section>

      {/* Quick Reference Rules Grid */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">At a glance</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">Core fantasy rules</h2>
          </div>
          <Link
            href="/rules"
            className="text-sm font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300"
          >
            View full rules →
          </Link>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {quickRules.map((rule) => {
            const Icon = rule.icon;
            return (
              <Link
                key={rule.label}
                href={rule.href}
                className="flex items-center gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4.5 transition-all hover:border-slate-500/50 hover:shadow-md"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-raised)] ${rule.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--text-muted)]">{rule.label}</p>
                  <p className="mt-0.5 text-base font-bold text-[var(--text-primary)]">{rule.value}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Learn By Doing Section */}
      <section className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">Learn by doing</p>
          <h2 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">Your next move</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                href={action.href}
                className="group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:border-emerald-500/40 hover:shadow-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-[var(--text-primary)]">{action.title}</h3>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      {action.tag}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{action.description}</p>
                </div>
                <span className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400 opacity-0 transition-opacity group-hover:opacity-100">
                  {action.label} →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Premium Intelligence Callout Banner */}
      <Link
        href="/premium"
        className="group flex flex-col gap-4 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-[var(--surface)] to-[var(--surface)] p-6 sm:p-8 transition-all hover:border-amber-400/60 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">Advanced tools</p>
          <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">Premium fantasy intelligence</h2>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Explore predictive modeling, optimal transfer solvers, and deeper player analytics.
          </p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-sm font-bold text-amber-600 dark:text-amber-400 transition group-hover:translate-x-1">
          Explore Premium <ArrowRight className="h-4 w-4" />
        </span>
      </Link>

      {/* Help & Support Footer Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-[var(--text-primary)]">Need a specific answer?</p>
            <p className="text-sm text-[var(--text-secondary)]">Browse common questions and support guidance.</p>
          </div>
        </div>
        <Link
          href="/help"
          className="inline-flex items-center gap-2 text-sm font-bold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300"
        >
          Open Help Center <HelpCircle className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

