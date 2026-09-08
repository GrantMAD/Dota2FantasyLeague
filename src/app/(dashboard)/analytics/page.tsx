'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'my' | 'market' | 'dream'>('my');

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch('/api/analytics');
        if (!res.ok) throw new Error('Failed to load analytics');
        const payload = await res.json() as Partial<AnalyticsData>;
        setData({ ...initialData, ...payload });
      } catch {
        setData(initialData);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  const trendMax = useMemo(() => {
    const values = data.trend.flatMap((row: TrendRow) => [row.userScore, row.globalAverage]);
    return Math.max(100, ...values, 0);
  }, [data.trend]);

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
                  <div className="analytics-chart-panel rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="analytics-chart-heading text-lg font-semibold text-white">Gameweek Trajectory</h3>
                      <span className="analytics-chart-label text-xs text-slate-400">User vs average</span>
                    </div>
                    <div className="flex h-48 items-end gap-2">
                      {data.trend.length ? data.trend.map((row: TrendRow, index: number) => {
                        const userHeight = (row.userScore / trendMax) * 100;
                        const avgHeight = (row.globalAverage / trendMax) * 100;
                        return (
                          <div key={`${row.gameweekId}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                            <div className="flex h-36 w-full items-end justify-center gap-1">
                              <div className="analytics-user-bar w-1/2 rounded-t-xl bg-cyan-500/90" style={{ height: `${Math.max(userHeight, 8)}%` }} title={`User: ${row.userScore}`} />
                              <div className="analytics-average-bar w-1/2 rounded-t-xl bg-slate-600" style={{ height: `${Math.max(avgHeight, 8)}%` }} title={`Average: ${row.globalAverage}`} />
                            </div>
                            <span className="text-[10px] text-slate-400">GW{index + 1}</span>
                          </div>
                        );
                      }) : (
                        <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">No score history available yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="analytics-chart-panel rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <h3 className="analytics-chart-heading mb-4 text-lg font-semibold text-white">Role Scoring Breakdown</h3>
                      <div className="space-y-3">
                        {(data.roleBreakdown.length ? data.roleBreakdown : [{ role: 'Support', points: 0 }, { role: 'Carry', points: 0 }, { role: 'Mid', points: 0 }]).map((item: RoleBreakdownRow) => (
                          <div key={item.role}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="analytics-chart-label text-slate-300">{item.role}</span>
                              <span className="analytics-chart-value text-white">{item.points} pts</span>
                            </div>
                            <div className="analytics-bar-track h-2 rounded-full bg-slate-800">
                              <div className="analytics-role-bar h-full rounded-full bg-linear-to-r from-cyan-500 to-emerald-500" style={{ width: `${Math.min((item.points / Math.max(1, data.user.totalPoints || 1)) * 100, 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="analytics-chart-panel rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <h3 className="analytics-chart-heading mb-4 text-lg font-semibold text-white">Captaincy Efficiency</h3>
                      <div className="space-y-4">
                        <div className="flex items-end justify-between">
                          <span className="analytics-chart-label text-slate-400">Captain points</span>
                          <span className="analytics-chart-value text-2xl font-bold text-white">{data.captainEfficiency.captainPoints}</span>
                        </div>
                        <div className="flex items-end justify-between">
                          <span className="analytics-chart-label text-slate-400">Ideal cap value</span>
                          <span className="text-xl font-semibold text-cyan-300">{data.captainEfficiency.idealCapPoints}</span>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="analytics-chart-label text-slate-400">Efficiency</span>
                            <span className="text-emerald-400">{data.captainEfficiency.efficiency}%</span>
                          </div>
                          <div className="analytics-bar-track h-2 rounded-full bg-slate-800">
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
