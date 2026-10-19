import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [collapsed, setCollapsed] = useState(false);
  const steps = getDashboardOnboardingSteps({ hasSquad, ownedPlayerCount, hasCompleteLineup, hasLeague });
  const completedCount = steps.filter((step) => step.complete).length;

  if (completedCount === steps.length) return null;

  return (
    <section
      aria-labelledby="onboarding-checklist-title"
      className="dashboard-onboarding-section mb-6 rounded-2xl p-4 sm:p-5 shadow-xs transition-all"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="onboarding-kicker text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--accent-primary)' }}>
            Getting started
          </p>
          <h2 id="onboarding-checklist-title" className="onboarding-title mt-0.5 text-base sm:text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Build your fantasy season
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="onboarding-badge rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{
              background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
              color: 'var(--accent-primary)',
              border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)',
            }}
          >
            {completedCount} of {steps.length} complete
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand onboarding checklist' : 'Collapse onboarding checklist'}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:opacity-80"
            style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <ol className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="onboarding-step-item flex items-center gap-3 rounded-xl p-2.5 transition-colors"
              style={{
                background: step.complete
                  ? 'color-mix(in srgb, var(--success) 8%, transparent)'
                  : 'var(--surface)',
                border: `1px solid ${
                  step.complete
                    ? 'color-mix(in srgb, var(--success) 25%, transparent)'
                    : 'var(--border)'
                }`,
              }}
            >
              <span
                aria-hidden="true"
                className="onboarding-step-num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  background: step.complete
                    ? 'color-mix(in srgb, var(--success) 18%, transparent)'
                    : 'var(--surface-muted)',
                  color: step.complete ? 'var(--success)' : 'var(--text-muted)',
                }}
              >
                {step.complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className="onboarding-step-title min-w-0 flex-1 text-xs font-medium"
                style={{ color: step.complete ? 'var(--success)' : 'var(--text-primary)' }}
              >
                {step.title}
              </span>
              {!step.complete ? (
                <Link
                  href={step.href}
                  className="onboarding-step-action inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition hover:opacity-90"
                  style={{
                    background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  {step.action}
                  <ArrowRight aria-hidden="true" className="h-3 w-3" />
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
