import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { getDashboardOnboardingSteps } from '@/lib/dashboard-onboarding';

interface DashboardOnboardingChecklistProps {
  hasSquad: boolean;
  ownedPlayerCount: number;
  hasCompleteLineup: boolean;
  hasLeague: boolean;
}

export function DashboardOnboardingChecklist({
  hasSquad,
  ownedPlayerCount,
  hasCompleteLineup,
  hasLeague,
}: DashboardOnboardingChecklistProps) {
  const steps = getDashboardOnboardingSteps({ hasSquad, ownedPlayerCount, hasCompleteLineup, hasLeague });
  const completedCount = steps.filter((step) => step.complete).length;

  if (completedCount === steps.length) return null;

  return (
    <section
      aria-labelledby="onboarding-checklist-title"
      className="dashboard-onboarding-section mb-8 rounded-2xl border border-cyan-500/30 bg-linear-to-br from-cyan-950/50 to-slate-900 p-5 sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="onboarding-kicker text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Getting started</p>
          <h2 id="onboarding-checklist-title" className="onboarding-title mt-1 text-xl font-bold text-white">
            Build your fantasy season
          </h2>
        </div>
        <span className="onboarding-badge rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-200">
          {completedCount} of {steps.length} complete
        </span>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={`onboarding-step-item flex items-center gap-3 rounded-xl border p-3 ${
              step.complete ? 'border-emerald-500/20 bg-emerald-950/20' : 'border-slate-700 bg-slate-950/40'
            }`}
          >
            <span
              aria-hidden="true"
              className={`onboarding-step-num flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                step.complete ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {step.complete ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <span className={`onboarding-step-title min-w-0 flex-1 text-sm font-medium ${step.complete ? 'text-emerald-100' : 'text-white'}`}>
              {step.title}
            </span>
            {!step.complete ? (
              <Link
                href={step.href}
                className="onboarding-step-action inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                {step.action}
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
