'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import { getCaptainEfficiencyAssessment, getTrendRowsForRange, type TrendRange } from '@/lib/analytics-presentation';
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
  rank?: number | null;
};

type AnalyticsTab = 'my' | 'market' | 'dream';
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
  price: number;
  roi: number;
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
  const chartTheme = {
    gridStroke: 'var(--border)',
    axisStroke: 'var(--text-muted)',
    tickFill: 'var(--text-secondary)',
    yTickFill: 'var(--text-primary)',
    tooltipBg: 'var(--surface-raised)',
    tooltipBorder: 'var(--border)',
    tooltipText: 'var(--text-primary)',
    tooltipItemColor: 'var(--text-secondary)',
    globalAvgLine: 'var(--text-muted)',
    globalAvgDot: 'var(--text-secondary)',
    rankLine: 'var(--danger)',
    rankDot: 'var(--danger)',
  };

  const toast = useToast();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AnalyticsTab>('my');
  const [trendRange, setTrendRange] = useState<TrendRange>('all');
  const tabRefs = useRef<Record<AnalyticsTab, HTMLButtonElement | null>>({
    my: null,
    market: null,
    dream: null,
  });

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

  const visibleTrend = useMemo(() => {
    return getTrendRowsForRange(data.trend, trendRange);
  }, [data.trend, trendRange]);

  const captainEfficiencyAssessment = useMemo(() => {
    return getCaptainEfficiencyAssessment(data.captainEfficiency.efficiency);
  }, [data.captainEfficiency.efficiency]);
  const analyticsTabCounts: Record<AnalyticsTab, number> = {
    my: data.trend.length,
    market: data.market.length,
    dream: data.dreamTeam.length,
  };

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentTab: AnalyticsTab) {
    const tabs: AnalyticsTab[] = ['my', 'market', 'dream'];
    const currentIndex = tabs.indexOf(currentTab);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      const nextTab = tabs[nextIndex];
      setTab(nextTab);
      tabRefs.current[nextTab]?.focus();
    }
  }

  return (
    <div className="analytics-page min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
              Fantasy Intelligence
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">Analytics Hub</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Track your team form, market value, and the top scoring opportunities in the current meta.</p>
          </div>
          <Link href="/premium" className="inline-flex items-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20">Explore Premium Tools →</Link>
        </div>

        <div
          role="tablist"
          aria-label="Analytics views"
          className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-2"
        >
          {[
            ['my', 'My Performance'],
            ['market', 'Market'],
            ['dream', 'Dream Team'],
          ].map(([key, label]) => (
            <button
              key={key}
              ref={(element) => { tabRefs.current[key as AnalyticsTab] = element; }}
              type="button"
              role="tab"
              id={`analytics-tab-${key}`}
              aria-selected={tab === key}
              aria-controls="analytics-panel"
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key as AnalyticsTab)}
              onKeyDown={(event) => handleTabKeyDown(event, key as AnalyticsTab)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                tab === key ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)]'
              }`}
            >
              {label}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                tab === key ? 'bg-slate-950/15 text-slate-950' : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
              }`}>
                {analyticsTabCounts[key as AnalyticsTab]}
              </span>
            </button>
          ))}
        </div>

        <div
          id="analytics-panel"
          role="tabpanel"
          aria-labelledby={`analytics-tab-${tab}`}
          tabIndex={0}
        >
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
              {([
                {
                  title: 'Total Points',
                  value: data.user.totalPoints.toLocaleString(),
                  detail: 'Season total',
                  href: '/leaderboard',
                  color: 'var(--accent-primary)',
                },
                {
                  title: 'Global Rank',
                  value: data.user.globalRank == null ? '—' : `#${data.user.globalRank}`,
                  detail: 'Current overall position',
                  href: '/leaderboard',
                  color: 'var(--accent-secondary)',
                },
                {
                  title: 'Squad Value',
                  value: `$${(data.user.squadValue / 10).toFixed(1)}M`,
                  detail: 'Current roster value',
                  href: '/squads',
                  color: 'var(--success)',
                },
              ]).map((stat) => (
                <Link
                  key={stat.title}
                  href={stat.href}
                  className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-md transition hover:-translate-y-0.5 hover:shadow-xl"
                  style={{ boxShadow: `0 10px 28px color-mix(in srgb, ${stat.color} 9%, transparent)` }}
                >
                  <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: stat.color }} />
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">{stat.title}</p>
                  <p className="mt-3 text-3xl font-black text-[var(--text-primary)]">{stat.value}</p>
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">{stat.detail}</p>
                  <span className="mt-3 inline-block text-xs font-semibold text-[var(--text-muted)] transition group-hover:text-[var(--text-primary)]">View details →</span>
                </Link>
              ))}
              <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-md">
                <span className="absolute inset-x-0 top-0 h-1 bg-amber-500" />
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Free Transfers</p>
                <p className="mt-3 text-3xl font-black text-[var(--text-primary)]">{data.user.freeTransfers}</p>
                <p className="mt-2 text-xs text-[var(--text-secondary)]">Remaining this week</p>
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
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="analytics-chart-heading text-lg font-bold text-white">Gameweek Trajectory</h3>
                        <p className="text-xs text-slate-400">Your gameweek performance vs global average (left axis) and global rank trajectory (right axis)</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-4 text-xs">
                          <span className="inline-flex items-center gap-1.5 font-medium text-cyan-400">
                            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Your Score
                          </span>
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-400">
                            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Global Avg
                          </span>
                          <span className="inline-flex items-center gap-1.5 font-medium text-amber-400">
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Global Rank
                          </span>
                        </div>
                        <div role="group" aria-label="Gameweek trend range" className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1">
                          {([
                            ['3', 'Last 3'],
                            ['6', 'Last 6'],
                            ['all', 'All'],
                          ] as const).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              aria-pressed={trendRange === value}
                              onClick={() => setTrendRange(value)}
                              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                                trendRange === value ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {visibleTrend.length ? (
                      <>
                        <div className="h-64 w-full" aria-hidden="true">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={visibleTrend.map((row: TrendRow) => ({
                                name: `GW${row.gameweekId}`,
                                userScore: row.userScore,
                                globalAverage: row.globalAverage,
                                rank: row.rank ?? undefined,
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
                                yAxisId="points"
                                stroke={chartTheme.axisStroke}
                                tick={{ fill: chartTheme.tickFill, fontSize: 12 }}
                                tickLine={{ stroke: chartTheme.axisStroke }}
                              />
                              <YAxis
                                yAxisId="rank"
                                orientation="right"
                                reversed
                                domain={[1, (dataMax: number) => Math.max(dataMax || 1, 5)]}
                                allowDecimals={false}
                                stroke={chartTheme.axisStroke}
                                tick={{ fill: chartTheme.tickFill, fontSize: 11 }}
                                tickLine={{ stroke: chartTheme.axisStroke }}
                                tickFormatter={(val: number) => `#${val}`}
                                width={36}
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
                                labelStyle={{ fontWeight: 'bold', color: 'var(--accent-secondary)', marginBottom: '4px' }}
                                formatter={(value: unknown, name: unknown) => {
                                  if (name === 'Global Rank') {
                                    return [value != null ? `#${value}` : '—', String(name)];
                                  }
                                  return [`${value} pts`, String(name)];
                                }}
                              />
                              <Line
                                yAxisId="points"
                                type="monotone"
                                dataKey="userScore"
                                name="Your Score"
                                isAnimationActive
                                animationBegin={0}
                                animationDuration={900}
                                animationEasing="ease-out"
                                stroke="var(--accent-secondary)"
                                strokeWidth={3}
                                dot={{ r: 4, fill: 'var(--accent-secondary)', stroke: 'var(--surface)', strokeWidth: 2 }}
                                activeDot={{ r: 6, fill: 'var(--accent-secondary)', stroke: 'var(--text-primary)', strokeWidth: 2 }}
                              />
                              <Line
                                yAxisId="points"
                                type="monotone"
                                dataKey="globalAverage"
                                name="Global Average"
                                isAnimationActive
                                animationBegin={120}
                                animationDuration={900}
                                animationEasing="ease-out"
                                stroke={chartTheme.globalAvgLine}
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                dot={{ r: 3, fill: chartTheme.globalAvgDot }}
                              />
                              <Line
                                yAxisId="rank"
                                type="monotone"
                                dataKey="rank"
                                name="Global Rank"
                                isAnimationActive
                                animationBegin={240}
                                animationDuration={900}
                                animationEasing="ease-out"
                                stroke={chartTheme.rankLine}
                                strokeWidth={2}
                                dot={{ r: 3, fill: chartTheme.rankDot, stroke: 'var(--surface)', strokeWidth: 1.5 }}
                                activeDot={{ r: 5, fill: chartTheme.rankDot, stroke: 'var(--text-primary)', strokeWidth: 2 }}
                                connectNulls
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-5 overflow-x-auto">
                          <table className="w-full min-w-80 text-left text-sm">
                            <caption className="sr-only">Gameweek scores and ranks shown in the trajectory chart</caption>
                            <thead className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-400">
                              <tr>
                                <th scope="col" className="px-3 py-2 font-semibold">Gameweek</th>
                                <th scope="col" className="px-3 py-2 text-right font-semibold">Your score</th>
                                <th scope="col" className="px-3 py-2 text-right font-semibold">Global average</th>
                                <th scope="col" className="px-3 py-2 text-right font-semibold">Global rank</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 text-slate-200">
                              {visibleTrend.map((row) => (
                                <tr key={row.gameweekId}>
                                  <th scope="row" className="px-3 py-2 font-medium text-slate-300">
                                    Gameweek {row.gameweekId}
                                  </th>
                                  <td className="px-3 py-2 text-right tabular-nums">{row.userScore}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{row.globalAverage}</td>
                                  <td className="px-3 py-2 text-right tabular-nums text-amber-400 font-medium">
                                    {row.rank != null ? `#${row.rank}` : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
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
                                labelStyle={{ fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '4px' }}
                                formatter={(value) => [`${value ?? 0} pts`, 'Points']}
                              />
                              <Bar dataKey="points" radius={[0, 8, 8, 0]} isAnimationActive animationBegin={0} animationDuration={900} animationEasing="ease-out">
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
                            <span className={`inline-flex items-center gap-2 font-semibold ${captainEfficiencyAssessment.color}`}>
                              {data.captainEfficiency.efficiency}%
                              <span className="rounded-full border border-current/30 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                                {captainEfficiencyAssessment.label}
                              </span>
                            </span>
                          </div>
                          <div
                            className="analytics-bar-track h-2.5 overflow-hidden rounded-full bg-slate-800"
                            role="progressbar"
                            aria-label={`Captain efficiency: ${captainEfficiencyAssessment.label}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.min(100, Math.max(0, data.captainEfficiency.efficiency))}
                          >
                            <div className="analytics-efficiency-bar h-full rounded-full bg-linear-to-r from-amber-500 to-emerald-500 transition-[width] duration-700" style={{ width: `${Math.min(100, Math.max(0, data.captainEfficiency.efficiency))}%` }} />
                          </div>
                          <p className={`mt-2 text-xs ${captainEfficiencyAssessment.color}`}>
                            {captainEfficiencyAssessment.description} · Good ≥80%, Average ≥50%, Poor &lt;50%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'market' && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                    <div className="mb-4">
                      <h3 className="analytics-market-heading text-lg font-semibold text-[var(--text-primary)]">Value for Money</h3>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">High-return players by points per million</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {data.market.length ? data.market.map((row: MarketRow, index: number) => (
                        <article key={`${row.playerName}-${index}`} className="analytics-market-card rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 transition hover:border-cyan-500/40">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="truncate font-bold text-[var(--text-primary)]">{row.playerName}</h4>
                              <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{row.team}</p>
                            </div>
                            <span className="shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">{row.role}</span>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Price</p>
                              <p className="analytics-market-value mt-1 text-sm font-semibold text-[var(--text-primary)]">${row.price}M</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Owned</p>
                              <p className="analytics-market-value mt-1 text-sm font-semibold text-[var(--text-primary)]">{row.ownership}%</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">ROI</p>
                              <p className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-400">{row.roi}</p>
                            </div>
                          </div>
                        </article>
                      )) : (
                        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-raised)] p-6 text-sm text-[var(--text-secondary)] sm:col-span-2 xl:col-span-3">
                          No value-for-money player data is available yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'dream' && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                    <div className="mb-4">
                      <h3 className="analytics-dream-heading text-lg font-semibold text-[var(--text-primary)]">Gameweek Dream Team</h3>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">Best role-balanced scorers from the latest available gameweek</p>
                    </div>
                    {data.dreamTeam.length ? (
                      <>
                        <div className="relative overflow-hidden rounded-2xl border border-emerald-700/40 bg-[linear-gradient(160deg,#14532d_0%,#064e3b_50%,#052e2b_100%)] p-3 sm:p-5">
                          <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-xl border border-white/15" />
                          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-3 bottom-3 w-px bg-white/10" />
                          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
                          <div className="relative grid min-h-64 grid-cols-3 grid-rows-2 items-center gap-2 sm:min-h-72 sm:gap-4">
                            {data.dreamTeam.slice(0, 5).map((player, index) => {
                              const fallbackPositions = [
                                'col-start-1 row-start-1',
                                'col-start-2 row-start-1',
                                'col-start-3 row-start-1',
                                'col-start-1 row-start-2',
                                'col-start-3 row-start-2',
                              ];
                              const position = fallbackPositions[index];
                              return (
                                <article
                                  key={`${player.playerName}-${index}`}
                                  className={`min-w-0 rounded-xl border border-black/10 bg-white/90 p-2 text-center shadow-lg backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-amber-400 dark:border-white/20 dark:bg-slate-950/70 dark:hover:border-amber-300/60 sm:p-3 ${position}`}
                                >
                                  <p className="truncate text-[9px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200 sm:text-[10px]">{player.role}</p>
                                  <h4 className="mt-1 truncate text-[11px] font-bold text-slate-900 dark:text-white sm:text-sm">{player.playerName}</h4>
                                  <p className="truncate text-[9px] text-slate-600 dark:text-slate-300 sm:text-[10px]">{player.team}</p>
                                  <p className="mt-1 font-mono text-base font-black text-amber-700 dark:text-amber-300 sm:text-lg">
                                    {player.points}<span className="ml-1 text-[9px] font-semibold text-amber-800 dark:text-amber-200">PTS</span>
                                  </p>
                                  <p className="mt-1 truncate text-[9px] text-slate-600 dark:text-slate-300 sm:text-[10px]">
                                    ${player.price.toFixed(1)}M · {player.roi.toFixed(1)} pts / $10M
                                  </p>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                        {data.dreamTeam.length > 5 && (
                          <div className="mt-4">
                            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Bench</h4>
                            <div className="grid gap-2 sm:grid-cols-3">
                              {data.dreamTeam.slice(5).map((player, index) => (
                                <article key={`${player.playerName}-bench-${index}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3">
                                  <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Bench {index + 1} · {player.role}</p>
                                  <h4 className="mt-1 truncate text-xs font-bold text-[var(--text-primary)]">{player.playerName}</h4>
                                  <p className="mt-1 font-mono text-sm font-bold text-[var(--accent-secondary)]">{player.points} pts</p>
                                  <p className="mt-1 text-[10px] text-[var(--text-secondary)]">${player.price.toFixed(1)}M · {player.roi.toFixed(1)} pts / $10M</p>
                                </article>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-raised)] p-6 text-sm text-[var(--text-secondary)]">
                        Dream Team results will appear after gameweek scoring is available.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="mb-4">
                      <h3 className="analytics-dream-heading text-lg font-semibold text-[var(--text-primary)]">Top Individual Performances</h3>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">Standout scoring and value signals</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {data.valueForMoney.length ? data.valueForMoney.map((row: MarketRow, index: number) => (
                        <article key={`${row.playerName}-${index}`} className="analytics-performance-card rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 transition hover:border-amber-500/40">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="truncate font-bold text-[var(--text-primary)]">{row.playerName}</h4>
                              <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{row.team}</p>
                            </div>
                            <span className="shrink-0 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-sm font-bold text-amber-800 dark:text-amber-300">{row.roi} ROI</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">{row.role}</span>
                            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">${row.price}M</span>
                            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">{row.ownership}% owned</span>
                          </div>
                        </article>
                      )) : (
                        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-raised)] p-6 text-sm text-[var(--text-secondary)] sm:col-span-2">
                          No standout performances are available yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
