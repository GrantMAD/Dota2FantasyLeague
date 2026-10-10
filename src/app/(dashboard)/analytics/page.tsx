'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/components/theme/ThemeProvider';
import { useToast } from '@/components/Toast';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

type TrendRow = {
  gameweekId: number;
  userScore: number;
  globalAverage: number;
};

type RoleBreakdownRow = {
  role: string;
  points: number;
};

type MarketRow = {
  playerName: string;
  team: string;
  role: string;
  ownership: number;
  price: number;
  roi: number;
};

type DreamTeamRow = {
  playerName: string;
  team: string;
  role: string;
  points: number;
};

type AnalyticsData = {
  user: {
    totalPoints: number;
    globalRank: number | null;
    budget: number;
    squadValue: number;
    freeTransfers: number;
  };
  trend: TrendRow[];
  roleBreakdown: RoleBreakdownRow[];
  captainEfficiency: {
    captainPoints: number;
    idealCapPoints: number;
    efficiency: number;
  };
  market: MarketRow[];
  dreamTeam: DreamTeamRow[];
  valueForMoney: MarketRow[];
};

const initialData: AnalyticsData = {
  user: { totalPoints: 0, globalRank: null, budget: 0, squadValue: 0, freeTransfers: 0 },
  trend: [],
  roleBreakdown: [],
  captainEfficiency: { captainPoints: 0, idealCapPoints: 0, efficiency: 0 },
  market: [],
  dreamTeam: [],
  valueForMoney: [],
};

