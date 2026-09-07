import Link from 'next/link';
import { ArrowRight, BookOpen, Calendar, Compass, Crown, Gauge, HelpCircle, LineChart, ScrollText, Shield, Sparkles, Users } from 'lucide-react';

const quickRules = [
  { label: 'Squad size', value: '8 players', href: '/rules#squad', icon: Users },
  { label: 'Starting roles', value: '5 positions', href: '/rules#squad', icon: Shield },
  { label: 'Starting budget', value: '$100.0M', href: '/rules#squad', icon: Gauge },
  { label: 'Captain bonus', value: '2.0x points', href: '/rules#captain', icon: Crown },
  { label: 'Free transfers', value: '1 per gameweek', href: '/rules#transfers', icon: ArrowRight },
  { label: 'Lock window', value: '30 minutes', href: '/rules#deadlines', icon: Calendar },
];

const actions = [
  { title: 'Build your squad', description: 'Draft your eight-player roster within the season budget.', href: '/squads', label: 'Open Squad', icon: Users },
  { title: 'Set your lineup', description: 'Assign roles, captaincy, bench players, and chips.', href: '/lineups', label: 'Set Lineup', icon: Shield },
  { title: 'Check the next deadline', description: 'Review the active gameweek and lock window.', href: '/gameweeks', label: 'View Gameweeks', icon: Calendar },
  { title: 'Explore the market', description: 'Compare player prices, form, and fantasy value.', href: '/transfers', label: 'Open Transfers', icon: LineChart },
];

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-2xl border border-slate-700 bg-linear-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-6 shadow-2xl sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            <BookOpen className="h-3.5 w-3.5" />
            Fantasy learning center
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Learn the game. Make better calls.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Start with a guided tour, check the official scoring rules, then move straight into building and managing your fantasy team.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/guide" className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400">
              <Compass className="h-4 w-4" /> Start Interactive Guide <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/rules" className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/70 px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-400">
              <ScrollText className="h-4 w-4 text-amber-300" /> Read Rules & Scoring
            </Link>
          </div>
        </div>
        <div className="relative mt-8 grid max-w-3xl grid-cols-2 gap-2 border-t border-slate-700/80 pt-6 sm:grid-cols-4">
          {['Start', 'Build', 'Compete', 'Improve'].map((step, index) => (
            <div key={step} className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">{index + 1}</span>{step}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <Link href="/guide" className="group rounded-2xl border border-cyan-500/25 bg-slate-900/80 p-6 transition hover:-translate-y-1 hover:border-cyan-400/60 hover:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300"><Compass className="h-6 w-6" /></div>
            <ArrowRight className="h-5 w-5 text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Interactive walkthroughs</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Manager Guide</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Launch step-by-step tours for every major fantasy screen, from your first squad to advanced analytics.</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">Browse guided tours <ArrowRight className="h-4 w-4" /></span>
        </Link>

        <Link href="/rules" className="group rounded-2xl border border-amber-500/25 bg-slate-900/80 p-6 transition hover:-translate-y-1 hover:border-amber-400/60 hover:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300"><ScrollText className="h-6 w-6" /></div>
            <ArrowRight className="h-5 w-5 text-slate-500 transition group-hover:translate-x-1 group-hover:text-amber-300" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Official reference</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Rules & Scoring</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Understand squad structure, fantasy scoring, captaincy, chips, transfers, deadlines, and dynamic pricing.</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-300">Open the rulebook <ArrowRight className="h-4 w-4" /></span>
        </Link>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">At a glance</p><h2 className="mt-1 text-2xl font-bold text-white">Core fantasy rules</h2></div>
          <Link href="/rules" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">View full rules →</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickRules.map((rule) => {
            const Icon = rule.icon;
            return <Link key={rule.label} href={rule.href} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-cyan-500/40"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-cyan-300"><Icon className="h-4 w-4" /></div><div><p className="text-xs text-slate-500">{rule.label}</p><p className="mt-1 font-semibold text-white">{rule.value}</p></div></Link>;
          })}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Learn by doing</p><h2 className="mt-1 text-2xl font-bold text-white">Your next move</h2></div>
        <div className="grid gap-3 md:grid-cols-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return <Link key={action.title} href={action.href} className="group flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-emerald-500/40 hover:bg-slate-900"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h3 className="font-semibold text-white">{action.title}</h3><p className="mt-1 text-sm text-slate-400">{action.description}</p></div><span className="shrink-0 text-xs font-semibold text-emerald-300 opacity-0 transition group-hover:opacity-100">{action.label} →</span></Link>;
          })}
        </div>
      </section>

      <div className="mt-10 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-cyan-300" /><div><p className="font-semibold text-white">Need a specific answer?</p><p className="text-sm text-slate-400">Browse common questions and support guidance.</p></div></div>
        <Link href="/help" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">Open Help Center <HelpCircle className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}
