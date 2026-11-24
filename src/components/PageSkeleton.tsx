import type { ReactNode } from 'react';

type PageSkeletonProps = {
  label?: string;
  lines?: number;
  className?: string;
  children?: ReactNode;
};

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-[var(--surface-muted)] ${className}`} />;
}

export function PageSkeleton({ label = 'Loading content', lines = 4, className = '', children }: PageSkeletonProps) {
  const count = Math.max(1, lines);
  return (
    <div role="status" aria-live="polite" aria-label={label} className={`space-y-4 ${className}`}>
      <span className="sr-only">{label}</span>
      {children ?? (
        <>
          <SkeletonBlock className="h-8 w-48 max-w-full" />
          <div className="space-y-3">
            {Array.from({ length: count }).map((_, index) => (
              <SkeletonBlock key={index} className={`h-4 ${index === count - 1 ? 'w-2/3' : 'w-full'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
