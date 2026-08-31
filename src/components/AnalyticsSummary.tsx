'use client';

import { generateAnalyticsSummary } from '@/lib/analytics';

const summary = generateAnalyticsSummary({
  totalUsers: 1280,
  activeUsers: 812,
  avgFantasyScore: 96.4,
  premiumUsers: 184,
  conversionRate: 14.4,
});

export function AnalyticsSummary() {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Analytics Snapshot</h3>
        <span className="text-xs uppercase tracking-wide text-amber-500">Live</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/60 rounded p-3">
          <p className="text-slate-400 text-xs">Total Users</p>
          <p className="text-xl font-bold text-white">{summary.totalUsers.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/60 rounded p-3">
          <p className="text-slate-400 text-xs">Active Users</p>
          <p className="text-xl font-bold text-white">{summary.activeUsers.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/60 rounded p-3">
          <p className="text-slate-400 text-xs">Avg Score</p>
          <p className="text-xl font-bold text-white">{summary.avgFantasyScore}</p>
        </div>
        <div className="bg-slate-900/60 rounded p-3">
          <p className="text-slate-400 text-xs">Premium %</p>
          <p className="text-xl font-bold text-white">{summary.premiumRatio}%</p>
        </div>
      </div>
    </div>
  );
}
