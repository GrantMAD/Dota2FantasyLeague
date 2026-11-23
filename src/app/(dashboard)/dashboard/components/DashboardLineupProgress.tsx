export function DashboardLineupProgress({ starterCount }: { starterCount: number }) {
  const filled = Number.isFinite(starterCount)
    ? Math.max(0, Math.min(5, Math.floor(starterCount)))
    : 0;

  return (
    <div
      role="meter"
      aria-label="Starting lineup progress"
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={filled}
      aria-valuetext={`${filled} of 5 starting slots filled`}
      className="mb-4 flex gap-2"
    >
      {[0, 1, 2, 3, 4].map((slot) => (
        <span
          key={slot}
          aria-hidden="true"
          className="h-1.5 flex-1 rounded-full"
          style={{
            background: slot < filled ? 'var(--accent-primary)' : 'var(--surface-muted)',
            border: '1px solid var(--border)',
          }}
        />
      ))}
    </div>
  );
}
