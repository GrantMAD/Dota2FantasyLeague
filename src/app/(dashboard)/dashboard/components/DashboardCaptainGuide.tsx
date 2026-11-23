import { CircleHelp } from 'lucide-react';

export function DashboardCaptainGuide() {
  return (
    <details className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
      <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]">
        <span>How captain scoring works</span>
        <CircleHelp aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
      </summary>
      <p className="pt-2 text-xs leading-relaxed text-[var(--text-muted)]">
        Your Captain earns 2× their fantasy points. If they have no recorded match participation that gameweek, your Vice-Captain inherits the multiplier.
      </p>
    </details>
  );
}