export default function AnalyticsDashboard() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const chartTheme = useMemo(() => ({
    gridStroke: isLight ? '#cbd5e1' : '#334155',
    axisStroke: isLight ? '#94a3b8' : '#64748b',
    tickFill: isLight ? '#475569' : '#94a3b8',
    yTickFill: isLight ? '#334155' : '#e2e8f0',
    tooltipBg: isLight ? '#ffffff' : '#0f172a',
    tooltipBorder: isLight ? '#cbd5e1' : '#334155',
    tooltipText: isLight ? '#0f172a' : '#f8fafc',
    tooltipItemColor: isLight ? '#334155' : '#e2e8f0',
    globalAvgLine: isLight ? '#64748b' : '#94a3b8',
    globalAvgDot: isLight ? '#475569' : '#64748b',
  }), [isLight]);

  const toast = useToast();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'my' | 'market' | 'dream'>('my');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/analytics');
      if (!res.ok) throw new Error('Failed to load analytics data');
      const payload = await res.json() as Partial<AnalyticsData>;
      setData({ ...initialData, ...payload });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics data';
      setError(message);
      setData(initialData);
      toast.error('Unable to load analytics', 'Could not retrieve your latest manager metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let ignore = false;

    async function loadInitialAnalytics() {
      try {
        const res = await fetchWithAuth('/api/analytics');
        if (!res.ok) throw new Error('Failed to load analytics data');
        const payload = await res.json() as Partial<AnalyticsData>;
        if (!ignore) {
          setData({ ...initialData, ...payload });
        }
      } catch (err: unknown) {
        if (!ignore) {
          const message = err instanceof Error ? err.message : 'Failed to load analytics data';
          setError(message);
          setData(initialData);
          toast.error('Unable to load analytics', 'Could not retrieve your latest manager metrics. Please try again.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadInitialAnalytics();

    return () => {
      ignore = true;
    };
  }, [toast]);



  const activeTabContent = useMemo(() => {
    if (tab === 'market') {
      return {
        title: 'Market & Metagame Intelligence',
        subtitle: 'Ownership momentum, ROI, and value signals from the current market.'
      };
    }
    if (tab === 'dream') {
      return {
        title: 'Dream Team & Milestones',
        subtitle: 'Theoretical best-scoring lineup and standout performers from the latest gameweek.'
      };
    }
    return {
      title: 'My Manager Analytics',
      subtitle: 'Your recent form, captain efficiency, and role contribution over time.'
    };
  }, [tab]);

  return (
    <div className="analytics-page min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Fantasy Intelligence
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">Analytics Hub</h1>
            <p className="mt-2 text-sm text-slate-400">Track your team form, market value, and the top scoring opportunities in the current meta.</p>
          </div>
          <Link href="/premium" className="inline-flex items-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20">Explore Premium Tools →</Link>
        </div>

        <div className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-2">
          {[
            ['my', 'My Performance'],
            ['market', 'Market'],
            ['dream', 'Dream Team'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as 'my' | 'market' | 'dream')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                tab === key ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-200 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold text-red-100">Analytics data temporarily unavailable</p>
              <p className="mt-1 text-sm text-red-300/90">{error}. Displaying default fallback values.</p>
            </div>
            <button
              type="button"
              onClick={() => void fetchAnalytics()}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80" />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Total Points</p>
                <p className="mt-3 text-3xl font-black text-white">{data.user.totalPoints}</p>
                <p className="mt-2 text-xs text-slate-500">Season total</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Global Rank</p>
                <p className="mt-3 text-3xl font-black text-white">{data.user.globalRank ?? '—'}</p>
                <p className="mt-2 text-xs text-slate-500">Current overall position</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Squad Value</p>
                <p className="mt-3 text-3xl font-black text-white">${(data.user.squadValue / 10).toFixed(1)}M</p>
                <p className="mt-2 text-xs text-slate-500">Current roster value</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Free Transfers</p>
                <p className="mt-3 text-3xl font-black text-white">{data.user.freeTransfers}</p>
                <p className="mt-2 text-xs text-slate-500">Remaining this week</p>
              </div>
            </div>

            <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">{activeTabContent.title}</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">{activeTabContent.subtitle}</h2>
                </div>
              </div>

              {tab === 'my' && (
                <div className="space-y-8">
                  <div className="analytics-chart-panel rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                    <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="analytics-chart-heading text-lg font-bold text-white">Gameweek Trajectory</h3>
                        <p className="text-xs text-slate-400">Your gameweek performance compared against the global manager average</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-medium text-cyan-400">
                          <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Your Score
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-400">
                          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Global Avg
                        </span>
                      </div>
                    </div>
                    {data.trend.length ? (
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={data.trend.map((row: TrendRow) => ({
                              name: `GW${row.gameweekId}`,
                              userScore: row.userScore,
                              globalAverage: row.globalAverage,
                            }))}
                            margin={{ top: 12, right: 16, left: -16, bottom: 4 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} opacity={0.5} vertical={false} />
                            <XAxis
                              dataKey="name"
                              stroke={chartTheme.axisStroke}
                              tick={{ fill: chartTheme.tickFill, fontSize: 12 }}
                              tickLine={{ stroke: chartTheme.axisStroke }}
                            />
                            <YAxis
                              stroke={chartTheme.axisStroke}
                              tick={{ fill: chartTheme.tickFill, fontSize: 12 }}
                              tickLine={{ stroke: chartTheme.axisStroke }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: chartTheme.tooltipBg,
                                borderColor: chartTheme.tooltipBorder,
                                borderRadius: '0.75rem',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                                color: chartTheme.tooltipText,
                                fontSize: '12px',
                              }}
                              itemStyle={{ color: chartTheme.tooltipItemColor, padding: '2px 0' }}
                              labelStyle={{ fontWeight: 'bold', color: isLight ? '#0284c7' : '#38bdf8', marginBottom: '4px' }}
                            />
                            <Line
                              type="monotone"
                              dataKey="userScore"
                              name="Your Score"
                              stroke="#06b6d4"
                              strokeWidth={3}
                              dot={{ r: 4, fill: '#06b6d4', stroke: isLight ? '#ffffff' : '#083344', strokeWidth: 2 }}
                              activeDot={{ r: 6, fill: '#22d3ee', stroke: isLight ? '#0f172a' : '#fff', strokeWidth: 2 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="globalAverage"
                              name="Global Average"
                              stroke={chartTheme.globalAvgLine}
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              dot={{ r: 3, fill: chartTheme.globalAvgDot }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex h-48 w-full items-center justify-center text-sm text-slate-400">
                        No score history available yet.
                      </div>
                    )}
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="analytics-chart-panel rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="analytics-chart-heading text-lg font-bold text-white">Role Scoring Breakdown</h3>
                          <p className="text-xs text-slate-400">Distribution of total fantasy points earned by position</p>
                        </div>
                      </div>
                      {data.roleBreakdown.length ? (
                        <div className="h-60 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              layout="vertical"
                              data={data.roleBreakdown}
                              margin={{ top: 8, right: 24, left: 12, bottom: 8 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} opacity={0.5} horizontal={false} />
                              <XAxis
                                type="number"
                                stroke={chartTheme.axisStroke}
                                tick={{ fill: chartTheme.tickFill, fontSize: 11 }}
                                tickLine={{ stroke: chartTheme.axisStroke }}
                              />
                              <YAxis
                                dataKey="role"
                                type="category"
                                stroke={chartTheme.axisStroke}
                                tick={{ fill: chartTheme.yTickFill, fontSize: 12, fontWeight: 500 }}
                                tickLine={false}
                                width={90}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: chartTheme.tooltipBg,
                                  borderColor: chartTheme.tooltipBorder,
                                  borderRadius: '0.75rem',
                                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                                  color: chartTheme.tooltipText,
                                  fontSize: '12px',
                                }}
                                itemStyle={{ color: chartTheme.tooltipItemColor, padding: '2px 0' }}
                                labelStyle={{ fontWeight: 'bold', color: isLight ? '#0f766e' : '#2dd4bf', marginBottom: '4px' }}
                                formatter={(value) => [`${value ?? 0} pts`, 'Points']}
                              />
                              <Bar dataKey="points" radius={[0, 8, 8, 0]}>
                                {data.roleBreakdown.map((entry: RoleBreakdownRow, index: number) => {
                                  const colors = ['#06b6d4', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];
                                  return <Cell key={`cell-${entry.role}-${index}`} fill={colors[index % colors.length]} />;
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="flex h-48 w-full items-center justify-center text-sm text-slate-400">
                          No role breakdown data available yet.
                        </div>
                      )}
                    </div>

                    <div className="analytics-chart-panel rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                      <div className="mb-4">
                        <h3 className="analytics-chart-heading text-lg font-bold text-white">Captaincy Efficiency</h3>
                        <p className="analytics-chart-subtitle text-xs text-slate-400">Points earned vs potential optimal captain choice</p>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-end justify-between">
                          <span className="analytics-chart-label text-sm text-slate-400">Captain points</span>
                          <span className="analytics-chart-value text-2xl font-bold text-white">{data.captainEfficiency.captainPoints}</span>
                        </div>
                        <div className="flex items-end justify-between">
                          <span className="analytics-chart-label text-sm text-slate-400">Ideal cap value</span>
                          <span className="text-xl font-semibold text-cyan-400">{data.captainEfficiency.idealCapPoints}</span>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="analytics-chart-label text-sm text-slate-400">Efficiency</span>
                            <span className="font-semibold text-emerald-400">{data.captainEfficiency.efficiency}%</span>
                          </div>
                          <div className="analytics-bar-track h-2.5 rounded-full bg-slate-800">
                            <div className="analytics-efficiency-bar h-full rounded-full bg-linear-to-r from-amber-500 to-emerald-500" style={{ width: `${Math.min(data.captainEfficiency.efficiency, 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'market' && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <h3 className="analytics-market-heading mb-4 text-lg font-semibold text-white">Value for Money</h3>
                    <div className="overflow-hidden rounded-xl border border-slate-800">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-900 text-slate-400">
                          <tr>
                            <th className="p-3">Player</th>
                            <th className="p-3">Role</th>
                            <th className="p-3">Team</th>
                            <th className="p-3">Price</th>
                            <th className="p-3">Ownership</th>
                            <th className="p-3">ROI</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.market.length ? data.market : [{ playerName: 'No data', team: '—', role: 'Support', price: 0, ownership: 0, roi: 0 }]).map((row: MarketRow, index: number) => (
                            <tr key={`${row.playerName}-${index}`} className="border-t border-slate-800 bg-slate-950/60">
                              <td className="analytics-market-value p-3 text-white">{row.playerName}</td>
                              <td className="analytics-market-value p-3 text-slate-300">{row.role}</td>
                              <td className="analytics-market-value p-3 text-slate-300">{row.team}</td>
                              <td className="analytics-market-value p-3 text-slate-300">${row.price}M</td>
                              <td className="analytics-market-value p-3 text-slate-300">{row.ownership}%</td>
                              <td className="p-3 text-emerald-400">{row.roi}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'dream' && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <h3 className="analytics-dream-heading mb-4 text-lg font-semibold text-white">Gameweek Dream Team</h3>
                    <div className="space-y-3">
                      {(data.dreamTeam.length ? data.dreamTeam : [{ playerName: 'Awaiting data', team: '—', role: 'Support', points: 0 }]).map((player: DreamTeamRow, index: number) => (
                        <div key={`${player.playerName}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                          <div>
                            <p className="font-semibold text-white">{player.playerName}</p>
                            <p className="text-xs text-slate-400">{player.team} · {player.role}</p>
                          </div>
                          <span className="text-lg font-bold text-cyan-300">{player.points} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <h3 className="analytics-dream-heading mb-4 text-lg font-semibold text-white">Top Individual Performances</h3>
                    <div className="space-y-3">
                      {(data.valueForMoney.length ? data.valueForMoney : [{ playerName: 'No standout performers yet', team: '—', role: 'Support', ownership: 0, price: 0, roi: 0 }]).map((row: MarketRow, index: number) => (
                        <div key={`${row.playerName}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                          <div>
                            <p className="font-semibold text-white">{row.playerName}</p>
                            <p className="text-xs text-slate-400">{row.team} · {row.role}</p>
                          </div>
                          <span className="text-emerald-400">{row.roi} ROI</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
