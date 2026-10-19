import Link from 'next/link';
import { ArrowRight, Info } from 'lucide-react';

export interface DashboardStatCardData {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  trendColor?: string;
}

interface DashboardStatCardsProps {
  stats: DashboardStatCardData[];
  onOpenPointsBreakdown: () => void;
}

const STAT_ACCENTS: Record<string, string> = {
  'Active Squads': '#22d3ee',
  'Squad Value': '#34d399',
  'Bank Balance': '#fbbf24',
  'Total Points': '#f59e0b',
  'Global Rank': '#2dd4bf',
  'Free Transfers': '#fb923c',
};

function StaticStatCard({ stat }: { stat: DashboardStatCardData }) {
  const accent = STAT_ACCENTS[stat.label] || 'var(--accent-primary)';
  return (
    <article
      className="relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 shadow-sm transition-all"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
      />
      <div>
        <div className="mb-3 flex items-start justify-between">
          <div
            className="flex items-center justify-center rounded-xl p-2.5"
            style={{
              background: `color-mix(in srgb, ${accent} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
            }}
          >
            {stat.icon}
          </div>
        </div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {stat.label}
        </p>
        <p className="mb-1 text-2xl font-black font-mono tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {stat.value}
        </p>
      </div>
      {stat.trend && (
        <p className={`text-xs font-medium mt-1 ${stat.trendColor || ''}`} style={{ color: !stat.trendColor ? 'var(--text-muted)' : undefined }}>
          {stat.trend}
        </p>
      )}
    </article>
  );
}

export function DashboardStatCards({ stats, onOpenPointsBreakdown }: DashboardStatCardsProps) {
  return (
    <div data-guide="dashboard-stats" data-tour="dashboard-stats" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
      {stats.map((stat) => {
        const accent = STAT_ACCENTS[stat.label] || 'var(--accent-primary)';

        if (stat.label === 'Total Points') {
          return (
            <button
              key={stat.label}
              type="button"
              onClick={onOpenPointsBreakdown}
              aria-haspopup="dialog"
              className="group relative flex w-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                className="absolute top-0 left-0 right-0 h-1 transition-all group-hover:h-1.5"
                style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
              />
              <div>
                <div className="mb-3 flex items-start justify-between">
                  <div
                    className="flex items-center justify-center rounded-xl p-2.5 transition-transform group-hover:scale-105"
                    style={{
                      background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
                    }}
                  >
                    {stat.icon}
                  </div>
                  <Info aria-hidden="true" className="h-4 w-4 transition-colors group-hover:text-amber-400" style={{ color: 'var(--text-muted)' }} />
                </div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {stat.label}
                </p>
                <p className="mb-1 text-2xl font-black font-mono tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {stat.value}
                </p>
              </div>
              {stat.trend && (
                <p className="text-xs font-medium mt-1 flex items-center gap-1 text-amber-500">
                  {stat.trend} · Breakdown
                </p>
              )}
            </button>
          );
        }

        const href = stat.label === 'Squad Value' || stat.label === 'Active Squads'
          ? '/squads'
          : stat.label === 'Free Transfers' || stat.label === 'Bank Balance'
            ? '/transfers'
            : stat.label === 'Global Rank'
              ? '/leaderboard'
              : null;

        if (!href) return <StaticStatCard key={stat.label} stat={stat} />;

        const actionLabel = stat.label === 'Free Transfers'
          ? 'Go to transfers'
          : stat.label === 'Bank Balance'
            ? 'Market budget'
            : stat.label === 'Global Rank'
              ? 'View standings'
              : stat.label === 'Active Squads' && Number(stat.value) === 0
                ? 'Create a squad'
                : 'View squads';

        return (
          <Link
            key={stat.label}
            href={href}
            aria-label={`${stat.label}: ${stat.value}. ${actionLabel}`}
            className="group relative flex w-full flex-col justify-between overflow-hidden rounded-2xl p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-1 transition-all group-hover:h-1.5"
              style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
            />
            <div>
              <div className="mb-3 flex items-start justify-between">
                <div
                  className="flex items-center justify-center rounded-xl p-2.5 transition-transform group-hover:scale-105"
                  style={{
                    background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
                  }}
                >
                  {stat.icon}
                </div>
                <ArrowRight aria-hidden="true" className="h-4 w-4 transition-all group-hover:translate-x-1" style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {stat.label}
              </p>
              <p className="mb-1 text-2xl font-black font-mono tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {stat.value}
              </p>
            </div>
            {stat.trend && (
              <p className={`text-xs font-medium mt-1 truncate ${stat.trendColor || ''}`} style={{ color: !stat.trendColor ? 'var(--text-muted)' : undefined }}>
                {stat.trend} · {actionLabel}
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
