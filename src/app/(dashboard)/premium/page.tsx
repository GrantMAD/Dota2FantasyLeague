import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BellRing,
  BrainCircuit,
  Check,
  Crown,
  LineChart,
  Minus,
  Sparkles,
  Target,
  WandSparkles,
} from 'lucide-react';
import { PremiumWaitlistButton, PremiumWaitlistProvider } from './PremiumWaitlist';

const features = [
  { icon: BarChart3, title: 'Advanced Player Analytics', description: 'Role-adjusted form, consistency, volatility, and matchup context for every eligible player.' },
  { icon: Target, title: 'Points Projections', description: 'Expected gameweek output based on fixtures, recent form, role, and historical performance.' },
  { icon: LineChart, title: 'Transfer Recommendations', description: 'Ranked candidates, differentials, value signals, and price momentum before the deadline.' },
  { icon: WandSparkles, title: 'Squad Optimiser', description: 'Find the strongest eight-player squad within your budget and role requirements.' },
  { icon: BellRing, title: 'Price Movement Alerts', description: 'Track players likely to rise or fall as ownership and transfer activity changes.' },
  { icon: BrainCircuit, title: 'AI Fantasy Assistant', description: 'Ask strategy questions and receive data-backed recommendations from live fantasy context.' },
];

const comparison = [
  ['Squad building and transfers', true],
  ['Classic and H2H leagues', true],
  ['Global leaderboard', true],
  ['Basic player statistics', true],
  ['Advanced analytics and projections', false],
  ['Transfer recommendations', false],
  ['Squad optimisation', false],
];

export const metadata = {
  title: 'Premium Tools | Fantasy Dota 2',
  description: 'Explore planned Fantasy Dota 2 tools for player analytics, points projections, transfer recommendations, squad optimisation, and alerts.',
};

export default function PremiumPage() {
  return (
    <PremiumWaitlistProvider>
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Link href="/learn" className="text-cyan-700 transition hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200">Learn Hub</Link>
            <span>/</span>
            <span className="text-[var(--text-secondary)]">Premium Tools</span>
          </div>

          <section className="relative isolate overflow-hidden rounded-3xl border border-amber-500/40 bg-[var(--surface)] p-6 shadow-2xl shadow-amber-500/10 sm:p-10 lg:p-12">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(125deg,rgba(245,158,11,0.13),transparent_55%,rgba(217,119,6,0.08))]" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 -z-10 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 -z-10 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-yellow-500 to-orange-500" />
            <div className="relative max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-200">
                <Crown className="h-4 w-4" /> Advanced fantasy tools
              </div>
              <h1 className="text-4xl font-black tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
                Turn information <span className="bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 bg-clip-text text-transparent">into an edge.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
                Premium will bring deeper analytics, smarter projections, and sharper transfer intelligence to managers who want to plan one move ahead.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <PremiumWaitlistButton
                  id="premium-join-waitlist"
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:-translate-y-0.5 hover:bg-amber-400"
                />
                <Link
                  href="/analytics"
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-amber-500/40 hover:bg-[var(--surface-muted)]"
                >
                  Use free analytics <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <p className="mt-4 text-xs text-[var(--text-muted)]">
                Premium tools are planned, with no launch date announced. Core fantasy gameplay remains free.
              </p>
            </div>
          </section>

          <section className="mt-12">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">The toolkit</p>
              <h2 className="mt-1 text-2xl font-black text-[var(--text-primary)]">Make every fantasy decision count</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className="group relative overflow-hidden rounded-2xl border border-amber-500/20 bg-[var(--surface)] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/60 hover:shadow-xl hover:shadow-amber-500/10"
                  >
                    <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-500/0 blur-2xl transition-colors group-hover:bg-amber-500/10" />
                    <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="relative mt-5 font-bold text-[var(--text-primary)]">{feature.title}</h3>
                    <p className="relative mt-2 text-sm leading-6 text-[var(--text-secondary)]">{feature.description}</p>
                    <span className="relative mt-4 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Planned</span>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-8">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-muted)]">Access model</p>
                <h2 className="text-2xl font-black text-[var(--text-primary)]">Free foundation, optional depth</h2>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-[1fr_90px_130px] bg-[var(--surface-raised)] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)] sm:text-xs">
                  <span>Capability</span>
                  <span className="text-center">Free</span>
                  <span className="text-center text-amber-700 dark:text-amber-300">Planned Premium</span>
                </div>
                {comparison.map(([label, free]) => (
                  <div key={String(label)} className="grid grid-cols-[1fr_90px_130px] border-t border-[var(--border)] px-4 py-3 text-sm even:bg-[var(--surface-raised)]/50">
                    <span className="text-[var(--text-primary)]">{String(label)}</span>
                    <span className="flex justify-center text-emerald-700 dark:text-emerald-300">
                      {free ? <Check aria-label="Included" className="h-5 w-5" /> : <Minus aria-label="Not included" className="h-4 w-4 text-[var(--text-muted)]" />}
                    </span>
                    <span className="flex justify-center text-amber-700 dark:text-amber-300">
                      <Check aria-label="Planned" className="h-5 w-5" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Available now</p>
              <h2 className="mt-2 text-xl font-bold text-[var(--text-primary)]">The core game stays free</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Build your squad, make transfers, join leagues, follow the leaderboard, and use the current analytics tools without a Premium subscription.</p>
            </article>
            <article className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">Planned</p>
              <h2 className="mt-2 text-xl font-bold text-[var(--text-primary)]">More ways to plan your season</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Advanced analytics, projections, transfer recommendations, optimisation, alerts, and the fantasy assistant are planned Premium tools. No launch date has been announced.</p>
            </article>
          </section>

          <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-[var(--text-primary)]">Stay ahead of the launch</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Join the waitlist for future Premium launch updates. No email is sent when you join.</p>
            </div>
            <PremiumWaitlistButton
              id="premium-footer-waitlist"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
            />
          </section>
        </div>
      </div>
    </PremiumWaitlistProvider>
  );
}
