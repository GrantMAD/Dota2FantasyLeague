'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { AnalyticsSummary } from '@/components/AnalyticsSummary';
import { BackendJobsPanel } from '@/components/BackendJobsPanel';
import { CaptainSystem } from '@/components/CaptainSystem';
import { FantasyGameweekPanel } from '@/components/FantasyGameweekPanel';
import { PremiumFeatureGate } from '@/components/PremiumFeatureGate';
import { ScoringBreakdown } from '@/components/ScoringBreakdown';

interface StatCard {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  trendColor?: string;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard/stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        setDashboardData(data);
        
        setStats([
          {
            icon: '👥',
            label: 'Active Squad',
            value: data.gameweek && data.captain ? '1' : '0',
            trend: data.captain ? 'Ready' : 'Needs setup',
            trendColor: data.captain ? 'text-green-500' : 'text-amber-500',
          },
          {
            icon: '🏆',
            label: 'Total Points',
            value: data.totalPoints || 0,
            trend: 'Overall',
            trendColor: 'text-slate-400',
          },
          {
            icon: '📊',
            label: 'Global Rank',
            value: data.globalRank || '-',
            trend: data.globalRank ? 'Active' : 'Unranked',
            trendColor: data.globalRank ? 'text-green-500' : 'text-slate-400',
          },
          {
            icon: '⚡',
            label: 'Free Transfers',
            value: '1',
            trend: 'Ready to use',
            trendColor: 'text-amber-500',
          },
        ]);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Welcome to Fantasy Dota 2
              </h1>
              <p className="text-slate-400 text-lg">
                Manage your fantasy squads and compete with players worldwide
              </p>
            </div>
            <Link
              href="/squads"
              className="mt-4 md:mt-0 bg-linear-to-r from-amber-500 to-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-orange-500/20 transition-all"
            >
              Manage Squad
            </Link>
          </div>

          {/* Stats Grid */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-3xl">{stat.icon}</div>
                  </div>
                  <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-white mb-2">{stat.value}</p>
                  {stat.trend && (
                    <p className={`text-xs ${stat.trendColor}`}>{stat.trend}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Primary Actions */}
          <div className="lg:col-span-2">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-6">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                  href="/lineups"
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-amber-500/50 hover:bg-slate-800 transition-all group"
                >
                  <div className="text-3xl mb-3">📋</div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-amber-500">
                    Set Lineup
                  </h3>
                  <p className="text-slate-400 text-sm">Choose your starting XI and captain</p>
                </Link>

                <Link
                  href="/transfers"
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-amber-500/50 hover:bg-slate-800 transition-all group"
                >
                  <div className="text-3xl mb-3">🔄</div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-amber-500">
                    Transfer Market
                  </h3>
                  <p className="text-slate-400 text-sm">Buy and sell players to optimize squad</p>
                </Link>

                <Link
                  href="/leagues"
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-amber-500/50 hover:bg-slate-800 transition-all group"
                >
                  <div className="text-3xl mb-3">🏅</div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-amber-500">
                    Leagues
                  </h3>
                  <p className="text-slate-400 text-sm">View leagues and compete with friends</p>
                </Link>

                <Link
                  href="/players"
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-amber-500/50 hover:bg-slate-800 transition-all group"
                >
                  <div className="text-3xl mb-3">👨‍💼</div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-amber-500">
                    Players
                  </h3>
                  <p className="text-slate-400 text-sm">Browse player stats and performance</p>
                </Link>
              </div>
            </div>

            {/* Empty Squads Section */}
            <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
              <div className="text-5xl mb-4">⚽</div>
              <h3 className="text-xl font-semibold text-white mb-2">No Active Squad</h3>
              <p className="text-slate-400 mb-6">
                Create or select a squad to get started with your fantasy league
              </p>
              <Link
                href="/squads"
                className="inline-block bg-linear-to-r from-amber-500 to-orange-600 text-white px-6 py-2 rounded-lg font-semibold hover:shadow-lg hover:shadow-orange-500/20 transition-all"
              >
                Create Squad
              </Link>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Upcoming Gameweek */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">Current Gameweek</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-slate-400 text-sm">Gameweek</p>
                  <p className="text-2xl font-bold text-white">
                    {dashboardData?.gameweek?.gameweek_number || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Deadline</p>
                  <p className="text-sm text-amber-500 font-semibold">
                    {dashboardData?.gameweek?.deadline ? new Date(dashboardData.gameweek.deadline).toLocaleString() : 'Not Set'}
                  </p>
                </div>
              </div>
            </div>

            {/* Captain Status */}
            {dashboardData?.captain && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h3 className="font-semibold text-white mb-4">Leadership</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                    <span className="text-slate-400 text-sm">Captain (2x)</span>
                    <span className="font-semibold text-white">{dashboardData.captain.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Vice-Captain</span>
                    <span className="font-semibold text-slate-300">{dashboardData.viceCaptain?.name || 'None'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard Preview */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">Leagues Overview</h3>
              {dashboardData?.leagueStandings?.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.leagueStandings.map((l: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-700 pb-2 last:border-0 last:pb-0">
                      <span className="text-slate-300 truncate pr-2">{l.leagues?.name}</span>
                      <span className="text-amber-500 font-semibold">Rank {l.rank || '-'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm text-center py-4">
                  Sign up and join to see global rankings
                </p>
              )}
              <Link
                href="/leagues"
                className="block text-center text-amber-500 hover:text-orange-600 text-sm font-semibold mt-4"
              >
                View Leaderboards →
              </Link>
            </div>

            {/* Recent News */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">What&apos;s New</h3>
              <div className="space-y-3">
                <div className="text-xs">
                  <p className="text-amber-500 font-semibold mb-1">Season 2026 Starts</p>
                  <p className="text-slate-400">Fantasy season 2026 is now live</p>
                </div>
              </div>
            </div>

            <AnalyticsSummary />
            <PremiumFeatureGate />
            <ScoringBreakdown />
            <CaptainSystem />
            <FantasyGameweekPanel />
            <BackendJobsPanel />
          </div>
        </div>
      </section>
    </div>
  );
}
