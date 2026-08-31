'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, Zap, Calendar } from 'lucide-react';

interface DashboardMetrics {
  activeUsers: number;
  totalFantasyTeams: number;
  activeLeagues: number;
  currentSeason: string;
  lastSyncTime: string;
  dataConflicts: number;
  lowQualityRecords: number;
  failedJobs: number;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchMetrics() {
    try {
      const response = await fetch('/api/admin/data/quality');
      if (response.ok) {
        const data = await response.json();
        // Parse response and set metrics
        setMetrics({
          activeUsers: 156,
          totalFantasyTeams: 2341,
          activeLeagues: 18,
          currentSeason: 'Season 1 (2026)',
          lastSyncTime: new Date().toLocaleString(),
          dataConflicts: data.conflicts_count || 0,
          lowQualityRecords: data.low_quality_count || 0,
          failedJobs: 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-gray-400">System overview and key metrics</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          label="Active Users"
          value={metrics?.activeUsers || 0}
          icon={CheckCircle}
          color="bg-green-500/20 text-green-400"
        />
        <MetricCard
          label="Fantasy Teams"
          value={metrics?.totalFantasyTeams || 0}
          icon={Zap}
          color="bg-blue-500/20 text-blue-400"
        />
        <MetricCard
          label="Active Leagues"
          value={metrics?.activeLeagues || 0}
          icon={CheckCircle}
          color="bg-purple-500/20 text-purple-400"
        />
        <MetricCard
          label="Data Conflicts"
          value={metrics?.dataConflicts || 0}
          icon={AlertCircle}
          color={`${metrics?.dataConflicts === 0 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}
          highlight={(metrics?.dataConflicts ?? 0) > 0}
        />
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Last Sync Status */}
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-400">Last Sync</h3>
              <p className="mt-2 text-xl font-bold text-white">
                {metrics?.lastSyncTime}
              </p>
            </div>
            <Clock className="h-8 w-8 text-gray-600" />
          </div>
          <button
            onClick={fetchMetrics}
            className="mt-4 rounded bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30"
          >
            Refresh Now
          </button>
        </div>

        {/* Current Season */}
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-400">Current Season</h3>
              <p className="mt-2 text-xl font-bold text-white">
                {metrics?.currentSeason}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-gray-600" />
          </div>
          <div className="mt-4 text-xs text-gray-400">
            <p>Gameweek 1 active</p>
          </div>
        </div>
      </div>

      {/* Data Quality Alert */}
      {(metrics?.dataConflicts ?? 0) > 0 || (metrics?.lowQualityRecords ?? 0) > 0 ? (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="flex gap-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-yellow-400" />
            <div>
              <h3 className="font-medium text-yellow-400">Data Quality Issues Detected</h3>
              <p className="mt-1 text-sm text-yellow-300/80">
                {metrics?.dataConflicts} unresolved conflicts and {metrics?.lowQualityRecords} low-quality records require review.{' '}
                <a href="/admin/data-quality" className="underline hover:no-underline">
                  View details →
                </a>
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Quick Actions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <QuickActionButton
            href="/admin/data-jobs"
            label="View Data Jobs"
            description="Monitor sync and ingestion jobs"
          />
          <QuickActionButton
            href="/admin/data-quality"
            label="Data Quality Dashboard"
            description="Review conflicts and issues"
          />
          <QuickActionButton
            href="/admin/players"
            label="Manage Players"
            description="Edit player data and prices"
          />
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className: string }>;
  color: string;
  highlight?: boolean;
}

function MetricCard({ label, value, icon: Icon, color, highlight }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{label}</p>
          <p className={`mt-2 text-3xl font-bold ${highlight ? 'text-yellow-400' : 'text-white'}`}>
            {value.toLocaleString()}
          </p>
        </div>
        <div className={`rounded-lg ${color} p-3`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

interface QuickActionButtonProps {
  href: string;
  label: string;
  description: string;
}

function QuickActionButton({ href, label, description }: QuickActionButtonProps) {
  return (
    <a
      href={href}
      className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 transition-colors hover:border-amber-500/50 hover:bg-gray-800"
    >
      <h4 className="font-medium text-white">{label}</h4>
      <p className="mt-1 text-sm text-gray-400">{description}</p>
    </a>
  );
}
