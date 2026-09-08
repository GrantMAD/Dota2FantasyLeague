import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarClock, Crown, Gauge, LineChart, ScrollText, Shield, Sparkles, Users } from 'lucide-react';

const sections = [
  { id: 'squad', label: 'Squad', icon: Users },
  { id: 'captain', label: 'Captaincy', icon: Crown },
  { id: 'scoring', label: 'Scoring', icon: Gauge },
  { id: 'chips', label: 'Chips', icon: Sparkles },
  { id: 'transfers', label: 'Transfers', icon: LineChart },
  { id: 'deadlines', label: 'Deadlines', icon: CalendarClock },
];

const scoringRows = [
  ['Kill', '+1.5', 'Combat'],
  ['Assist', '+0.75', 'Combat'],
  ['Death', '-1.0', 'Combat'],
  ['Game win', '+5.0', 'Match result'],
  ['Series win bonus', '+3.0', 'Match result'],
  ['Performance index', 'Up to +5.0', 'Role execution'],
  ['Consistency bonus', '+1.2', 'Sustained form'],
];

const chips = [
  { name: 'Wildcard', badge: '1 per season', description: 'Make unlimited free transfers for one gameweek without taking extra transfer penalties.' },
  { name: 'Triple Captain', badge: '1 per season', description: 'Your selected captain earns 3.0x points instead of the normal 2.0x multiplier.' },
  { name: 'Bench Boost', badge: '1 per season', description: 'All three bench players contribute their points to your gameweek total.' },
];

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center gap-2 text-sm text-slate-500"><Link href="/learn" className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200"><ArrowLeft className="h-4 w-4" /> Learn Hub</Link><span>/</span><span>Rules & Scoring</span></div>

      <section className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-linear-to-br from-slate-900 via-slate-900 to-amber-950/30 p-6 shadow-xl sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-300"><ScrollText className="h-3.5 w-3.5" /> Official rulebook</div>
          <h1 className="text-3xl font-black text-white sm:text-5xl">Game rules & scoring</h1>
          <p className="mt-4 text-base leading-7 text-slate-300">Everything you need to build a legal squad, score points, manage chips, and stay ahead of every deadline.</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/lineups" className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400">Set a lineup <ArrowRight className="h-4 w-4" /></Link><Link href="/learn" className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/70 px-4 py-3 text-sm font-semibold text-white hover:border-slate-400">Back to Learn Hub</Link></div>
        </div>
      </section>

      <nav className="rules-nav sticky top-3 z-20 mt-6 flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-950/95 p-2 shadow-lg backdrop-blur" aria-label="Rules sections">
        {sections.map((section) => { const Icon = section.icon; return <a key={section.id} href={`#${section.id}`} className="rules-nav-link inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"><Icon className="rules-nav-icon h-3.5 w-3.5 text-amber-300" />{section.label}</a>; })}
      </nav>

      <section id="squad" className="mt-8 scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
        <div className="mb-6 flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300"><Users className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Foundation</p><h2 className="mt-1 text-2xl font-bold text-white">Squad structure</h2></div></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs text-slate-500">Budget</p><p className="mt-2 text-xl font-black text-amber-300">$100.0M</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs text-slate-500">Squad size</p><p className="mt-2 text-xl font-black text-white">8 players</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs text-slate-500">Starting lineup</p><p className="mt-2 text-xl font-black text-white">5 roles</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs text-slate-500">Bench</p><p className="mt-2 text-xl font-black text-white">3 players</p></div></div>
        <p className="mt-6 text-sm leading-7 text-slate-300">Your starters must contain exactly one Carry, Mid, Offlane, Support, and Hard Support. The remaining three players are substitutes and can step in under the substitution rules. A fantasy team cannot own the same player twice and is subject to the configured professional-team limit.</p>
      </section>

      <section id="captain" className="mt-6 scroll-mt-24 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6 sm:p-8"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300"><Crown className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Leadership</p><h2 className="mt-1 text-2xl font-bold text-white">Captain & vice-captain</h2><p className="mt-3 text-sm leading-7 text-slate-300">Select one captain and one vice-captain before the deadline. The captain earns 2.0x fantasy points. If the captain does not play, the vice-captain receives the multiplier instead.</p></div></div></section>

      <section id="scoring" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8"><div className="mb-6 flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300"><Gauge className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Points engine</p><h2 className="mt-1 text-2xl font-bold text-white">Fantasy scoring</h2></div></div><div className="overflow-x-auto"><table className="w-full min-w-130 text-left text-sm"><thead><tr className="border-b border-slate-700 text-xs uppercase tracking-[0.16em] text-slate-500"><th className="px-3 py-3">Event</th><th className="px-3 py-3">Points</th><th className="px-3 py-3">Category</th></tr></thead><tbody>{scoringRows.map(([event, points, category]) => <tr key={event} className="border-b border-slate-800 last:border-0"><td className="px-3 py-3 font-medium text-white">{event}</td><td className={`px-3 py-3 font-bold ${points.startsWith('-') ? 'text-red-300' : 'text-emerald-300'}`}>{points}</td><td className="px-3 py-3 text-slate-400">{category}</td></tr>)}</tbody></table></div></section>

      <section id="chips" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8"><div className="mb-6 flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300"><Sparkles className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Seasonal powers</p><h2 className="mt-1 text-2xl font-bold text-white">Special chips</h2></div></div><div className="grid gap-4 md:grid-cols-3">{chips.map((chip) => <div key={chip.name} className="rounded-xl border border-slate-800 bg-slate-950/50 p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-bold text-white">{chip.name}</h3><span className="whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">{chip.badge}</span></div><p className="mt-4 text-sm leading-6 text-slate-400">{chip.description}</p></div>)}</div></section>

      <div className="mt-6 grid gap-6 md:grid-cols-2"><section id="transfers" className="scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/70 p-6"><div className="flex items-center gap-3"><LineChart className="h-5 w-5 text-cyan-300" /><h2 className="text-xl font-bold text-white">Transfers & prices</h2></div><p className="mt-4 text-sm leading-7 text-slate-300">You receive one free transfer per gameweek. Unused free transfers roll over up to two. Additional transfers cost a four-point penalty each. Player prices change based on performance, form, ownership, and market activity.</p><Link href="/transfers" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">Open Transfer Market <ArrowRight className="h-4 w-4" /></Link></section><section id="deadlines" className="scroll-mt-24 rounded-2xl border border-red-500/25 bg-red-500/5 p-6"><div className="flex items-center gap-3"><CalendarClock className="h-5 w-5 text-red-300" /><h2 className="text-xl font-bold text-white">Deadlines & locks</h2></div><p className="mt-4 text-sm leading-7 text-slate-300">Transfers and lineup changes lock 30 minutes before the first eligible match of the gameweek. Once locked, changes remain unavailable until the gameweek ends.</p><Link href="/gameweeks" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-red-300 hover:text-red-200">Check gameweek deadlines <ArrowRight className="h-4 w-4" /></Link></section></div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex items-center gap-3"><Shield className="h-5 w-5 text-emerald-300" /><p className="text-sm text-slate-300">Need a guided walkthrough of the app?</p></div><Link href="/guide" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">Launch Manager Guide <ArrowRight className="h-4 w-4" /></Link></div>
    </div>
  );
}
