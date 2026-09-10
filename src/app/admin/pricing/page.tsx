'use client';

import { useMemo, useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, Zap, DollarSign, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { simulatePriceDynamics } from '@/lib/fantasy-gameplay';

interface PlayerPriceRecord {
  id: number;
  name: string;
  team: string;
  role: string;
  price: number;
  lastDelta: number;
}

const ROLES = ['All', 'Carry', 'Mid', 'Offlane', 'Support', 'Hard Support'];
const ROLE_COLOURS: Record<string, string> = {
  Carry:        'bg-red-500/15 text-red-400 border-red-500/30',
  Mid:          'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Offlane:      'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Support:      'bg-teal-500/15 text-teal-400 border-teal-500/30',
  'Hard Support':'bg-purple-500/15 text-purple-400 border-purple-500/30',
};
const ROWS_PER_PAGE = 12;

export default function AdminPricingPage() {
  const [players, setPlayers]                 = useState<PlayerPriceRecord[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [selectedId, setSelectedId]           = useState<number>(0);
  const [performanceDelta, setPerformanceDelta] = useState<number>(12);
  const [jobRunning, setJobRunning]           = useState(false);
  const [jobMessage, setJobMessage]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Watchlist controls
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [page, setPage]             = useState(0);

  useEffect(() => {
    async function loadPricingPlayers() {
      try {
        const res = await fetch('/api/players?limit=100');
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json.data) ? json.data : [];
          const mapped = items.map((p: any) => ({
            id: p.id,
            name: p.in_game_name || p.name,
            team: p.professional_teams?.name || 'Free Agent',
            role: p.primary_role || 'Carry',
            price: p.current_price || 5.5,
            lastDelta: 0,
          }));
          setPlayers(mapped);
          if (mapped.length > 0) setSelectedId(mapped[0].id);
        }
      } catch (err) {
        console.error('Failed to load players for pricing', err);
      } finally {
        setLoading(false);
      }
    }
    loadPricingPlayers();
  }, []);

  const selectedPlayer = players.find((p) => p.id === selectedId) ?? players[0];

  const marketSummary = useMemo(() => {
    if (players.length === 0) return { totalValue: 0, averagePrice: 0, biggestGainer: undefined, biggestDrop: undefined };
    const totalValue    = players.reduce((sum, p) => sum + p.price, 0);
    const averagePrice  = parseFloat((totalValue / players.length).toFixed(1));
    const biggestGainer = [...players].sort((a, b) => b.lastDelta - a.lastDelta)[0];
    const biggestDrop   = [...players].sort((a, b) => a.lastDelta - b.lastDelta)[0];
    return { totalValue, averagePrice, biggestGainer, biggestDrop };
  }, [players]);

  // Filtered + paginated list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return players.filter((p) => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q);
      const matchesRole   = roleFilter === 'All' || p.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [players, search, roleFilter]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginated   = filtered.slice(currentPage * ROWS_PER_PAGE, (currentPage + 1) * ROWS_PER_PAGE);

  const handleRoleFilter = (role: string) => { setRoleFilter(role); setPage(0); };
  const handleSearch     = (v: string)    => { setSearch(v); setPage(0); };

  const handleRefresh = () => {
    if (!selectedPlayer) return;
    const result = simulatePriceDynamics(selectedPlayer.id, selectedPlayer.name, selectedPlayer.price, performanceDelta);
    setPlayers((cur) => cur.map((p) => p.id === selectedPlayer.id ? { ...p, price: result.currentPrice, lastDelta: result.change } : p));
  };

  const triggerPriceUpdate = async () => {
    setJobRunning(true);
    setJobMessage(null);
    try {
      const res  = await fetch('/api/admin/jobs/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobName: 'update-player-prices' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Job failed to start');
      setJobMessage({ type: 'success', text: 'Price update job started successfully.' });
    } catch (err: any) {
      setJobMessage({ type: 'error', text: err.message || 'Failed to trigger job.' });
    } finally {
      setJobRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400 dark:text-gray-400">Loading player market data...</div>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white"><DollarSign className="h-8 w-8 text-amber-400" />Player Pricing</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">Manage dynamic player market values and performance-driven adjustments</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">No players found in database. Run the sync-players job to populate players.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white">
            <DollarSign className="h-8 w-8 text-amber-400" />Player Pricing
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">Manage dynamic player market values and performance-driven adjustments</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={triggerPriceUpdate}
            disabled={jobRunning}
            className="rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition"
          >
            {jobRunning ? 'Starting Job...' : 'Run Price Update Job'}
          </button>
          {jobMessage && (
            <span className={`text-xs ${jobMessage.type === 'success' ? 'text-emerald-500' : 'text-red-400'}`}>
              {jobMessage.text}
            </span>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Market Value"  value={formatMoney(marketSummary.totalValue)} />
        <StatCard label="Avg Price"     value={formatMoney(marketSummary.averagePrice)} />
        <StatCard label="Top Gainer"    value={marketSummary.biggestGainer?.name || 'None'} />
        <StatCard label="Largest Dip"   value={marketSummary.biggestDrop?.name || 'None'} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">

        {/* ── Pricing Watchlist ── */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 flex flex-col overflow-hidden">
          {/* Watchlist header */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Pricing Watchlist</h2>
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search player or team…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 dark:focus:border-amber-500"
              />
            </div>
          </div>

          {/* Role filter pills */}
          <div className="flex gap-2 flex-wrap px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => handleRoleFilter(r)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  roleFilter === r
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-600 dark:text-amber-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 bg-transparent'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-5 py-3 text-left font-medium">Player</th>
                  <th className="px-5 py-3 text-left font-medium hidden md:table-cell">Team</th>
                  <th className="px-5 py-3 text-left font-medium hidden sm:table-cell">Role</th>
                  <th className="px-5 py-3 text-right font-medium">Price</th>
                  <th className="px-5 py-3 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                      No players match your filters.
                    </td>
                  </tr>
                ) : (
                  paginated.map((player) => {
                    const isSelected = selectedPlayer?.id === player.id;
                    const positive   = player.lastDelta >= 0;
                    return (
                      <tr
                        key={player.id}
                        onClick={() => setSelectedId(player.id)}
                        className={`cursor-pointer transition ${
                          isSelected
                            ? 'bg-amber-50 dark:bg-amber-500/10'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                        }`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {isSelected && <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />}
                            <span className={`font-medium ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                              {player.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">{player.team}</td>
                        <td className="px-5 py-3 hidden sm:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${ROLE_COLOURS[player.role] ?? 'text-gray-400 border-gray-600'}`}>
                            {player.role}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-white">{formatMoney(player.price)}</td>
                        <td className="px-5 py-3 text-right">
                          {player.lastDelta === 0 ? (
                            <span className="text-gray-400 text-xs">—</span>
                          ) : (
                            <span className={`inline-flex items-center justify-end gap-0.5 text-xs font-medium ${positive ? 'text-emerald-500' : 'text-red-400'}`}>
                              {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                              {formatMoney(Math.abs(player.lastDelta))}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-900/40">
            <span className="text-xs text-gray-400">
              {filtered.length === 0 ? '0 players' : `${currentPage * ROWS_PER_PAGE + 1}–${Math.min((currentPage + 1) * ROWS_PER_PAGE, filtered.length)} of ${filtered.length}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-1.5 rounded text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400 px-2">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-1.5 rounded text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Price Simulator ── */}
        {selectedPlayer && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6 flex flex-col gap-5 self-start">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-amber-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Price Simulator</h2>
            </div>

            {/* Selected player info */}
            <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Selected</p>
              <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{selectedPlayer.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{selectedPlayer.team} · {selectedPlayer.role}</p>

              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Current price</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{formatMoney(selectedPlayer.price)}</span>
              </div>
              {selectedPlayer.lastDelta !== 0 && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Last simulated Δ</span>
                  <span className={`text-sm font-semibold ${selectedPlayer.lastDelta >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                    {selectedPlayer.lastDelta >= 0 ? '+' : ''}{formatMoney(selectedPlayer.lastDelta)}
                  </span>
                </div>
              )}
            </div>

            {/* Delta slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Performance delta</span>
                <span className={`text-sm font-semibold px-2 py-0.5 rounded ${performanceDelta >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400'}`}>
                  {performanceDelta >= 0 ? '+' : ''}{performanceDelta} pts
                </span>
              </div>
              <input
                type="range"
                min={-20}
                max={25}
                value={performanceDelta}
                onChange={(e) => setPerformanceDelta(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between mt-1 text-xs text-gray-400">
                <span>-20</span>
                <span>0</span>
                <span>+25</span>
              </div>
            </div>

            {/* Action button */}
            <button
              onClick={handleRefresh}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 font-semibold text-gray-950 transition hover:bg-amber-400"
            >
              <Zap className="h-4 w-4" />
              Recalculate Price
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-5">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white truncate">{value}</p>
    </div>
  );
}

function formatMoney(value: number) {
  return `$${Number(value).toFixed(1)}M`;
}
