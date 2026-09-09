'use client';

import { useMemo, useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, Zap, DollarSign } from 'lucide-react';

import { simulatePriceDynamics } from '@/lib/fantasy-gameplay';

interface PlayerPriceRecord {
  id: number;
  name: string;
  team: string;
  role: string;
  price: number;
  lastDelta: number;
}

export default function AdminPricingPage() {
  const [players, setPlayers] = useState<PlayerPriceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number>(0);
  const [performanceDelta, setPerformanceDelta] = useState<number>(12);

  useEffect(() => {
    async function loadPricingPlayers() {
      try {
        const res = await fetch('/api/players?limit=50');
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json.data) ? json.data : [];
          const mapped = items.map((p: any) => ({
            id: p.id,
            name: p.in_game_name || p.name,
            team: p.professional_teams?.name || 'Free Agent',
            role: p.primary_role || 'Carry',
            price: p.current_price || 6000000,
            lastDelta: 0,
          }));
          setPlayers(mapped);
          if (mapped.length > 0) {
            setSelectedId(mapped[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load players for pricing', err);
      } finally {
        setLoading(false);
      }
    }
    loadPricingPlayers();
  }, []);

  const selectedPlayer = players.find((player) => player.id === selectedId) ?? players[0];

  const marketSummary = useMemo(() => {
    if (players.length === 0) {
      return { totalValue: 0, averagePrice: 0, biggestGainer: undefined, biggestDrop: undefined };
    }
    const totalValue = players.reduce((sum, player) => sum + player.price, 0);
    const averagePrice = Math.round(totalValue / players.length);
    const biggestGainer = [...players].sort((a, b) => b.lastDelta - a.lastDelta)[0];
    const biggestDrop = [...players].sort((a, b) => a.lastDelta - b.lastDelta)[0];

    return { totalValue, averagePrice, biggestGainer, biggestDrop };
  }, [players]);

  const handleRefresh = () => {
    if (!selectedPlayer) return;

    const result = simulatePriceDynamics(
      selectedPlayer.id,
      selectedPlayer.name,
      selectedPlayer.price,
      performanceDelta,
    );

    setPlayers((current) =>
      current.map((player) =>
        player.id === selectedPlayer.id
          ? {
              ...player,
              price: result.currentPrice,
              lastDelta: result.change,
            }
          : player,
      ),
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Loading player market data...</div>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white"><DollarSign className="h-8 w-8 text-amber-400" />Player Pricing</h1>
          <p className="mt-1 text-gray-400">Manage dynamic player market values and performance-driven adjustments</p>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-12 text-center">
          <p className="text-gray-400">No players found in database. Run the sync-players job to populate players.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white"><DollarSign className="h-8 w-8 text-amber-400" />Player Pricing</h1>
          <p className="mt-1 text-gray-400">Manage dynamic player market values and performance-driven adjustments</p>
        </div>
        <button className="rounded bg-amber-500/20 px-4 py-2 font-medium text-amber-400 hover:bg-amber-500/30">
          Save Price Rules
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Market Value" value={formatMoney(marketSummary.totalValue)} />
        <StatCard label="Avg Price" value={formatMoney(marketSummary.averagePrice)} />
        <StatCard label="Top Gainer" value={marketSummary.biggestGainer?.name || 'None'} />
        <StatCard label="Largest Dip" value={marketSummary.biggestDrop?.name || 'None'} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
          <h2 className="mb-4 text-xl font-semibold text-white">Pricing Watchlist</h2>
          <div className="space-y-3">
            {players.map((player) => {
              const positive = player.lastDelta >= 0;
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => setSelectedId(player.id)}
                  className={`flex w-full items-center justify-between rounded border p-4 text-left transition ${
                    selectedPlayer.id === player.id
                      ? 'border-amber-500/60 bg-amber-500/10'
                      : 'border-gray-700 bg-gray-900/30 hover:border-gray-600'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-white">{player.name}</p>
                      <span className="text-xs text-gray-400">{player.role}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">{player.team}</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Price</p>
                      <p className="font-semibold text-white">{formatMoney(player.price)}</p>
                    </div>
                    <div className={`flex items-center gap-1 rounded px-2 py-1 text-sm font-medium ${positive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {formatMoney(Math.abs(player.lastDelta))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-amber-400" />
            <h2 className="text-xl font-semibold text-white">Price Update</h2>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <p className="text-sm text-gray-400">Selected player</p>
              <p className="mt-1 text-2xl font-bold text-white">{selectedPlayer.name}</p>
              <p className="text-sm text-gray-400">{selectedPlayer.team} • {selectedPlayer.role}</p>
            </div>

            <div className="rounded border border-gray-700 bg-gray-900/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Current price</span>
                <span className="text-lg font-semibold text-white">{formatMoney(selectedPlayer.price)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-gray-400">Latest delta</span>
                <span className={`font-semibold ${selectedPlayer.lastDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {selectedPlayer.lastDelta >= 0 ? '+' : '-'}{formatMoney(Math.abs(selectedPlayer.lastDelta))}
                </span>
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-gray-400">Recent performance delta</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={-20}
                  max={25}
                  value={performanceDelta}
                  onChange={(event) => setPerformanceDelta(Number(event.target.value))}
                  className="w-full accent-amber-500"
                />
                <span className="min-w-12 text-right font-medium text-white">{performanceDelta}</span>
              </div>
            </label>

            <button
              onClick={handleRefresh}
              className="flex w-full items-center justify-center gap-2 rounded bg-amber-500 px-4 py-3 font-medium text-gray-950 transition hover:bg-amber-400"
            >
              <Zap className="h-4 w-4" />
              Recalculate Price
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}
