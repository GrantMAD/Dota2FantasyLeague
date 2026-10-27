import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Cpu,
  Crown,
  Gauge,
  LineChart,
  ScrollText,
  Shield,
  Sparkles,
  Users
} from 'lucide-react';
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
  ['Kill', '+1.5', 'Combat', 'Positive combat impact'],
  ['Assist', '+0.75', 'Combat', 'Teamfight contribution'],
  ['Death', '-1.0 each', 'Penalty', 'Deduction for dying'],
  ['KDA bonus (KDA ≥5.0)', '+2.0', 'Combat', 'High efficiency reward'],
  ['KDA bonus (KDA ≥3.0)', '+1.0', 'Combat', 'Solid efficiency reward'],
  ['GPM (role-adjusted)', 'Up to +7.5', 'Economy', 'Role benchmarked gold farm'],
  ['XPM (role-adjusted)', 'Up to +6.0', 'Economy', 'Role benchmarked experience'],
  ['Last Hits (role-adjusted)', 'Up to +2.6', 'Economy', 'Lane and jungle farming'],
  ['Denies', '+0.1 each', 'Economy', 'XP denial to opponents'],
  ['Hero Damage (role-adj.)', 'Up to +6.0', 'Objective', 'Damage dealt to enemy heroes'],
  ['Tower Damage (role-adj.)', 'Up to +3.0', 'Objective', 'Building siege damage'],
  ['Healing (role-adj.)', 'Up to +4.5', 'Objective', 'Sustain provided to team'],
  ['Wards Placed', '+0.5 each', 'Objective', 'Observer & Sentry vision'],
  ['Wards Destroyed', '+0.3 each', 'Objective', 'Counter-ward dewarding'],
  ['Roshan Kill', '+2.0 each', 'Objective', 'Securing Aegis of the Immortal'],
  ['Teamfight proxy', 'Formula proxy', 'Teamfight', 'Damage ×0.0004 + healing ×0.0015 + tower ×0.0008'],
  ['Game win', '+5.0', 'Match result', 'Flat bonus for map victory'],
  ['Series win', '+3.0', 'Series', 'Awarded on clinching series game'],
  ['Performance index (≥90)', '+5.0', 'Role execution', 'Tier 1 performance mastery'],
  ['Performance index (≥80)', '+3.0', 'Role execution', 'Tier 2 performance excellence'],
  ['Performance index (≥70)', '+1.0', 'Role execution', 'Tier 3 performance consistency'],
  ['Consistency bonus', '+1.0', 'Consistency', '3 consecutive matches with index ≥80'],
];

