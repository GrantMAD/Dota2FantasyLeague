import Link from 'next/link';
import { ArrowRight, BarChart3, BellRing, BrainCircuit, Crown, LineChart, Sparkles, Target, WandSparkles } from 'lucide-react';

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
  description: 'Explore advanced fantasy analytics and strategy tools.',
};

export default function PremiumPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-500"><Link href="/learn" className="text-cyan-300 hover:text-cyan-200">Learn Hub</Link><span>/</span><span>Premium Tools</span></div>
        <section className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-linear-to-br from-slate-900 via-slate-900 to-amber-950/35 p-6 shadow-2xl sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-300"><Crown className="h-3.5 w-3.5" /> Advanced fantasy tools</div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Turn information into an edge.</h1>
            <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">Premium will bring deeper analytics, smarter projections, and sharper transfer intelligence to managers who want to plan one move ahead.</p>
            <div className="mt-7 flex flex-wrap gap-3"><button id="premium-join-waitlist" className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400">Join the waitlist <ArrowRight className="h-4 w-4" /></button><Link href="/analytics" className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/70 px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-400">Use free analytics</Link></div>
            <p className="mt-4 text-xs text-slate-500">Premium is coming soon. Core fantasy gameplay remains free.</p>
          </div>
        </section>

        <section className="mt-10"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">The toolkit</p><h2 className="mt-1 text-2xl font-bold text-white">Make every fantasy decision count</h2></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{features.map((feature) => { const Icon = feature.icon; return <article key={feature.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:-translate-y-1 hover:border-amber-500/40"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300"><Icon className="h-5 w-5" /></div><h3 className="mt-5 font-bold text-white">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{feature.description}</p><span className="mt-4 inline-flex rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">Planned</span></article>; })}</div></section>

        <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8"><div className="mb-5 flex items-center gap-3"><Sparkles className="h-5 w-5 text-cyan-300" /><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Access model</p><h2 className="text-2xl font-bold text-white">Free foundation, optional depth</h2></div></div><div className="overflow-hidden rounded-xl border border-slate-800"><div className="grid grid-cols-[1fr_90px_90px] bg-slate-800/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"><span>Capability</span><span className="text-center">Free</span><span className="text-center text-amber-300">Premium</span></div>{comparison.map(([label, free]) => <div key={String(label)} className="grid grid-cols-[1fr_90px_90px] border-t border-slate-800 px-4 py-3 text-sm"><span className="text-slate-300">{String(label)}</span><span className="text-center text-emerald-300">{free ? '✓' : '—'}</span><span className="text-center text-amber-300">✓</span></div>)}</div></section>

        <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-white">Stay ahead of the launch</h2><p className="mt-1 text-sm text-slate-400">Join the waitlist to hear when advanced tools become available.</p></div><button id="premium-footer-waitlist" className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400">Join the waitlist</button></section>
      </div>
    </div>
  );
}
