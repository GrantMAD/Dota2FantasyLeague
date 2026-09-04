'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface StatCard {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  trendColor?: string;
}

interface LeagueStanding {
  rank: number | null;
  leagues?: { name?: string } | null;
}

interface DashboardStarter {
  id: number;
  slot: string;
  name: string;
  in_game_name?: string | null;
  primary_role: string;
  current_price?: number | null;
  is_captain?: boolean;
  is_vice_captain?: boolean;
  team_name?: string | null;
}

interface DashboardData {
  activeSquadCount: number;
  squadValue: number;
  bankBalance: number;
  totalPoints: number;
  globalRank: number | null;
  freeTransfers: number;
  squadName?: string;
  gameweek?: { gameweek_number: number; deadline: string; status: string } | null;
  captain?: { name: string } | null;
  viceCaptain?: { name: string } | null;
  starters?: DashboardStarter[];
  leagueStandings: LeagueStanding[];
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard/stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = (await res.json()) as DashboardData;
        setDashboardData(data);
        
        setStats([
          {
            icon: '👥',
            label: 'Active Squads',
            value: data.activeSquadCount || 0,
            trend: data.activeSquadCount > 0 ? 'Ready' : 'Create one',
            trendColor: data.activeSquadCount > 0 ? 'text-green-500' : 'text-amber-500',
          },
          {
            icon: '💰',
            label: 'Squad Value',
            value: `${Number(data.squadValue || 0).toFixed(1)}M`,
            trend: 'Current squad',
            trendColor: 'text-slate-400',
          },
          {
            icon: '🏦',
            label: 'Bank Balance',
            value: `${Number(data.bankBalance || 0).toFixed(1)}M`,
            trend: 'Available budget',
            trendColor: 'text-amber-500',
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
            value: data.freeTransfers || 0,
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
              <h1 className="dashboard-hero-title text-3xl md:text-4xl font-bold text-white mb-2">
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
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-slate-800/40 border border-slate-700/80 rounded-lg p-4 animate-pulse">
                  <div className="h-8 w-8 bg-slate-700/60 rounded mb-4" />
                  <div className="h-3 w-20 bg-slate-700/50 rounded mb-2" />
                  <div className="h-6 w-16 bg-slate-700/70 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div data-guide="dashboard-stats" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {stats.map((stat, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-all"
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
              <div data-guide="dashboard-actions" className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Squads Status Section */}
            {loading ? (
              <div className="bg-slate-800/30 border border-slate-700/80 rounded-lg p-8 animate-pulse text-center">
                <div className="h-10 w-10 bg-slate-700/60 rounded-full mx-auto mb-4" />
                <div className="h-5 w-48 bg-slate-700/60 rounded mx-auto mb-2" />
                <div className="h-4 w-64 bg-slate-700/40 rounded mx-auto" />
              </div>
            ) : !dashboardData?.activeSquadCount ? (
              <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 text-center">
                <div className="text-5xl mb-4">🛡️</div>
                <h3 className="text-xl font-semibold text-white mb-2">No Active Squads</h3>
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
            ) : (
              <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-700/80">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">🛡️</span>
                      <h3 className="text-lg font-bold text-white">
                        {dashboardData.squadName || 'Active Squad'}
                      </h3>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Gameweek {dashboardData.gameweek?.gameweek_number || 1} • 5 Starters • Squad Value: ${Number(dashboardData.squadValue || 0).toFixed(1)}M
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href="/lineups"
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
                    >
                      Edit Lineup
                    </Link>
                    <Link
                      href="/squads"
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                    >
                      View Full Squad
                    </Link>
                  </div>
                </div>

                {/* Starting 5 Lineup Strip */}
                <div className="pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Starting Five Lineup
                    </h4>
                    <span className="text-xs text-slate-400">
                      {dashboardData.starters && dashboardData.starters.length > 0 ? `${dashboardData.starters.length}/5 Selected` : 'Ready to configure'}
                    </span>
                  </div>

                  {dashboardData.starters && dashboardData.starters.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {dashboardData.starters.map((player) => (
                        <div
                          key={player.id}
                          className="relative rounded-lg border border-slate-700/80 bg-slate-850 p-3 hover:border-slate-600 transition-all flex flex-col justify-between"
                        >
                          {player.is_captain && (
                            <span className="absolute -top-2 -right-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500 text-slate-950 shadow-sm">
                              C
                            </span>
                          )}
                          {player.is_vice_captain && (
                            <span className="absolute -top-2 -right-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-cyan-500 text-slate-950 shadow-sm">
                              VC
                            </span>
                          )}

                          <div>
                            <span className="text-[10px] uppercase font-bold text-amber-400/90 tracking-wide block mb-1">
                              {player.slot.replace('_', ' ')}
                            </span>
                            <p className="text-sm font-bold text-white truncate" title={player.in_game_name || player.name}>
                              {player.in_game_name || player.name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {player.team_name || 'Free Agent'}
                            </p>
                          </div>

                          <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Price</span>
                            <span className="font-semibold text-emerald-400">
                              ${Number(player.current_price || 0).toFixed(1)}M
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center">
                      <p className="text-sm text-slate-300 font-medium mb-1">No starting 5 set for this gameweek yet</p>
                      <p className="text-xs text-slate-400 mb-4">Pick your 5 starters and captain to start accumulating points</p>
                      <Link
                        href="/lineups"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                      >
                        Set Starting Lineup →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6 lg:pt-14">
            {/* Recent News */}
            <div className="dashboard-whats-new bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h3 className="font-semibold text-white mb-4">What&apos;s New</h3>
              <div className="space-y-3">
                <div className="text-xs">
                  <p className="dashboard-whats-new-title text-amber-500 font-semibold mb-1">Season 2026 Starts</p>
                  <p className="text-slate-400">Fantasy season 2026 is now live</p>
                </div>
              </div>
            </div>

            {/* Upcoming Gameweek */}
            <div data-guide="dashboard-gameweek" className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold text-white">Current Gameweek</h3>
                {dashboardData?.gameweek?.status === 'active' && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                    Active
                  </span>
                )}
              </div>
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
              {dashboardData && dashboardData.leagueStandings.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.leagueStandings.map((l, idx) => (
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

          </div>
        </div>
      </section>
    </div>
  );
}
