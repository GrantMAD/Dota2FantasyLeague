import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarClock, Cpu, Crown, Gauge, LineChart, ScrollText, Shield, Sparkles, Users } from 'lucide-react';

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
  ['Death', '-1.0', 'Combat'],
  ['KDA bonus (KDA ≥5.0)', '+2.0', 'Combat'],
  ['KDA bonus (KDA ≥3.0)', '+1.0', 'Combat'],
  ['GPM (role-adjusted)', 'Up to +5.0', 'Economy'],
  ['XPM (role-adjusted)', 'Up to +4.0', 'Economy'],
  ['Last Hits (role-adjusted)', 'Up to +2.0', 'Economy'],
  ['Denies', '+0.1 each', 'Economy'],
  ['Hero Damage (role-adj.)', 'Up to +4.0', 'Objective'],
  ['Tower Damage (role-adj.)', 'Up to +2.0', 'Objective'],
  ['Healing (role-adj.)', 'Up to +3.0', 'Objective'],
  ['Wards Placed', '+0.5 each', 'Objective'],
  ['Wards Destroyed', '+0.3 each', 'Objective'],
  ['Roshan Kill', '+2.0 each', 'Objective'],
  ['Game win', '+5.0', 'Match result'],
  ['Series win bonus', '+3.0', 'Match result'],
  ['Performance (top 10%)', '+5.0', 'Role execution'],
  ['Performance (top 20%)', '+3.0', 'Role execution'],
  ['Performance (top 30%)', '+1.0', 'Role execution'],
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
        <div className="mt-6 flex flex-wrap gap-2 mb-4">{['Carry','Mid','Offlane','Support','Hard Support'].map((role) => (<span key={role} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">{role}</span>))}</div><p className="text-sm leading-7 text-slate-300">Your starting lineup must include exactly one player in each of the five roles above. Your three bench players can automatically substitute for absent starters — but only if the bench player shares the <strong className="text-white">exact same role</strong> as the missing starter. You may not own the same player in two squad slots, and a maximum of <strong className="text-white">3 players</strong> from the same professional team are allowed in your squad at any time.</p>
      </section>

      <section id="captain" className="mt-6 scroll-mt-24 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6 sm:p-8"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300"><Crown className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Leadership</p><h2 className="mt-1 text-2xl font-bold text-white">Captain & vice-captain</h2><p className="mt-3 text-sm leading-7 text-slate-300">Select one captain and one vice-captain from your active squad before the gameweek deadline.</p><ul className="mt-3 space-y-2 text-sm text-slate-300"><li className="flex items-start gap-2"><span className="text-emerald-300 mt-0.5">→</span><span>Your <strong className="text-white">captain</strong> earns <strong className="text-white">2.0×</strong> fantasy points for that gameweek.</span></li><li className="flex items-start gap-2"><span className="text-emerald-300 mt-0.5">→</span><span>If the captain scores 0 points (didn&apos;t play any match that gameweek), the <strong className="text-white">vice-captain</strong> automatically receives the 2.0× multiplier instead.</span></li><li className="flex items-start gap-2"><span className="text-emerald-300 mt-0.5">→</span><span>You can change your captain and vice-captain at any time <strong className="text-white">up until the gameweek deadline</strong>.</span></li></ul></div></div></section>

      <section id="scoring" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8"><div className="mb-6 flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300"><Gauge className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Points engine</p><h2 className="mt-1 text-2xl font-bold text-white">Fantasy scoring</h2></div></div><div className="overflow-x-auto"><table className="w-full min-w-130 text-left text-sm"><thead><tr className="border-b border-slate-700 text-xs uppercase tracking-[0.16em] text-slate-500"><th className="px-3 py-3">Event</th><th className="px-3 py-3">Points</th><th className="px-3 py-3">Category</th></tr></thead><tbody>{scoringRows.map(([event, points, category]) => <tr key={event} className="border-b border-slate-800 last:border-0"><td className="px-3 py-3 font-medium text-white">{event}</td><td className={`px-3 py-3 font-bold ${points.startsWith('-') ? 'text-red-300' : 'text-emerald-300'}`}>{points}</td><td className="px-3 py-3 text-slate-400">{category}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-slate-500">⚙️ Economy and Objective scores are role-adjusted — a Hard Support scoring 300 GPM is rewarded differently to a Carry with the same stat. Full role benchmarks and score category breakdowns are in the <a href="#hood" className="text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline">Under the Hood</a> section.</p></section>

      <section id="chips" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8"><div className="mb-6 flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300"><Sparkles className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Seasonal powers</p><h2 className="mt-1 text-2xl font-bold text-white">Special chips</h2></div></div><div className="grid gap-4 md:grid-cols-3">{chips.map((chip) => <div key={chip.name} className="rounded-xl border border-slate-800 bg-slate-950/50 p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-bold text-white">{chip.name}</h3><span className="whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-300">{chip.badge}</span></div><p className="mt-4 text-sm leading-6 text-slate-400">{chip.description}</p></div>)}</div><div className="mt-5 rounded-xl border border-amber-500/15 bg-slate-950/40 p-4"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-300">Chip Rules</p><ul className="space-y-1.5 text-xs text-slate-400"><li className="flex items-start gap-2"><span className="text-amber-300 shrink-0">•</span><span>Each chip can only be used <strong className="text-white">once per season</strong> — once activated it cannot be reused.</span></li><li className="flex items-start gap-2"><span className="text-amber-300 shrink-0">•</span><span>Only <strong className="text-white">one chip</strong> can be active per gameweek — chips cannot be stacked or combined.</span></li><li className="flex items-start gap-2"><span className="text-amber-300 shrink-0">•</span><span>Chips must be activated <strong className="text-white">before the gameweek deadline</strong> — you cannot apply a chip retroactively.</span></li><li className="flex items-start gap-2"><span className="text-amber-300 shrink-0">•</span><span>The Wildcard removes transfer <strong className="text-white">penalty points</strong> only — role-for-role rules still apply to all transfers made with it.</span></li></ul></div></section>

      <div className="mt-6 grid gap-6 md:grid-cols-2"><section id="transfers" className="scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/70 p-6"><div className="flex items-center gap-3"><LineChart className="h-5 w-5 text-cyan-300" /><h2 className="text-xl font-bold text-white">Transfers & prices</h2></div><p className="mt-4 text-sm leading-7 text-slate-300">You receive <strong className="text-white">one free transfer</strong> per gameweek. Unused transfers roll over but you can bank a <strong className="text-white">maximum of 2</strong> at once. Each extra transfer beyond your free allowance costs a <strong className="text-white">4-point penalty</strong>. All transfers are <strong className="text-white">role-for-role</strong> — you can only swap a player for someone in the same position. Activating the <strong className="text-white">Wildcard chip</strong> removes all penalties for that gameweek. Prices update automatically every 10 minutes based on performance and ownership.</p><Link href="/transfers" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">Open Transfer Market <ArrowRight className="h-4 w-4" /></Link></section><section id="deadlines" className="scroll-mt-24 rounded-2xl border border-red-500/25 bg-red-500/5 p-6"><div className="flex items-center gap-3"><CalendarClock className="h-5 w-5 text-red-300" /><h2 className="text-xl font-bold text-white">Deadlines & locks</h2></div><p className="mt-4 text-sm leading-7 text-slate-300">Each gameweek has a set <strong className="text-white">deadline timestamp</strong>. Once that time passes, all transfers and lineup changes are locked for the rest of the gameweek. Any unsaved lineup changes are <strong className="text-white">discarded</strong> — always save your lineup before the deadline. The exact deadline for each gameweek is visible on the Gameweeks page.</p><Link href="/gameweeks" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-red-300 hover:text-red-200">Check gameweek deadlines <ArrowRight className="h-4 w-4" /></Link></section></div>

      {/* Under the Hood */}
      <section id="hood" className="mt-6 scroll-mt-24 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6 sm:p-8">
        <div className="mb-8 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300"><Cpu className="h-5 w-5" /></div>
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Technical systems</p><h2 className="mt-1 text-2xl font-bold text-white">Under the Hood</h2><p className="mt-2 text-sm leading-6 text-slate-400">How the engine that powers your fantasy league actually works — from live match data ingestion all the way to your final score.</p></div>
        </div>

        {/* 1. Points Engine */}
        <div className="mb-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><span>🧮</span> Points Engine</h3>
          <p className="mb-4 text-sm text-slate-400">Every player&apos;s performance is broken into 13 tracked stats, then grouped into 8 score categories:</p>
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {[['Kills','Combat contribution'],['Deaths','Penalty'],['Assists','Supporting kills'],['GPM','Gold efficiency'],['XPM','Level efficiency'],['Last Hits','Creep farm'],['Denies','Enemy XP denied'],['Hero Damage','Damage to heroes'],['Tower Damage','Objective push'],['Healing','Support output'],['Wards Placed','Vision'],['Wards Destroyed','Counter-vision'],['Roshan Kills','Major objective']].map(([stat, desc]) => (
              <div key={stat} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"><p className="text-xs font-bold text-white">{stat}</p><p className="text-[11px] text-slate-500">{desc}</p></div>
            ))}
          </div>
          <p className="mb-3 text-sm text-slate-400">The 8 score categories those stats feed into:</p>
          <div className="mb-5 space-y-2">
            {[
              ['Combat','text-red-300','Kills ×1.5 + Assists ×0.75 − Deaths ×1.0. KDA efficiency bonus: ≥5.0 = +2 pts, ≥3.0 = +1 pt.'],
              ['Economy','text-amber-300','GPM & XPM normalized against role benchmarks. Carry expects 550 GPM; Hard Support only 200 GPM — so every role is rewarded fairly.'],
              ['Objective','text-cyan-300','Hero damage, tower damage, healing, wards placed/destroyed, and Roshan kills.'],
              ['Teamfight','text-purple-300','Derived from combined combat and objective contribution in team fights.'],
              ['Win','text-emerald-300','Flat +5.0 pts awarded for winning the match.'],
              ['Series','text-emerald-300','+3.0 pts bonus for winning the overall series (Bo3 or Bo5).'],
              ['Performance','text-violet-300','Percentile bonus within the gameweek: top 10% = +5 pts, top 20% = +3 pts, top 30% = +1 pt.'],
              ['Consistency','text-violet-300','Sustained high form across multiple games in the same gameweek.'],
            ].map(([cat, colour, desc]) => (
              <div key={cat} className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/30 p-3"><span className={`mt-0.5 w-24 shrink-0 text-xs font-bold ${colour}`}>{cat}</span><span className="text-xs text-slate-400">{desc}</span></div>
            ))}
          </div>
          <p className="mb-3 text-sm text-slate-400">Economy scoring uses role-adjusted GPM/XPM benchmarks so every position is rewarded fairly:</p>
          <div className="mb-5 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-700 text-xs uppercase tracking-widest text-slate-500"><th className="px-4 py-3">Role</th><th className="px-4 py-3">Expected GPM</th><th className="px-4 py-3">Expected XPM</th></tr></thead><tbody>{[['Carry','550','600'],['Mid','450','550'],['Offlane','350','450'],['Support','250','350'],['Hard Support','200','300']].map(([role, gpm, xpm]) => (<tr key={role} className="border-b border-slate-800 last:border-0"><td className="px-4 py-3 font-medium text-white">{role}</td><td className="px-4 py-3 text-amber-300">{gpm}</td><td className="px-4 py-3 text-cyan-300">{xpm}</td></tr>))}</tbody></table>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-300">Captain Multiplier — Applied Last</p><p className="text-sm text-slate-300">After all categories are summed, the captain&apos;s total is multiplied by <strong className="text-white">2×</strong> (or <strong className="text-white">3×</strong> with the Triple Captain chip). If the captain didn&apos;t play, the Vice-Captain automatically receives the multiplier.</p></div>
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
              ['⑤','Calculate Scores','All 8 score categories are computed per player per match.','At :50 past the hr'],
              ['⑥','Recalculate Standings','Gameweek totals, captain multipliers, and leaderboards updated.','At :55 past the hr'],
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
          <p className="mb-4 text-sm text-slate-400">A scheduler fires every hour on the server. Depending on the UTC time, specific background jobs are triggered:</p>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-700 text-xs uppercase tracking-widest text-slate-500"><th className="px-4 py-3">Job</th><th className="px-4 py-3">What It Does</th><th className="px-4 py-3">Frequency</th></tr></thead><tbody>{[['Roster Changes','Detects overnight player team transfers','Daily — 2 AM UTC'],['Player Sync','Refreshes the pro player database','Daily — 3 AM UTC'],['Team Sync','Refreshes pro team rosters','Daily — 3:15 AM UTC'],['Tournament Discovery','Finds and registers new active tournaments','Every 6 hours'],['Match Fetch','Pulls new scheduled and live matches','Every hour'],['Match Details','Ingests per-player stats for each match','Every 30 min'],['Process Completed','Locks finished matches ready for scoring','Every 45 min'],['Score Calculation','Calculates all 8 fantasy score categories','At :50 past the hour'],['Gameweek Recalculation','Updates totals, ranks and leagues','At :55 past the hour'],['Price Updates','Recalculates all player prices','Every 10 min']].map(([job, desc, freq]) => (<tr key={job} className="border-b border-slate-800 last:border-0"><td className="px-4 py-3 font-medium text-white whitespace-nowrap">{job}</td><td className="px-4 py-3 text-xs text-slate-400">{desc}</td><td className="px-4 py-3 text-xs text-violet-300 whitespace-nowrap">{freq}</td></tr>))}</tbody></table>
          </div>
          <p className="mt-3 text-xs text-slate-500">💡 Scores are calculated at :50, standings updated at :55 — your total reflects the latest data within ~10 minutes of a match ending.</p>
        </div>

        {/* 4. Dynamic Pricing Formula */}
        <div className="mb-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><span>💰</span> Dynamic Pricing Formula</h3>
          <p className="mb-4 text-sm text-slate-400">Player prices are not fixed — they move automatically every 10 minutes based on two signals:</p>
          <div className="mb-5 rounded-xl border border-slate-700 bg-slate-950/60 p-4 font-mono text-sm">
            <p className="text-slate-300">Price Movement = <span className="text-amber-300">(Form Δ × 0.1)</span> + <span className="text-cyan-300">(Ownership × 0.5)</span></p>
            <p className="mt-1 text-slate-300">New Price &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= Current Price + Movement <span className="text-slate-500">(capped ±$0.5M)</span></p>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {[
              ['Recent Form Δ','text-amber-300',"How a player's latest scores compare to their season average. A great game pushes this positive; a poor game negative."],
              ['Ownership %','text-cyan-300','The share of all active squads that own this player. High demand pushes prices up; low demand brings them down.'],
              ['±$0.5M Cap','text-slate-300','Prevents a single exceptional or terrible result from causing an unrealistic price swing in one cycle.'],
            ].map(([title, colour, desc]) => (
              <div key={title} className="rounded-xl border border-slate-800 bg-slate-950/30 p-4"><p className={`mb-2 text-xs font-bold ${colour}`}>{title}</p><p className="text-xs text-slate-400">{desc}</p></div>
            ))}
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-300">Worked Example</p>
            <p className="text-sm text-slate-300">Carry player — current price <strong className="text-white">$9.5M</strong>. Had a great game (Form Δ = <span className="text-emerald-300">+4</span>), owned by 60% of squads (factor = 0.6).</p>
            <p className="mt-2 font-mono text-sm text-slate-300">Movement = (4 × 0.1) + (0.6 × 0.5) = 0.4 + 0.3 = <span className="text-emerald-300">+$0.7M</span> → capped to <span className="text-emerald-300">+$0.5M</span></p>
            <p className="mt-1 font-mono text-sm font-bold text-white">New price: $10.0M</p>
          </div>
        </div>

        {/* 5. Rankings & Standings */}
        <div className="mb-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><span>🏆</span> Rankings &amp; Standings</h3>
          <p className="mb-4 text-sm text-slate-400">After each gameweek is scored, standings are recalculated in five steps:</p>
          <div className="space-y-3">
            {[
              ['1','Lineup Total',"All 5 starters' points are summed. The captain's score is multiplied (2× or 3× with Triple Captain chip active). If Bench Boost is active, all 3 bench players' points are included too."],
              ['2','VC Fallback',"If the captain scored 0 points (didn't play), the vice-captain automatically receives the 2× multiplier instead."],
              ['3','Season Total','Each gameweek total is accumulated into the running season total stored per fantasy team.'],
              ['4','Global Rank','All fantasy teams are ranked by season total descending and assigned a global rank. Updated every ~10 minutes.'],
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
              ['👥','8 players required','Exactly 5 starters and 3 bench players must be set. Partial lineups are rejected.'],
              ['🏹','Captain + VC required','Exactly one captain and one vice-captain must be selected. You cannot save with neither or both assigned to the same player.'],
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
              ['🔒','Role-for-role enforcement','The UI enforces that you swap a player out for one of the same role. This prevents illegal squad compositions from being created via transfers.'],
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
