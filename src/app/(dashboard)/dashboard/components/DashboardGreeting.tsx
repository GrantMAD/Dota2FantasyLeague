export function DashboardGreeting({
  loading,
  displayName,
}: {
  loading: boolean;
  displayName?: string | null;
}) {
  return (
    <h1
      className="dashboard-hero-title text-3xl md:text-4xl font-bold"
      style={{ color: 'var(--text-primary)' }}
      aria-live="polite"
      aria-busy={loading}
    >
      Welcome back
      {loading ? (
        <span
          aria-label="Loading manager name"
          role="status"
          className="ml-2 inline-block h-[0.75em] w-32 max-w-[45vw] animate-pulse rounded-md align-middle"
          style={{ background: 'var(--surface-muted)' }}
        />
      ) : (
        `, ${displayName?.trim() || 'Manager'}`
      )}
    </h1>
  );
}
