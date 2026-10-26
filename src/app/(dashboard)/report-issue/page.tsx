import { Suspense } from 'react';
import ReportIssuePage from './report-issue-page';

export default function ReportIssueRoute() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-10 text-sm text-[var(--text-muted)]">Loading issue reports...</div>}>
      <ReportIssuePage />
    </Suspense>
  );
}
