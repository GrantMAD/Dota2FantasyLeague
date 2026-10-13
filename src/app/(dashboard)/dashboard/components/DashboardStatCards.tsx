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

function StaticStatCard({ stat }: { stat: DashboardStatCardData }) {
  return (
    <article className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/60 p-2.5">
          {stat.icon}
        </div>
      </div>
      <p className="mb-1 text-sm text-slate-400">{stat.label}</p>
      <p className="mb-2 text-2xl font-bold text-white">{stat.value}</p>
      {stat.trend && <p className={`text-xs ${stat.trendColor}`}>{stat.trend}</p>}
    </article>
  );
}

export function DashboardStatCards({ stats, onOpenPointsBreakdown }: DashboardStatCardsProps) {
  return (
    <div data-guide="dashboard-stats" data-tour="dashboard-stats" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
      {stats.map((stat) => {
        if (stat.label === 'Total Points') {
          return (
            <button
              key={stat.label}
              type="button"
              onClick={onOpenPointsBreakdown}
              aria-haspopup="dialog"
              className="group w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-left transition-all hover:border-amber-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/60 p-2.5 transition-colors group-hover:border-amber-500/40">
                  {stat.icon}
                </div>
                <Info aria-hidden="true" className="h-4 w-4 text-slate-500 transition-colors group-hover:text-amber-300" />
              </div>
              <p className="mb-1 text-sm text-slate-400">{stat.label}</p>
              <p className="mb-2 text-2xl font-bold text-white">{stat.value}</p>
              {stat.trend && <p className={`text-xs ${stat.trendColor}`}>{stat.trend} · View breakdown</p>}
            </button>
          );
        }

        const href = stat.label === 'Squad Value' || stat.label === 'Active Squads'
          ? '/squads'
          : stat.label === 'Free Transfers'
            ? '/transfers'
            : null;

        if (!href) return <StaticStatCard key={stat.label} stat={stat} />;

        const actionLabel = stat.label === 'Free Transfers'
          ? 'Go to transfers'
          : stat.label === 'Active Squads' && Number(stat.value) === 0
            ? 'Create a squad'
            : stat.label === 'Active Squads'
              ? 'View squads'
              : 'View squads';
        const linkStyles = stat.label === 'Squad Value'
          ? {
              card: 'hover:border-emerald-500/60 focus-visible:ring-emerald-400',
              icon: 'group-hover:border-emerald-500/40',
              arrow: 'group-hover:text-emerald-300',
            }
          : {
              card: 'hover:border-cyan-500/60 focus-visible:ring-cyan-400',
              icon: 'group-hover:border-cyan-500/40',
              arrow: 'group-hover:text-cyan-300',
            };

        return (
          <Link
            key={stat.label}
            href={href}
            aria-label={`${stat.label}: ${stat.value}. ${actionLabel}`}
            className={`group w-full rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 ${linkStyles.card}`}
          >
            <div className="mb-3 flex items-start justify-between">
              <div className={`flex items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/60 p-2.5 transition-colors ${linkStyles.icon}`}>
                {stat.icon}
              </div>
              <ArrowRight aria-hidden="true" className={`h-4 w-4 text-slate-500 transition-all group-hover:translate-x-1 ${linkStyles.arrow}`} />
            </div>
            <p className="mb-1 text-sm text-slate-400">{stat.label}</p>
            <p className="mb-2 text-2xl font-bold text-white">{stat.value}</p>
            {stat.trend && <p className={`text-xs ${stat.trendColor}`}>{stat.trend} · {actionLabel}</p>}
          </Link>
        );
      })}
    </div>
  );
}
