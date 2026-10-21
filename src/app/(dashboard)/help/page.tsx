'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, HelpCircle, BookOpen, ShieldCheck, Mail, Sparkles, ExternalLink } from 'lucide-react';

const FAQItem = ({ question, answer }: { question: string; answer: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs transition-all duration-200 hover:border-amber-500/30">
      <button
        type="button"
        className="w-full flex items-center justify-between p-4.5 text-left focus:outline-hidden transition-colors rounded-xl"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-[var(--text-primary)] text-sm sm:text-base pr-4">{question}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-amber-500 transition-transform duration-300 ease-in-out ${
            isOpen ? 'rotate-180 text-amber-400' : 'text-[var(--text-muted)]'
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-4.5 pb-4.5 pt-1 border-t border-[var(--border)] bg-[var(--surface-raised)]/40 rounded-b-xl text-[var(--text-secondary)] text-sm leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
};

export default function HelpPage() {
  const faqs = [
    {
      question: 'How do I join a league?',
      answer:
        'Navigate to the Leagues page from the sidebar. You can browse public leagues or join a private league by entering the invite code provided by the league creator.',
    },
    {
      question: "Why didn't my player score any points?",
      answer:
        'Players only score points for eligible matches within a gameweek. Make sure the player actually played an official match. If they were benched in real life, your bench substitute will automatically replace them if they match role requirements and played during the gameweek.',
    },
    {
      question: 'What happens if there is a tie in head-to-head?',
      answer:
        'In a head-to-head league, if both participants score the exact same amount of fantasy points, the match ends in a draw and both participants receive 1 league point.',
    },
    {
      question: 'Can a player have multiple roles?',
      answer:
        'Some players may be eligible for multiple roles (e.g., Mid and Carry). You can play them in any of their eligible positions according to their profile card.',
    },
    {
      question: 'When are points calculated?',
      answer:
        'Fantasy points are calculated shortly after a professional match concludes. However, league standings and global rankings are updated when the Gameweek is fully closed and locked.',
    },
    {
      question: 'How does the auto-bench substitution choose a replacement?',
      answer:
        'Substitutions check Bench 1, then Bench 2, then Bench 3. The substitute must match the exact position of the absent starter (e.g. Carry for Carry, Hard Support for Hard Support) and must have played at least one match in that gameweek.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero Header */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-xs">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-3">
              <HelpCircle className="h-3.5 w-3.5" />
              Support &amp; FAQ Center
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              Help Center &amp; <span className="bg-linear-to-r from-amber-500 to-amber-300 bg-clip-text text-transparent">Knowledge Base</span>
            </h1>
            <p className="mt-2 text-sm sm:text-base text-[var(--text-secondary)]">
              Find instant answers, onboarding walkthroughs, rule clarifications, and platform assistance.
            </p>
          </div>
          <div className="flex shrink-0">
            <Link
              href="/guide"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-cyan-500/40 transition-colors shadow-xs"
            >
              <Sparkles className="h-4 w-4 text-cyan-500" />
              Interactive Guide
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: FAQ Accordion */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="flex h-6 w-1 rounded-full bg-amber-500" />
              Frequently Asked Questions
            </h2>
            <span className="text-xs font-semibold text-[var(--text-muted)]">{faqs.length} Questions</span>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>

        {/* Right column: Guides & Support Cards */}
        <div className="space-y-5">
          {/* Onboarding Guide Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <BookOpen className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Onboarding Guide</h3>
            </div>
            <p className="text-[var(--text-secondary)] text-xs leading-relaxed mb-4">
              New to Fantasy Dota 2? Learn how to draft your first squad, navigate the transfer market, and understand player pricing.
            </p>
            <Link
              href="/learn"
              className="inline-flex w-full items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition-colors text-xs shadow-xs"
            >
              Open Learn Hub
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Role Eligibility Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Role Eligibility</h3>
            </div>
            <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
              Your squad must have exactly 1 Carry, 1 Mid, 1 Offlane, 1 Support, and 1 Hard Support in the active starting lineup. Bench players can be any role.
            </p>
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <Link href="/rules#roles" className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline">
                View role benchmarks in Rules →
              </Link>
            </div>
          </div>

          {/* Contact Support Card */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
                <Mail className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Still need help?</h3>
            </div>
            <p className="text-[var(--text-secondary)] text-xs leading-relaxed mb-4">
              If you found a bug or have an account or scoring dispute, our team is ready to assist.
            </p>
            <a
              href="mailto:support@fantasydota2.com"
              className="inline-flex w-full items-center justify-center gap-2 px-4 py-2 border border-[var(--border)] bg-[var(--surface-raised)] hover:bg-[var(--surface)] text-[var(--text-primary)] font-semibold rounded-xl transition-colors text-xs shadow-xs"
            >
              <Mail className="h-3.5 w-3.5 text-violet-500" />
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