const chips = [
  { name: 'Wildcard', badge: '1 per season', description: 'Make unlimited free transfers for one gameweek without taking extra transfer penalties.' },
  { name: 'Triple Captain', badge: '1 per season', description: 'Your selected captain earns 3.0x points instead of the normal 2.0x multiplier.' },
  { name: 'Bench Boost', badge: '1 per season', description: 'All three bench players contribute their points to your gameweek total.' },
];

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8 sm:px-6 lg:px-8">
      {/* Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        <Link href="/learn" className="inline-flex items-center gap-1.5 text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Learn Hub
        </Link>
        <span>/</span>
        <span className="text-[var(--text-primary)]">Rules & Scoring</span>
      </div>

      {/* Hero Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-10 shadow-2xl">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-400 to-cyan-400" />

        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-300">
            <ScrollText className="h-3.5 w-3.5" /> Official rulebook
          </div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] sm:text-5xl tracking-tight">
            Game rules & scoring
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
            Everything you need to build a legal squad, score points, manage chips, and stay ahead of every gameweek deadline.
          </p>
          <div className="mt-7 flex flex-wrap gap-3.5">
            <Link
              href="/lineups"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 shadow-md shadow-amber-500/20"
            >
              Set a lineup <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/learn"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-slate-500 shadow-sm"
            >
              Back to Learn Hub
            </Link>
          </div>
        </div>
      </section>

      {/* Modern Rounded Pill Sticky Navigation */}
      <nav
        className="rules-nav sticky top-3 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-2 shadow-xl backdrop-blur-md"
        aria-label="Rules sections"
      >
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rules-nav-link inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold text-[var(--text-secondary)] transition-all hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            >
              <Icon className="rules-nav-icon h-3.5 w-3.5 text-amber-500" />
              {section.label}
            </a>
          );
        })}
      </nav>

      {/* SECTION 1: SQUAD STRUCTURE */}
      <section id="squad" className="scroll-mt-24 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-sm">
        <div className="mb-6 flex items-start gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">Foundation</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">Squad structure</h2>
          </div>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4.5">
            <p className="text-xs font-medium text-[var(--text-muted)]">Budget</p>
            <p className="mt-1.5 text-2xl font-black text-amber-600 dark:text-amber-400">$45.0M</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4.5">
            <p className="text-xs font-medium text-[var(--text-muted)]">Squad size</p>
            <p className="mt-1.5 text-2xl font-black text-[var(--text-primary)]">8 players</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4.5">
            <p className="text-xs font-medium text-[var(--text-muted)]">Starting lineup</p>
            <p className="mt-1.5 text-2xl font-black text-[var(--text-primary)]">5 roles</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4.5">
            <p className="text-xs font-medium text-[var(--text-muted)]">Bench</p>
            <p className="mt-1.5 text-2xl font-black text-[var(--text-primary)]">3 players</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 mb-4">
          {['Carry', 'Mid', 'Offlane', 'Support', 'Hard Support'].map((role) => (
            <span
              key={role}
              className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-300"
            >
              {role}
            </span>
          ))}
        </div>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Your lineup must fill one starting slot for each of the five roles above. A squad can have up to{' '}
          <strong className="text-[var(--text-primary)]">3 optional bench players</strong>; you do not need to fill the bench to save a lineup. Bench players can automatically substitute for absent starters only if they played that gameweek and share the{' '}
          <strong className="text-[var(--text-primary)]">exact same role</strong> as the missing starter. You may not own the same player in two squad slots, and a maximum of{' '}
          <strong className="text-[var(--text-primary)]">3 players</strong> from the same professional team are allowed in your squad at any time.
        </p>
      </section>

      {/* SECTION 2: CAPTAIN & VC */}
      <section id="captain" className="scroll-mt-24 rounded-3xl border border-emerald-500/25 bg-emerald-500/5 p-6 sm:p-8 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Leadership</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">Captain & vice-captain</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              Choose one captain and one vice-captain from your five selected starters before the gameweek deadline. They must be different players.
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-[var(--text-secondary)]">
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-500 mt-0.5 font-bold">→</span>
                <span>Your <strong className="text-[var(--text-primary)]">captain</strong> earns <strong className="text-emerald-600 dark:text-emerald-400 font-bold">2.0×</strong> fantasy points for that gameweek.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-500 mt-0.5 font-bold">→</span>
                <span>If the captain has no recorded match participation that gameweek, the <strong className="text-[var(--text-primary)]">vice-captain</strong> automatically receives the captain multiplier instead.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-500 mt-0.5 font-bold">→</span>
                <span>You can change your captain and vice-captain at any time <strong className="text-[var(--text-primary)]">up until the gameweek deadline</strong>.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* SECTION 3: FANTASY SCORING WITH POINT CALCULATION CHIPS */}
      <section id="scoring" className="scroll-mt-24 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-sm">
        <div className="mb-6 flex items-start gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">Points engine</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">Fantasy scoring breakdown</h2>
          </div>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-[var(--text-secondary)]">
          The values below describe the current default scoring engine. Published scoring rules for your season take precedence and may change configurable point values. Role-adjusted categories are capped at the amounts shown.
        </p>

        {/* Visual Scoring Chips Table */}
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full min-w-140 text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)] text-xs uppercase tracking-wider text-[var(--text-muted)]">
                <th className="px-4 py-3.5 font-bold">Event & Metric</th>
                <th className="px-4 py-3.5 font-bold">Point Value</th>
                <th className="px-4 py-3.5 font-bold">Category</th>
                <th className="px-4 py-3.5 font-bold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {scoringRows.map(([event, points, category, desc]) => {
                const isPenalty = points.startsWith('-');
                return (
                  <tr key={event} className="transition-colors hover:bg-[var(--surface-raised)]/60">
                    <td className="px-4 py-3.5 font-bold text-[var(--text-primary)]">{event}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-black shadow-xs ${
                          isPenalty
                            ? 'border border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300'
                            : 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {points}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                        {category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--text-secondary)]">{desc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-5 text-xs leading-relaxed text-[var(--text-muted)]">
          ⚙️ Economy and Objective scores are role-adjusted — a Hard Support scoring 300 GPM is rewarded differently to a Carry with the same stat. Performance bonuses use the calculated performance index, not a ranking percentile. See the{' '}
          <a href="#hood" className="font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300 underline-offset-2 hover:underline">
            Under the Hood
          </a>{' '}
          section for role benchmarks and scoring details.
        </p>
      </section>

      {/* SECTION 4: CHIPS */}
      <section id="chips" className="scroll-mt-24 rounded-3xl border border-violet-500/25 bg-violet-500/5 p-6 sm:p-8 shadow-xs">
        <div className="mb-6 flex items-start gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-700 dark:text-violet-400">Tactical Advantage</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">Seasonal Chips & Boosters</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Each manager is allocated powerful single-use chips per season. Only one chip can be active in any given gameweek.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {chips.map((chip) => (
            <div key={chip.name} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base text-[var(--text-primary)]">{chip.name}</h3>
                <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 dark:text-violet-300">
                  {chip.badge}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{chip.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 5: TRANSFERS */}
      <section id="transfers" className="scroll-mt-24 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-xs">
        <div className="mb-6 flex items-start gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <LineChart className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">Market Dynamics</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">Transfers & Free Allowances</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Trade pro players to capitalise on matchups, form, and shifting market valuations.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4.5">
            <p className="text-xs font-semibold text-[var(--text-muted)]">Weekly Free Transfer</p>
            <p className="mt-1 text-xl font-black text-amber-600 dark:text-amber-400">1 per gameweek</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Rolls over up to a max bank of 2 free transfers.</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4.5">
            <p className="text-xs font-semibold text-[var(--text-muted)]">Additional Transfer Cost</p>
            <p className="mt-1 text-xl font-black text-rose-600 dark:text-rose-400">-4 pts penalty</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Deducted from your gameweek fantasy score.</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-4.5">
            <p className="text-xs font-semibold text-[var(--text-muted)]">Max Pro Club Quota</p>
            <p className="mt-1 text-xl font-black text-[var(--text-primary)]">3 players</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Maximum athletes permitted from any single pro team.</p>
          </div>
        </div>
      </section>

      {/* SECTION 6: DEADLINES */}
      <section id="deadlines" className="scroll-mt-24 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-xs">
        <div className="mb-6 flex items-start gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-400">Schedule & Timing</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">Lock Deadlines & Match Windows</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              All transfers, captaincy picks, and seasonal chips lock strictly at the calculated gameweek deadline timestamp.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 text-sm text-[var(--text-secondary)] leading-relaxed space-y-2">
          <p>
            ⏱️ <strong>Lock Timing:</strong> Exactly 30 minutes before the scheduled start time of the first fixture in the gameweek.
          </p>
          <p>
            🔒 <strong>Server-Enforced Truth:</strong> Deadlines are verified and enforced in backend database transactions; changes attempted after the timestamp are rejected.
          </p>
        </div>
      </section>

      {/* Under the Hood Section */}
      <section id="hood" className="scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs backdrop-blur-xs">
        <div className="mb-8 border-b border-[var(--border)] pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" /> Technical Reference
          </div>
          <h2 className="mt-3 text-2xl font-black text-[var(--text-primary)]">Under the Hood: System Mechanics & Engine Details</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Detailed technical inner workings of how the backend scores matches, recalculates dynamic player prices, runs automated background jobs, and handles edge cases.
          </p>
        </div>

        {/* Automated Job Schedule */}
        <div className="mb-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"><span>⏱️</span> Automated Job Schedule</h3>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">Background jobs run on configured recurring schedules. Processing and data availability can affect when updated scores and standings appear:</p>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)] text-xs uppercase tracking-widest text-[var(--text-muted)]">
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">What It Does</th>
                  <th className="px-4 py-3">Frequency</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Roster Changes','Detects overnight player team transfers','Daily — 2 AM UTC'],
                  ['Player Sync','Refreshes the pro player database','Daily — 3 AM UTC'],
                  ['Team Sync','Refreshes pro team rosters','Daily — 3:15 AM UTC'],
                  ['Tournament Discovery','Finds and registers new active tournaments','Every 6 hours'],
                  ['Match Fetch','Pulls new scheduled and live matches','Every hour'],
                  ['Match Details','Ingests per-player stats for each match','Every 30 min'],
                  ['Process Completed','Locks finished matches ready for scoring','Every 45 min'],
                  ['Score Calculation','Calculates fantasy score breakdowns','Recurring schedule'],
                  ['Gameweek Recalculation','Updates gameweek totals and standings','Recurring schedule'],
                  ['Price Updates','Recalculates all player prices','Every 10 min']
                ].map(([job, desc, freq]) => (
                  <tr key={job} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-raised)]/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)] whitespace-nowrap">{job}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{desc}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-violet-600 dark:text-violet-300 whitespace-nowrap">{freq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">💡 Score calculation triggers a gameweek recalculation after processing. Final updates depend on match data arriving and the scheduled jobs completing.</p>
        </div>

        {/* Dynamic Pricing Formula */}
        <div className="mb-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"><span>💰</span> Dynamic Pricing Formula</h3>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">After a gameweek closes, player prices are calculated from fantasy points and squad ownership. The job may run every 10 minutes, but it recalculates the same gameweek from its original price rather than stacking another change on each run:</p>
          <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 font-mono text-sm">
            <p className="text-[var(--text-primary)]">Price Movement = <span className="font-semibold text-amber-600 dark:text-amber-300">(Gameweek Fantasy Points × 0.02)</span> + <span className="font-semibold text-cyan-600 dark:text-cyan-300">(Ownership × 0.10)</span></p>
            <p className="mt-1 text-[var(--text-primary)]">New Price &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= Gameweek Base Price + Movement <span className="text-[var(--text-muted)]">(capped ±$0.5M)</span></p>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {[
              ['Gameweek Fantasy Points','text-amber-600 dark:text-amber-300','The player’s summed fantasy points from the latest closed gameweek. Every point changes the price signal by $0.02M; negative points can pull the price down.'],
              ['Ownership %','text-cyan-600 dark:text-cyan-300','The share of active squads that own this player. Ownership adds a smaller upward signal, up to $0.10M when every squad owns the player.'],
              ['±$0.5M Cap','text-slate-600 dark:text-slate-300','Limits the total price movement to $0.50M for a gameweek, regardless of how many times the scheduled job reruns.'],
            ].map(([title, colour, desc]) => (
              <div key={title} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/60 p-4">
                <p className={`mb-2 text-xs font-bold ${colour}`}>{title}</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Worked Example</p>
            <p className="text-sm text-[var(--text-primary)]">Carry player — gameweek base price <strong className="font-bold text-[var(--text-primary)]">$9.5M</strong>, scores <span className="font-semibold text-emerald-600 dark:text-emerald-300">20 fantasy points</span>, and is owned by 60% of squads.</p>
            <p className="mt-2 font-mono text-sm text-[var(--text-secondary)]">Movement = (20 × 0.02) + (0.6 × 0.10) = 0.40 + 0.06 = <span className="font-bold text-emerald-600 dark:text-emerald-300">+$0.46M</span></p>
            <p className="mt-1 font-mono text-sm font-bold text-[var(--text-primary)]">New price: $9.96M</p>
          </div>
        </div>

        {/* Rankings & Standings */}
        <div className="mb-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"><span>🏆</span> Rankings &amp; Standings</h3>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">After each gameweek is scored, standings are recalculated in five steps:</p>
          <div className="space-y-3">
            {[
              ['1','Lineup Total',"Selected starters' points are summed. The captain's score is multiplied (2× or 3× with Triple Captain active). If Bench Boost is active, selected bench players also contribute."],
              ['2','VC Fallback',"If the captain has no recorded match participation, the vice-captain automatically receives the captain multiplier instead."],
              ['3','Season Total','Each gameweek total is accumulated into the running season total stored per fantasy team.'],
              ['4','Global Rank','Fantasy teams are ranked by season total. Rankings refresh on a separate scheduled job and may lag behind new scores.'],
              ['5','League Rank','The same calculation is applied within each private or public league you have joined.'],
            ].map(([num, title, desc]) => (
              <div key={num} className="flex gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/60 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-black text-violet-700 dark:text-violet-300">{num}</span>
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Automated Notifications */}
        <div>
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"><span>🔔</span> Automated Notifications</h3>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">Three types of notification are sent automatically based on system events:</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['⏰','Deadline Alert','Sent 30 minutes before a gameweek locks. Reminds you to finalise your lineup and captain before transfers close.','border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300'],
              ['💰','Price Change','Triggered when a player in your squad experiences a significant price movement up or down.','border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'],
              ['📈','Rank Change','Sent when your global or league rank changes after a gameweek is fully scored and standings are recalculated.','border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'],
            ].map(([icon, title, desc, style]) => (
              <div key={title} className={`rounded-xl border p-5 ${style}`}>
                <span className="text-2xl">{icon}</span>
                <h4 className="mt-3 font-bold text-[var(--text-primary)]">{title}</h4>
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Auto-Bench Substitution */}
        <div className="mt-8 border-t border-[var(--border)] pt-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"><span>🔄</span> Auto-Bench Substitution</h3>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">If a starter doesn&apos;t play in a gameweek, the system automatically finds a bench replacement — but with strict rules that affect how you should build your bench:</p>
          <div className="mb-5 space-y-3">
            <div className="flex gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/60 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-black text-violet-700 dark:text-violet-300">1</span>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Role must match exactly</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">A bench Carry will only substitute for a starter Carry. A bench Support will only sub for a starter Support. Cross-role substitutions are not permitted.</p>
              </div>
            </div>
            <div className="flex gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/60 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-black text-violet-700 dark:text-violet-300">2</span>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Bench player must have played</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">A bench player is only eligible to sub in if they actually played a match that gameweek. A bench player who also sat out cannot substitute.</p>
              </div>
            </div>
            <div className="flex gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/60 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-black text-violet-700 dark:text-violet-300">3</span>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Each bench player can sub in once</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">A single bench player cannot cover two absent starters. Once used as a substitute, that bench slot is exhausted for the gameweek.</p>
              </div>
            </div>
            <div className="flex gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/60 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-black text-violet-700 dark:text-violet-300">4</span>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Bench order sets priority</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">The system checks Bench 1, then Bench 2, then Bench 3, using the first unused player who matches the missing starter&apos;s role and played that gameweek.</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">💡 Strategy Tip</p>
            <p className="text-sm text-[var(--text-secondary)]">Don&apos;t just pick any three players for your bench. Your bench should ideally cover the roles of your riskiest starters. If your Carry plays infrequently, keep a bench Carry who plays regularly — they&apos;ll step in automatically.</p>
          </div>
        </div>

        {/* Lineup Validation Rules */}
        <div className="mt-8 border-t border-[var(--border)] pt-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"><span>✅</span> Lineup Validation Rules</h3>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">The following rules are enforced every time you save a lineup. A lineup is rejected if any rule is violated:</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['👥','Five starters required','Fill one slot for each starting role: Carry, Mid, Offlane, Support, and Hard Support. Bench slots are optional.'],
              ['🏹','Captain + VC required','Select exactly one captain and one vice-captain from your starters. They must be different players.'],
              ['🛡️','Squad ownership','Every player in your lineup must belong to your active squad. Removed or sold players are blocked.'],
              ['❌','No duplicates','A player can only occupy one slot. The same player cannot appear in both a starter and a bench slot.'],
              ['⏰','Deadline lock','Once the gameweek deadline timestamp passes, the lineup is locked and no further changes can be saved.'],
              ['📄','One lineup per gameweek','Saving a lineup overwrites your previous one for that gameweek. Changes are reflected immediately until the deadline.'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/60 p-4">
                <span className="text-xl">{icon}</span>
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Triple Captain + VC Interaction */}
        <div className="mt-8 border-t border-[var(--border)] pt-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"><span>👑</span> Triple Captain &amp; VC Interaction</h3>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">The Triple Captain chip has a subtle interaction with the vice-captain fallback that most players don&apos;t know about:</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
              <p className="mb-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">Normal gameweek</p>
              <p className="text-sm text-[var(--text-primary)] font-bold mb-1">Captain plays</p>
              <p className="text-xs text-[var(--text-secondary)]">Captain gets <strong className="text-[var(--text-primary)]">2×</strong>. VC gets <strong className="text-[var(--text-primary)]">1×</strong>.</p>
            </div>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
              <p className="mb-2 text-xs font-bold text-amber-700 dark:text-amber-300">Triple Captain chip</p>
              <p className="text-sm text-[var(--text-primary)] font-bold mb-1">Captain plays</p>
              <p className="text-xs text-[var(--text-secondary)]">Captain gets <strong className="text-[var(--text-primary)]">3×</strong>. VC gets <strong className="text-[var(--text-primary)]">1×</strong>.</p>
            </div>
            <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-4">
              <p className="mb-2 text-xs font-bold text-violet-700 dark:text-violet-300">Triple Captain chip</p>
              <p className="text-sm text-[var(--text-primary)] font-bold mb-1">Captain didn&apos;t play</p>
              <p className="text-xs text-[var(--text-secondary)]">VC inherits the full chip — gets <strong className="text-[var(--text-primary)]">3×</strong>, not just 2×.</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">💡 This means your vice-captain choice matters even more when using the Triple Captain chip — pick a VC who is likely to play.</p>
        </div>

        {/* Transfer Rules */}
        <div className="mt-8 border-t border-[var(--border)] pt-8">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"><span>📦</span> How Transfers Work</h3>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">The transfer system enforces a set of rules at the database level via a stored procedure, not just the UI:</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['↔️','Equal in and out','Every transfer batch must have the same number of players coming in as going out. You cannot bring in 2 players and sell only 1 in one transaction.'],
              ['💸','Budget enforced at DB level','The budget check and squad duplicate prevention are enforced inside a Postgres stored procedure, not the frontend, so they cannot be bypassed.'],
              ['📝','Full audit trail','Every transfer is logged with a timestamp, the players swapped, and your budget before and after. The system keeps a complete history.'],
              ['🔒','Exact role matching','The transfer database check requires the incoming player to have the exact same role as the outgoing player. Support and Hard Support are not interchangeable for a transfer, even if the market UI lets you select both.'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/60 p-4">
                <span className="text-xl">{icon}</span>
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Navigation CTA */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Need an interactive walkthrough of the app?</p>
            <p className="text-xs text-[var(--text-secondary)]">Launch guided tours for any page in the fantasy league system.</p>
          </div>
        </div>
        <Link href="/guide" className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 text-sm font-semibold transition-colors shadow-xs">
          Launch Manager Guide <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
