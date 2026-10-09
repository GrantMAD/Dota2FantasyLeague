import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarClock, Cpu, Crown, Gauge, LineChart, ScrollText, Shield, Sparkles, Users } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Game Rules & Scoring | Fantasy Dota 2',
  description: 'Read the Fantasy Dota 2 rules for squad building, captaincy, scoring, chips, transfers, and gameweek deadlines.',
};

const sections = [
  { id: 'squad', label: 'Squad', icon: Users },
  { id: 'captain', label: 'Captaincy', icon: Crown },
  { id: 'scoring', label: 'Scoring', icon: Gauge },
  { id: 'chips', label: 'Chips', icon: Sparkles },
  { id: 'transfers', label: 'Transfers', icon: LineChart },
  { id: 'deadlines', label: 'Deadlines', icon: CalendarClock },
  { id: 'hood', label: 'Under the Hood', icon: Cpu },
];

const scoringRows = [
  ['Kill', '+1.5', 'Combat'],
  ['Assist', '+0.75', 'Combat'],
  ['Death', '-1.0 each', 'Penalty'],
  ['KDA bonus (KDA ≥5.0)', '+2.0', 'Combat'],
  ['KDA bonus (KDA ≥3.0)', '+1.0', 'Combat'],
  ['GPM (role-adjusted)', 'Up to +7.5', 'Economy'],
  ['XPM (role-adjusted)', 'Up to +6.0', 'Economy'],
  ['Last Hits (role-adjusted)', 'Up to +2.6', 'Economy'],
  ['Denies', '+0.1 each', 'Economy'],
  ['Hero Damage (role-adj.)', 'Up to +6.0', 'Objective'],
  ['Tower Damage (role-adj.)', 'Up to +3.0', 'Objective'],
  ['Healing (role-adj.)', 'Up to +4.5', 'Objective'],
  ['Wards Placed', '+0.5 each', 'Objective'],
  ['Wards Destroyed', '+0.3 each', 'Objective'],
  ['Roshan Kill', '+2.0 each', 'Objective'],
  ['Teamfight proxy', 'Damage ×0.0004 + healing ×0.0015 + tower damage ×0.0008', 'Teamfight'],
  ['Game win', '+5.0', 'Match result'],
  ['Series win', '+3.0 on clinching game', 'Series'],
  ['Performance index (≥90)', '+5.0', 'Role execution'],
  ['Performance index (≥80)', '+3.0', 'Role execution'],
  ['Performance index (≥70)', '+1.0', 'Role execution'],
  ['Consistency', '+1.0 after 3 consecutive appearances with index ≥80', 'Consistency'],
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
        <div className="mt-6 flex flex-wrap gap-2 mb-4">{['Carry','Mid','Offlane','Support','Hard Support'].map((role) => (<span key={role} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">{role}</span>))}</div><p className="text-sm leading-7 text-slate-300">Your lineup must fill one starting slot for each of the five roles above. A squad can have up to <strong className="text-white">3 optional bench players</strong>; you do not need to fill the bench to save a lineup. Bench players can automatically substitute for absent starters only if they played that gameweek and share the <strong className="text-white">exact same role</strong> as the missing starter. You may not own the same player in two squad slots, and a maximum of <strong className="text-white">3 players</strong> from the same professional team are allowed in your squad at any time.</p>
      </section>

      <section id="captain" className="mt-6 scroll-mt-24 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6 sm:p-8"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300"><Crown className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Leadership</p><h2 className="mt-1 text-2xl font-bold text-white">Captain & vice-captain</h2><p className="mt-3 text-sm leading-7 text-slate-300">Choose one captain and one vice-captain from your five selected starters before the gameweek deadline. They must be different players.</p><ul className="mt-3 space-y-2 text-sm text-slate-300"><li className="flex items-start gap-2"><span className="text-emerald-300 mt-0.5">→</span><span>Your <strong className="text-white">captain</strong> earns <strong className="text-white">2.0×</strong> fantasy points for that gameweek.</span></li><li className="flex items-start gap-2"><span className="text-emerald-300 mt-0.5">→</span><span>If the captain has no recorded match participation that gameweek, the <strong className="text-white">vice-captain</strong> automatically receives the captain multiplier instead.</span></li><li className="flex items-start gap-2"><span className="text-emerald-300 mt-0.5">→</span><span>You can change your captain and vice-captain at any time <strong className="text-white">up until the gameweek deadline</strong>.</span></li></ul></div></div></section>

      <section id="scoring" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8"><div className="mb-6 flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300"><Gauge className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Points engine</p><h2 className="mt-1 text-2xl font-bold text-white">Fantasy scoring</h2></div></div><p className="mb-4 text-sm leading-6 text-slate-300">The values below describe the current default scoring setup. Published scoring rules for your season take precedence and may change configurable point values. Role-adjusted categories are capped at the amounts shown.</p><div className="overflow-x-auto"><table className="w-full min-w-130 text-left text-sm"><thead><tr className="border-b border-slate-700 text-xs uppercase tracking-[0.16em] text-slate-500"><th className="px-3 py-3">Event</th><th className="px-3 py-3">Points</th><th className="px-3 py-3">Category</th></tr></thead><tbody>{scoringRows.map(([event, points, category]) => <tr key={event} className="border-b border-slate-800 last:border-0"><td className="px-3 py-3 font-medium text-white">{event}</td><td className={`px-3 py-3 font-bold ${points.startsWith('-') ? 'text-red-300' : 'text-emerald-300'}`}>{points}</td><td className="px-3 py-3 text-slate-400">{category}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-slate-500">⚙️ Economy and Objective scores are role-adjusted — a Hard Support scoring 300 GPM is rewarded differently to a Carry with the same stat. Performance bonuses use the calculated performance index, not a ranking percentile. See the <a href="#hood" className="text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline">Under the Hood</a> section for role benchmarks and scoring details.</p></section>

      <section id="chips" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8"><div className="mb-6 flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300"><Sparkles className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Seasonal powers</p><h2 className="mt-1 text-2xl font-bold text-white">Special chips</h2></div></div><div className="grid gap-4 md:grid-cols-3">{chips.map((chip) => <div key={chip.name} className="rounded-xl border border-slate-800 bg-slate-950/50 p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-bold text-white">{chip.name}</h3><span className="whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">{chip.badge}</span></div><p className="mt-4 text-sm leading-6 text-slate-400">{chip.description}</p></div>)}</div><div className="mt-5 rounded-xl border border-amber-500/15 bg-slate-950/40 p-4"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-300">Chip Rules</p><ul className="space-y-1.5 text-xs text-slate-400"><li className="flex items-start gap-2"><span className="text-amber-300 shrink-0">•</span><span>Each chip can only be used <strong className="text-white">once per season</strong> — once activated it cannot be reused.</span></li><li className="flex items-start gap-2"><span className="text-amber-300 shrink-0">•</span><span>Activate a chip before the upcoming gameweek deadline; it cannot be applied retroactively.</span></li><li className="flex items-start gap-2"><span className="text-amber-300 shrink-0">•</span><span>The app currently allows different chip types to be activated for the same gameweek; it does not enforce the no-stacking rule.</span></li><li className="flex items-start gap-2"><span className="text-amber-300 shrink-0">•</span><span>Wildcard provides unlimited transfers for its gameweek. It does not remove other transfer requirements, such as matching roles, budget, and squad limits.</span></li></ul></div></section>

      <div className="mt-6 grid gap-6 md:grid-cols-2"><section id="transfers" className="scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/70 p-6"><div className="flex items-center gap-3"><LineChart className="h-5 w-5 text-cyan-300" /><h2 className="text-xl font-bold text-white">Transfers & prices</h2></div><p className="mt-4 text-sm leading-7 text-slate-300">A new fantasy season starts with <strong className="text-white">2 free transfers</strong>. After that, you receive <strong className="text-white">1 additional free transfer</strong> at each gameweek rollover; unused transfers roll over to a maximum bank of <strong className="text-white">2</strong>. Each transfer beyond your free allowance is recorded as a <strong className="text-white">4-point hit</strong>. The current gameweek total calculation does not yet subtract recorded transfer hits. Transfers require equal numbers of players in and out, sufficient budget, and a role-for-role swap. The transfer database check requires the <strong className="text-white">exact same role</strong> — Support and Hard Support are not interchangeable for transfers. The <strong className="text-white">Wildcard</strong> grants unlimited transfers for its gameweek without transfer hits. Player prices are recalculated on a 10-minute schedule using recent form and ownership; ownership adds upward pressure but does not itself lower prices.</p><Link href="/transfers" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">Open Transfer Market <ArrowRight className="h-4 w-4" /></Link></section><section id="deadlines" className="scroll-mt-24 rounded-2xl border border-red-500/25 bg-red-500/5 p-6"><div className="flex items-center gap-3"><CalendarClock className="h-5 w-5 text-red-300" /><h2 className="text-xl font-bold text-white">Deadlines & locks</h2></div><p className="mt-4 text-sm leading-7 text-slate-300">Each gameweek has a set <strong className="text-white">deadline timestamp</strong>. Once that time passes, transfers and lineup changes are locked for that gameweek. Chip activations are also limited to the upcoming gameweek before its deadline. Any unsaved lineup changes are <strong className="text-white">not saved</strong> — always save your lineup before the deadline. The exact deadline for each gameweek is visible on the Gameweeks page.</p><Link href="/gameweeks" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-red-300 hover:text-red-200">Check gameweek deadlines <ArrowRight className="h-4 w-4" /></Link></section></div>

      {/* Under the Hood */}
      <section id="hood" className="mt-6 scroll-mt-24 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 sm:p-8">
        <div className="mb-8 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300"><Cpu className="h-5 w-5" /></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Technical systems</p><h2 className="mt-1 text-2xl font-bold text-white">Under the Hood</h2><p className="mt-2 text-sm leading-6 text-slate-400">How the engine that powers your fantasy league actually works — from live match data ingestion all the way to your final score.</p></div>
        </div>

        {/* 1. Points Engine */}
        <div className="mb-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><span>🧮</span> Points Engine</h3>
          <p className="mb-4 text-sm text-slate-400">Every player&apos;s performance is broken into 13 tracked stats, then grouped into 9 score categories:</p>
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {[['Kills','Combat contribution'],['Deaths','Penalty'],['Assists','Supporting kills'],['GPM','Gold efficiency'],['XPM','Level efficiency'],['Last Hits','Creep farm'],['Denies','Enemy XP denied'],['Hero Damage','Damage to heroes'],['Tower Damage','Objective push'],['Healing','Support output'],['Wards Placed','Vision'],['Wards Destroyed','Counter-vision'],['Roshan Kills','Major objective']].map(([stat, desc]) => (
              <div key={stat} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"><p className="text-xs font-bold text-white">{stat}</p><p className="text-[11px] text-slate-500">{desc}</p></div>
            ))}
          </div>
          <p className="mb-3 text-sm text-slate-400">The 9 score categories those stats feed into:</p>
          <div className="mb-5 space-y-2">
            {[
              ['Combat','text-red-300','Kills ×1.5 + Assists ×0.75 − Deaths ×1.0. KDA efficiency bonus: ≥5.0 = +2 pts, ≥3.0 = +1 pt.'],
              ['Economy','text-amber-300','GPM & XPM normalized against role benchmarks. Carry expects 550 GPM; Hard Support only 200 GPM — so every role is rewarded fairly.'],
              ['Objective','text-cyan-300','Hero damage, tower damage, healing, wards placed/destroyed, and Roshan kills.'],
              ['Teamfight','text-purple-300','Proxy from match stats: hero damage ×0.0004 + healing ×0.0015 + tower damage ×0.0008.'],
              ['Win','text-emerald-300','Flat +5.0 pts awarded for winning the match.'],
              ['Series','text-emerald-300','The winning team earns the configured series bonus (default +3) in the clinching game of a best-of series.'],
              ['Performance','text-violet-300','Index = (Combat + Economy + Objective) ÷ 40 × 100, capped at 100; ≥90 = +5 pts, ≥80 = +3 pts, ≥70 = +1 pt.'],
              ['Consistency','text-violet-300','+1 point when a player reaches an 80 performance index in three consecutive match appearances.'],
            ].map(([cat, colour, desc]) => (
              <div key={cat} className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/30 p-3"><span className={`mt-0.5 w-24 shrink-0 text-xs font-bold ${colour}`}>{cat}</span><span className="text-xs text-slate-400">{desc}</span></div>
            ))}
          </div>
          <p className="mb-3 text-sm text-slate-400">Economy scoring uses role-adjusted GPM/XPM benchmarks so every position is rewarded fairly:</p>
          <div className="mb-5 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-700 text-xs uppercase tracking-widest text-slate-500"><th className="px-4 py-3">Role</th><th className="px-4 py-3">Expected GPM</th><th className="px-4 py-3">Expected XPM</th></tr></thead><tbody>{[['Carry','550','600'],['Mid','450','550'],['Offlane','350','450'],['Support','250','350'],['Hard Support','200','300']].map(([role, gpm, xpm]) => (<tr key={role} className="border-b border-slate-800 last:border-0"><td className="px-4 py-3 font-medium text-white">{role}</td><td className="px-4 py-3 text-amber-300">{gpm}</td><td className="px-4 py-3 text-cyan-300">{xpm}</td></tr>))}</tbody></table>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-300">Captain Multiplier — Applied Last</p><p className="text-sm text-slate-300">After player scores are summed, the captain&apos;s score is multiplied by <strong className="text-white">2×</strong> (or <strong className="text-white">3×</strong> with Triple Captain). If the captain has no recorded match participation, the vice-captain receives that same multiplier. Teamfight points use the match provider&apos;s player-level damage and healing stats as a proxy, since neither configured provider supplies a distinct teamfight-participation value. A +3 series bonus is awarded to players in the clinching game for the team that completes the best-of series. A +1 consistency bonus is awarded on an appearance when the player reaches at least an 80 performance index for three consecutive match appearances. Death deductions are displayed separately under Penalties.</p></div>
        </div>

        {/* 2. Live Data Pipeline */}
        <div className="mb-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><span>🔄</span> Live Data Pipeline</h3>
          <p className="mb-5 text-sm text-slate-400">Real Dota 2 match data flows through six automated steps before it reaches your score:</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['①','Discover Tournaments','New events are detected and registered in the system.','Every 6 hrs'],
              ['②','Fetch Matches','Scheduled and live matches are pulled from tournament data.','Every hour'],
              ['③','Fetch Match Details','Per-player stats (kills, GPM, wards etc.) are ingested.','Every 30 min'],
              ['④','Process Completed','Finished matches are verified and locked for scoring.','Every 45 min'],
              ['⑤','Calculate Scores','Match stats are converted into fantasy point breakdowns.','Scheduled periodically'],
              ['⑥','Recalculate Standings','Gameweek totals and season standings are refreshed after scoring.','Scheduled periodically'],
            ].map(([num, title, desc, freq]) => (
              <div key={title} className="rounded-xl border border-violet-500/20 bg-slate-950/50 p-4">
                <span className="block text-xl font-black text-violet-300 mb-1">{num}</span>
                <p className="text-sm font-bold text-white">{title}</p>
                <p className="mt-1 text-xs text-slate-400">{desc}</p>
                <span className="mt-3 inline-block rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{freq}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Automated Job Schedule */}
        <div className="mb-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><span>⏱️</span> Automated Job Schedule</h3>
          <p className="mb-4 text-sm text-slate-400">Background jobs run on configured recurring schedules. Processing and data availability can affect when updated scores and standings appear:</p>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-700 text-xs uppercase tracking-widest text-slate-500"><th className="px-4 py-3">Job</th><th className="px-4 py-3">What It Does</th><th className="px-4 py-3">Frequency</th></tr></thead><tbody>{[['Roster Changes','Detects overnight player team transfers','Daily — 2 AM UTC'],['Player Sync','Refreshes the pro player database','Daily — 3 AM UTC'],['Team Sync','Refreshes pro team rosters','Daily — 3:15 AM UTC'],['Tournament Discovery','Finds and registers new active tournaments','Every 6 hours'],['Match Fetch','Pulls new scheduled and live matches','Every hour'],['Match Details','Ingests per-player stats for each match','Every 30 min'],['Process Completed','Locks finished matches ready for scoring','Every 45 min'],['Score Calculation','Calculates fantasy score breakdowns','Recurring schedule'],['Gameweek Recalculation','Updates gameweek totals and standings','Recurring schedule'],['Price Updates','Recalculates all player prices','Every 10 min']].map(([job, desc, freq]) => (<tr key={job} className="border-b border-slate-800 last:border-0"><td className="px-4 py-3 font-medium text-white whitespace-nowrap">{job}</td><td className="px-4 py-3 text-xs text-slate-400">{desc}</td><td className="px-4 py-3 text-xs text-violet-300 whitespace-nowrap">{freq}</td></tr>))}</tbody></table>
          </div>
          <p className="mt-3 text-xs text-slate-500">💡 Score calculation triggers a gameweek recalculation after processing. Final updates depend on match data arriving and the scheduled jobs completing.</p>
        </div>

        {/* 4. Dynamic Pricing Formula */}
        <div className="mb-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><span>💰</span> Dynamic Pricing Formula</h3>
          <p className="mb-4 text-sm text-slate-400">After a gameweek closes, player prices are calculated from fantasy points and squad ownership. The job may run every 10 minutes, but it recalculates the same gameweek from its original price rather than stacking another change on each run:</p>
          <div className="mb-5 rounded-xl border border-slate-700 bg-slate-950/60 p-4 font-mono text-sm">
            <p className="text-slate-300">Price Movement = <span className="text-amber-300">(Gameweek Fantasy Points × 0.02)</span> + <span className="text-cyan-300">(Ownership × 0.10)</span></p>
            <p className="mt-1 text-slate-300">New Price &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= Gameweek Base Price + Movement <span className="text-slate-500">(capped ±$0.5M)</span></p>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {[
              ['Gameweek Fantasy Points','text-amber-300','The player’s summed fantasy points from the latest closed gameweek. Every point changes the price signal by $0.02M; negative points can pull the price down.'],
              ['Ownership %','text-cyan-300','The share of active squads that own this player. Ownership adds a smaller upward signal, up to $0.10M when every squad owns the player.'],
              ['±$0.5M Cap','text-slate-300','Limits the total price movement to $0.50M for a gameweek, regardless of how many times the scheduled job reruns.'],
            ].map(([title, colour, desc]) => (
              <div key={title} className="rounded-xl border border-slate-800 bg-slate-950/30 p-4"><p className={`mb-2 text-xs font-bold ${colour}`}>{title}</p><p className="text-xs text-slate-400">{desc}</p></div>
            ))}
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-300">Worked Example</p>
            <p className="text-sm text-slate-300">Carry player — gameweek base price <strong className="text-white">$9.5M</strong>, scores <span className="text-emerald-300">20 fantasy points</span>, and is owned by 60% of squads.</p>
            <p className="mt-2 font-mono text-sm text-slate-300">Movement = (20 × 0.02) + (0.6 × 0.10) = 0.40 + 0.06 = <span className="text-emerald-300">+$0.46M</span></p>
            <p className="mt-1 font-mono text-sm font-bold text-white">New price: $9.96M</p>
          </div>
        </div>

        {/* 5. Rankings & Standings */}
        <div className="mb-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><span>🏆</span> Rankings &amp; Standings</h3>
          <p className="mb-4 text-sm text-slate-400">After each gameweek is scored, standings are recalculated in five steps:</p>
          <div className="space-y-3">
            {[
              ['1','Lineup Total',"Selected starters' points are summed. The captain's score is multiplied (2× or 3× with Triple Captain active). If Bench Boost is active, selected bench players also contribute."],
              ['2','VC Fallback',"If the captain has no recorded match participation, the vice-captain automatically receives the captain multiplier instead."],
              ['3','Season Total','Each gameweek total is accumulated into the running season total stored per fantasy team.'],
              ['4','Global Rank','Fantasy teams are ranked by season total. Rankings refresh on a separate scheduled job and may lag behind new scores.'],
              ['5','League Rank','The same calculation is applied within each private or public league you have joined.'],
            ].map(([num, title, desc]) => (
              <div key={num} className="flex gap-4 rounded-xl border border-slate-800 bg-slate-950/30 p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-black text-violet-300">{num}</span><div><p className="text-sm font-bold text-white">{title}</p><p className="mt-1 text-xs text-slate-400">{desc}</p></div></div>
            ))}
          </div>
        </div>

        {/* 6. Automated Notifications */}
        <div>
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><span>🔔</span> Automated Notifications</h3>
          <p className="mb-4 text-sm text-slate-400">Three types of notification are sent automatically based on system events:</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['⏰','Deadline Alert','Sent 30 minutes before a gameweek locks. Reminds you to finalise your lineup and captain before transfers close.','border-red-500/20 bg-red-500/5'],
              ['💰','Price Change','Triggered when a player in your squad experiences a significant price movement up or down.','border-amber-500/20 bg-amber-500/5'],
              ['📈','Rank Change','Sent when your global or league rank changes after a gameweek is fully scored and standings are recalculated.','border-emerald-500/20 bg-emerald-500/5'],
            ].map(([icon, title, desc, style]) => (
              <div key={title} className={`rounded-xl border p-5 ${style}`}><span className="text-2xl">{icon}</span><h4 className="mt-3 font-bold text-white">{title}</h4><p className="mt-2 text-xs leading-5 text-slate-400">{desc}</p></div>
            ))}
          </div>
        </div>

        {/* 7. Auto-Bench Substitution */}
        <div className="mt-8 border-t border-violet-500/10 pt-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><span>🔄</span> Auto-Bench Substitution</h3>
          <p className="mb-4 text-sm text-slate-400">If a starter doesn&apos;t play in a gameweek, the system automatically finds a bench replacement — but with strict rules that affect how you should build your bench:</p>
          <div className="mb-5 space-y-3">
            <div className="flex gap-4 rounded-xl border border-slate-800 bg-slate-950/30 p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-black text-violet-300">1</span><div><p className="text-sm font-bold text-white">Role must match exactly</p><p className="mt-1 text-xs text-slate-400">A bench Carry will only substitute for a starter Carry. A bench Support will only sub for a starter Support. Cross-role substitutions are not permitted.</p></div></div>
            <div className="flex gap-4 rounded-xl border border-slate-800 bg-slate-950/30 p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-black text-violet-300">2</span><div><p className="text-sm font-bold text-white">Bench player must have played</p><p className="mt-1 text-xs text-slate-400">A bench player is only eligible to sub in if they actually played a match that gameweek. A bench player who also sat out cannot substitute.</p></div></div>
            <div className="flex gap-4 rounded-xl border border-slate-800 bg-slate-950/30 p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-black text-violet-300">3</span><div><p className="text-sm font-bold text-white">Each bench player can sub in once</p><p className="mt-1 text-xs text-slate-400">A single bench player cannot cover two absent starters. Once used as a substitute, that bench slot is exhausted for the gameweek.</p></div></div>
            <div className="flex gap-4 rounded-xl border border-slate-800 bg-slate-950/30 p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-black text-violet-300">4</span><div><p className="text-sm font-bold text-white">Bench order sets priority</p><p className="mt-1 text-xs text-slate-400">The system checks Bench 1, then Bench 2, then Bench 3, using the first unused player who matches the missing starter&apos;s role and played that gameweek.</p></div></div>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-300">💡 Strategy Tip</p>
            <p className="text-sm text-slate-300">Don&apos;t just pick any three players for your bench. Your bench should ideally cover the roles of your riskiest starters. If your Carry plays infrequently, keep a bench Carry who plays regularly — they&apos;ll step in automatically.</p>
          </div>
        </div>

        {/* 8. Lineup Validation Rules */}
        <div className="mt-8 border-t border-violet-500/10 pt-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><span>✅</span> Lineup Validation Rules</h3>
          <p className="mb-4 text-sm text-slate-400">The following rules are enforced every time you save a lineup. A lineup is rejected if any rule is violated:</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['👥','Five starters required','Fill one slot for each starting role: Carry, Mid, Offlane, Support, and Hard Support. Bench slots are optional.'],
              ['🏹','Captain + VC required','Select exactly one captain and one vice-captain from your starters. They must be different players.'],
              ['🛡️','Squad ownership','Every player in your lineup must belong to your active squad. Removed or sold players are blocked.'],
              ['❌','No duplicates','A player can only occupy one slot. The same player cannot appear in both a starter and a bench slot.'],
              ['⏰','Deadline lock','Once the gameweek deadline timestamp passes, the lineup is locked and no further changes can be saved.'],
              ['📄','One lineup per gameweek','Saving a lineup overwrites your previous one for that gameweek. Changes are reflected immediately until the deadline.'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-4"><span className="text-xl">{icon}</span><div><p className="text-sm font-bold text-white">{title}</p><p className="mt-1 text-xs text-slate-400">{desc}</p></div></div>
            ))}
          </div>
        </div>

        {/* 9. Triple Captain + VC Interaction */}
        <div className="mt-8 border-t border-violet-500/10 pt-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><span>👑</span> Triple Captain &amp; VC Interaction</h3>
          <p className="mb-4 text-sm text-slate-400">The Triple Captain chip has a subtle interaction with the vice-captain fallback that most players don&apos;t know about:</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p className="mb-2 text-xs font-bold text-emerald-300">Normal gameweek</p><p className="text-sm text-white font-bold mb-1">Captain plays</p><p className="text-xs text-slate-400">Captain gets <strong className="text-white">2×</strong>. VC gets <strong className="text-white">1×</strong>.</p></div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><p className="mb-2 text-xs font-bold text-amber-300">Triple Captain chip</p><p className="text-sm text-white font-bold mb-1">Captain plays</p><p className="text-xs text-slate-400">Captain gets <strong className="text-white">3×</strong>. VC gets <strong className="text-white">1×</strong>.</p></div>
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4"><p className="mb-2 text-xs font-bold text-violet-300">Triple Captain chip</p><p className="text-sm text-white font-bold mb-1">Captain didn&apos;t play</p><p className="text-xs text-slate-400">VC inherits the full chip — gets <strong className="text-white">3×</strong>, not just 2×.</p></div>
          </div>
          <p className="mt-3 text-xs text-slate-500">💡 This means your vice-captain choice matters even more when using the Triple Captain chip — pick a VC who is likely to play.</p>
        </div>

        {/* 10. Transfer Rules */}
        <div className="mt-8 border-t border-violet-500/10 pt-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><span>📦</span> How Transfers Work</h3>
          <p className="mb-4 text-sm text-slate-400">The transfer system enforces a set of rules at the database level via a stored procedure, not just the UI:</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['↔️','Equal in and out','Every transfer batch must have the same number of players coming in as going out. You cannot bring in 2 players and sell only 1 in one transaction.'],
              ['💸','Budget enforced at DB level','The budget check and squad duplicate prevention are enforced inside a Postgres stored procedure, not the frontend, so they cannot be bypassed.'],
              ['📝','Full audit trail','Every transfer is logged with a timestamp, the players swapped, and your budget before and after. The system keeps a complete history.'],
              ['🔒','Exact role matching','The transfer database check requires the incoming player to have the exact same role as the outgoing player. Support and Hard Support are not interchangeable for a transfer, even if the market UI lets you select both.'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-4"><span className="text-xl">{icon}</span><div><p className="text-sm font-bold text-white">{title}</p><p className="mt-1 text-xs text-slate-400">{desc}</p></div></div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex items-center gap-3"><Shield className="h-5 w-5 text-emerald-300" /><p className="text-sm text-slate-300">Need a guided walkthrough of the app?</p></div><Link href="/guide" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">Launch Manager Guide <ArrowRight className="h-4 w-4" /></Link></div>
    </div>
  );
}
