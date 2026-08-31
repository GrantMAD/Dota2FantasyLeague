'use client';

import { generateAnalyticsSummary } from '@/lib/analytics';

const mockAnalytics = generateAnalyticsSummary({
  totalUsers: 1280,
  activeUsers: 812,
  avgFantasyScore: 96.4,
  premiumUsers: 184,
  conversionRate: 14.4,
});

export default function AnalyticsDashboard() {
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <section className="border-b border-slate-700 bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Analytics Dashboard</h1>
          <p className="text-slate-400">Real-time platform metrics and health indicators</p>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <p className="text-slate-400 text-sm mb-2">Total Users</p>
            <p className="text-3xl font-bold text-white mb-1">{mockAnalytics.totalUsers.toLocaleString()}</p>
            <p className="text-xs text-slate-500">All registered accounts</p>
          </div>

          {/* Active Users */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <p className="text-slate-400 text-sm mb-2">Active Users</p>
            <p className="text-3xl font-bold text-white mb-1">{mockAnalytics.activeUsers.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Users active this week</p>
          </div>

          {/* Average Score */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <p className="text-slate-400 text-sm mb-2">Average Score</p>
            <p className="text-3xl font-bold text-white mb-1">{mockAnalytics.avgFantasyScore}</p>
            <p className="text-xs text-slate-500">Points per user avg</p>
          </div>

          {/* Premium Ratio */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <p className="text-slate-400 text-sm mb-2">Premium Users</p>
            <p className="text-3xl font-bold text-white mb-1">{mockAnalytics.premiumRatio}%</p>
            <p className="text-xs text-slate-500">of total user base</p>
          </div>
        </div>

        {/* Health Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Engagement */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Engagement</h3>
            <div className="space-y-4">
              <div>
                <p className="text-slate-400 text-sm mb-1">Conversion Rate</p>
                <div className="bg-slate-900/60 rounded h-2 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full"
                    style={{ width: `${mockAnalytics.conversionRate}%` }}
                  ></div>
                </div>
                <p className="text-xs text-amber-500 mt-1">{mockAnalytics.conversionRate}%</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm mb-1">Active Ratio</p>
                <div className="bg-slate-900/60 rounded h-2 overflow-hidden">
                  <div
                    className="bg-green-500 h-full"
                    style={{
                      width: `${((mockAnalytics.activeUsers / mockAnalytics.totalUsers) * 100).toFixed(1)}%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs text-green-500 mt-1">
                  {((mockAnalytics.activeUsers / mockAnalytics.totalUsers) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          {/* User Growth */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Growth</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">New Users (7d)</span>
                <span className="text-white font-semibold">+47</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Active Streak</span>
                <span className="text-white font-semibold">12 days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Retention (7d)</span>
                <span className="text-white font-semibold">68%</span>
              </div>
            </div>
          </div>

          {/* Premium Metrics */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Premium</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Premium Users</span>
                <span className="text-white font-semibold">{mockAnalytics.premiumUsers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Conversion Target</span>
                <span className="text-amber-500 font-semibold">18%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">ARPU</span>
                <span className="text-white font-semibold">$2.80</span>
              </div>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">System Health</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-slate-400 text-sm">API Uptime</p>
                <p className="text-white font-semibold">99.9%</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-slate-400 text-sm">Database Health</p>
                <p className="text-white font-semibold">Optimal</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-slate-400 text-sm">Auth System</p>
                <p className="text-white font-semibold">Operational</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
