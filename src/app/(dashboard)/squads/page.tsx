'use client';

import { formatPlayerPrice } from '@/lib/format-price';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import {
  Users,
  LayoutGrid,
  MapPin,
  TrendingDown,
  ArrowRight,
  Wallet,
  History,
  X,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageSkeleton } from '@/components/PageSkeleton';
import { useAccessibleDialog } from '@/components/use-accessible-dialog';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { buildOwnedSquadRoster, type OwnedSquadPlayer } from '@/lib/squad-roster';
import { canOptimizeImage } from '@/lib/optimized-image';
import type { FantasyPlayer as SquadPlayer, LineupEntry } from '@/types/fantasy';

type Gameweek = { id: number; gameweek_number: number; status: string };

type PlayerDetails = SquadPlayer;
type SquadTab = 'squad' | 'history';
type ViewMode = 'grid' | 'pitch';

interface TransferHistoryRecord {
  id: number;
  createdAt: string;
  gameweekNumber: number | null;
  penaltyPoints: number | null;
  budgetImpact: number | null;
  moves: Array<{
    playerOut: string | null;
    playerIn: string | null;
    budgetImpact: number | null;
    netPointsNextThreeGameweeks: number | null;
    scoredGameweeks: number;
    scoringGameweeks: number[];
  }>;
}

interface TransferInsight {
  playerOut: string;
  playerIn: string;
  netPoints: number;
  gameweekNumbers: number[];
}

interface TransferHistoryAnalytics {
  netBudgetChange: number | null;
  pricedTransactions: number;
  totalTransactions: number;
  squadValueHistory: Array<{ gameweekNumber: number; value: number | null }>;
  bestTransfer: TransferInsight | null;
  worstTransfer: TransferInsight | null;
}

const emptyTransferAnalytics: TransferHistoryAnalytics = {
  netBudgetChange: null,
  pricedTransactions: 0,
  totalTransactions: 0,
  squadValueHistory: [],
  bestTransfer: null,
  worstTransfer: null,
};

export default function SquadsPage() {
  const [lineup, setLineup] = useState<LineupEntry[]>([]);
  const [ownedPlayers, setOwnedPlayers] = useState<SquadPlayer[]>([]);
  const [gameweek, setGameweek] = useState<Gameweek | null>(null);
  const [budget, setBudget] = useState<number>(0);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetails | null>(null);
  const playerDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: selectedPlayer !== null,
    onClose: () => setSelectedPlayer(null),
  });
  const [playerLoading, setPlayerLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SquadTab>('squad');
  const [viewMode, setViewMode] = useState<ViewMode>('pitch');

  useEffect(() => {
    if (activeTab !== 'squad') return;

    function handleViewModeShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, [role="textbox"], [role="combobox"]'))
      ) {
        return;
      }

      if (event.key === 'p' || event.key === 'P') {
        event.preventDefault();
        setViewMode('pitch');
      } else if (event.key === 'g' || event.key === 'G') {
        event.preventDefault();
        setViewMode('grid');
      }
    }

    window.addEventListener('keydown', handleViewModeShortcut);
    return () => window.removeEventListener('keydown', handleViewModeShortcut);
  }, [activeTab]);

  const [transferHistory, setTransferHistory] = useState<TransferHistoryRecord[]>([]);
  const [transferAnalytics, setTransferAnalytics] = useState<TransferHistoryAnalytics>(emptyTransferAnalytics);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSquad() {
      try {
        const response = await fetchWithAuth('/api/fantasy/context');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load fantasy squad');

        setOwnedPlayers(Array.isArray(data.ownedPlayers) ? data.ownedPlayers : []);
        setLineup(Array.isArray(data.lineup) ? data.lineup : []);
        setBudget(typeof data.budget === 'number' ? data.budget : 0);
        setGameweek(data.gameweek
          ? {
              id: data.gameweek.id,
              gameweek_number: data.gameweek.gameweekNumber,
              status: data.gameweek.status,
            }
          : null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load fantasy squad');
      } finally {
        setLoading(false);
      }
    }
    fetchSquad();
  }, []);

  const openPlayerDetails = async (playerId: number) => {
    setPlayerLoading(true);
    try {
      const response = await fetchWithAuth(`/api/players/${playerId}`);
      if (!response.ok) throw new Error('Unable to load player details');
      const data = (await response.json()) as { player: PlayerDetails };
      setSelectedPlayer(data.player);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'Unable to load player details');
    } finally {
      setPlayerLoading(false);
    }
  };

  const openTransferHistory = async () => {
    setActiveTab('history');
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetchWithAuth('/api/fantasy/transfer-history');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load transfer history.');
      setTransferHistory(Array.isArray(data.transfers) ? data.transfers : []);
      setTransferAnalytics(data.analytics ?? emptyTransferAnalytics);
    } catch (historyLoadError) {
      setHistoryError(historyLoadError instanceof Error ? historyLoadError.message : 'Failed to load transfer history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const ownedRoster = useMemo(() => buildOwnedSquadRoster(ownedPlayers, lineup), [ownedPlayers, lineup]);
  const gridRoster = useMemo(
    () =>
      [...ownedRoster].sort((a, b) => {
        const priority = (item: (typeof ownedRoster)[number]) =>
          item.lineupEntry?.is_captain ? 0 : item.lineupEntry?.is_vice_captain ? 1 : 2;
        return priority(a) - priority(b);
      }),
    [ownedRoster],
  );

  // Budget calculations
  const squadValue = useMemo(() => {
    return ownedPlayers.reduce((sum, p) => sum + Number(p.current_price || 0), 0);
  }, [ownedPlayers]);
  const totalAccountValue = squadValue + budget;
  const squadValuePercent = totalAccountValue > 0
    ? Math.min(100, Math.max(0, (squadValue / totalAccountValue) * 100))
    : 0;
  const bankPercent = totalAccountValue > 0
    ? Math.min(100 - squadValuePercent, Math.max(0, (budget / totalAccountValue) * 100))
    : 0;

  // Formation grouping for pitch view
  const pitchRoster = useMemo(() => {
    const starters = ownedRoster.filter((item) => item.lineupEntry?.is_starter);
    const bench = ownedRoster.filter((item) => !item.lineupEntry || !item.lineupEntry.is_starter);

    // If no lineup is set yet, derive starters by role
    if (starters.length === 0 && ownedRoster.length > 0) {
      const offlane = ownedRoster.find((r) => r.player.primary_role?.toLowerCase() === 'offlane') || null;
      const mid = ownedRoster.find((r) => r.player.primary_role?.toLowerCase() === 'mid') || null;
      const carry = ownedRoster.find((r) => r.player.primary_role?.toLowerCase() === 'carry') || null;
      const supports = ownedRoster.filter(
        (r) =>
          r.player.primary_role?.toLowerCase().includes('support') &&
          r !== offlane &&
          r !== mid &&
          r !== carry
      );
      const usedIds = new Set([offlane?.player.id, mid?.player.id, carry?.player.id, ...supports.slice(0, 2).map((s) => s.player.id)].filter(Boolean));
      const remainingBench = ownedRoster.filter((r) => !usedIds.has(r.player.id));

      return {
        offlane,
        mid,
        carry,
        pos4: supports[0] || null,
        pos5: supports[1] || null,
        bench: remainingBench,
      };
    }

    const offlane = starters.find((r) => r.lineupEntry?.slot === 'offlane') || starters.find((r) => r.player.primary_role?.toLowerCase() === 'offlane') || null;
    const mid = starters.find((r) => r.lineupEntry?.slot === 'mid') || starters.find((r) => r.player.primary_role?.toLowerCase() === 'mid') || null;
    const carry = starters.find((r) => r.lineupEntry?.slot === 'carry') || starters.find((r) => r.player.primary_role?.toLowerCase() === 'carry') || null;
    const pos4 = starters.find((r) => r.lineupEntry?.slot === 'support') || starters.find((r) => r.player.primary_role?.toLowerCase() === 'support') || null;
    const pos5 = starters.find((r) => r.lineupEntry?.slot === 'hard_support') || starters.find((r) => r.player.primary_role?.toLowerCase() === 'hard support') || null;

    return {
      offlane,
      mid,
      carry,
      pos4,
      pos5,
      bench,
    };
  }, [ownedRoster]);

  // Transfer history summary calculations
  const historySummary = useMemo(() => {
    let totalMoves = 0;
    let totalPenalty = 0;
    const gameweeks = new Set<number>();

    for (const record of transferHistory) {
      totalMoves += record.moves.length;
      if (typeof record.penaltyPoints === 'number' && record.penaltyPoints > 0) {
        totalPenalty += record.penaltyPoints;
      }
      if (record.gameweekNumber !== null) {
        gameweeks.add(record.gameweekNumber);
      }
    }

    return {
      totalTransfers: transferHistory.length,
      totalMoves,
      totalPenalty,
      totalGameweeks: gameweeks.size,
    };
  }, [transferHistory]);


  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header & Quick Actions */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            <Users className="h-7 w-7 text-cyan-400" aria-hidden="true" />
            My Squad
          </h1>
          {loading ? (
            <div>
              <div className="h-5 w-28 rounded-md bg-[var(--surface-muted)] animate-pulse mb-1" />
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                Review your owned players, budget allocation, and gameweek tactical formation.
              </p>
            </div>
          ) : gameweek ? (
            <div>
              <p className="font-semibold text-amber-500">
                {gameweek.status === 'closed' ? 'Last available gameweek' : 'Gameweek'} {gameweek.gameweek_number}
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                Review your owned players, budget allocation, and gameweek tactical formation.
              </p>
            </div>
          ) : (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Review your owned players, budget allocation, and gameweek tactical formation.
            </p>
          )}
        </div>
        <div data-guide="squad-actions" data-tour="squad-actions" className="flex gap-3">
          <Link
            href="/transfers"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
            style={{
              background: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            Make Transfers
          </Link>
          <Link
            href="/lineups"
            className="flex items-center gap-2 rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all hover:from-amber-400 hover:to-orange-500"
          >
            Edit Lineup
          </Link>
        </div>
      </div>

      {/* Budget Visualization Card */}
      <section
        aria-label="Budget Breakdown"
        className="relative mb-8 overflow-hidden rounded-2xl p-5 shadow-sm transition-all sm:p-6"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Top glowing accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: 'linear-gradient(90deg, #06b6d4, #10b981)' }}
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 text-cyan-400"
              style={{ background: 'color-mix(in srgb, #06b6d4 12%, transparent)' }}
            >
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Squad Budget & Valuation</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total allocation across active squad value and bank liquidity</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <span className="block text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Squad Value</span>
              {loading ? (
                <div className="h-6 w-16 mt-1 rounded bg-[var(--surface-muted)] animate-pulse ml-auto" />
              ) : (
                <span className="font-mono text-lg font-bold text-cyan-400">${squadValue.toFixed(1)}M</span>
              )}
            </div>
            <div className="h-8 w-px" style={{ background: 'var(--border)' }} />
            <div>
              <span className="block text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>In Bank</span>
              {loading ? (
                <div className="h-6 w-16 mt-1 rounded bg-[var(--surface-muted)] animate-pulse ml-auto" />
              ) : (
                <span className="font-mono text-lg font-bold text-emerald-400">${budget.toFixed(1)}M</span>
              )}
            </div>
            <div className="h-8 w-px" style={{ background: 'var(--border)' }} />
            <div>
              <span className="block text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Total Account Value</span>
              {loading ? (
                <div className="h-6 w-16 mt-1 rounded bg-[var(--surface-muted)] animate-pulse ml-auto" />
              ) : (
                <span className="font-mono text-lg font-bold" style={{ color: 'var(--text-primary)' }}>${totalAccountValue.toFixed(1)}M</span>
              )}
            </div>
          </div>
        </div>

        {/* Dual Progress Bar */}
        <div className="mt-4">
          <div className="relative h-3 w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }}>
            {loading ? (
              <div className="h-full w-full bg-[var(--surface-muted)] animate-pulse" />
            ) : (
              <>
                <div
                  className="absolute left-0 top-0 h-full bg-linear-to-r from-cyan-600 to-cyan-400 transition-all duration-500"
                  style={{ width: `${squadValuePercent}%` }}
                  title={`Squad Value: $${squadValue.toFixed(1)}M (${squadValuePercent.toFixed(1)}%)`}
                />
                <div
                  className="absolute top-0 h-full bg-linear-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                  style={{ left: `${squadValuePercent}%`, width: `${bankPercent}%` }}
                  title={`In Bank: $${budget.toFixed(1)}M (${bankPercent.toFixed(1)}%)`}
                />
              </>
            )}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            {loading ? (
              <div className="flex items-center gap-4">
                <div className="h-4 w-28 rounded bg-[var(--surface-muted)] animate-pulse" />
                <div className="h-4 w-28 rounded bg-[var(--surface-muted)] animate-pulse" />
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span>Squad: <strong style={{ color: 'var(--text-primary)' }}>${squadValue.toFixed(1)}M</strong></span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Liquid Bank: <strong style={{ color: 'var(--text-primary)' }}>${budget.toFixed(1)}M</strong></span>
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tabs & View Mode Switcher */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex gap-2" role="tablist" aria-label="Squad views">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'squad'}
            onClick={() => setActiveTab('squad')}
            className="border-b-2 px-4 py-3 text-sm font-semibold transition-all cursor-pointer"
            style={{
              borderColor: activeTab === 'squad' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'squad' ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}
          >
            My Squad {loading ? '' : `(${ownedRoster.length}/8)`}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={openTransferHistory}
            className="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all cursor-pointer"
            style={{
              borderColor: activeTab === 'history' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'history' ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}
          >
            <History className="h-4 w-4" />
            Transfer History
          </button>
        </div>

        {activeTab === 'squad' && (
          <div className="flex items-center gap-1.5 pb-2 sm:pb-0">
            <span className="text-xs font-semibold uppercase tracking-wider mr-2" style={{ color: 'var(--text-muted)' }}>Layout:</span>
            <button
              type="button"
              onClick={() => setViewMode('pitch')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer"
              style={{
                background: viewMode === 'pitch' ? 'color-mix(in srgb, #06b6d4 15%, transparent)' : 'var(--surface-raised)',
                color: viewMode === 'pitch' ? '#06b6d4' : 'var(--text-muted)',
                border: `1px solid ${viewMode === 'pitch' ? 'color-mix(in srgb, #06b6d4 40%, transparent)' : 'var(--border)'}`,
              }}
              title="Dota battlefield lane formation (P)"
              aria-keyshortcuts="P"
            >
              <MapPin className="h-3.5 w-3.5" />
              Pitch View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer"
              style={{
                background: viewMode === 'grid' ? 'color-mix(in srgb, #06b6d4 15%, transparent)' : 'var(--surface-raised)',
                color: viewMode === 'grid' ? '#06b6d4' : 'var(--text-muted)',
                border: `1px solid ${viewMode === 'grid' ? 'color-mix(in srgb, #06b6d4 40%, transparent)' : 'var(--border)'}`,
              }}
              title="Compact squad roster grid (G)"
              aria-keyshortcuts="G"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid View
            </button>
          </div>
        )}
      </div>

      {/* Main Content Areas */}
      {activeTab === 'history' ? (
        <section
          role="tabpanel"
          aria-label="Transfer history"
          className="rounded-2xl border p-4 sm:p-6 shadow-sm" style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {/* History Summary Tiles */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border p-3.5" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}>
              <span className="block text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total Transactions</span>
              {historyLoading ? (
                <div className="mt-2 h-6 w-12 rounded bg-[var(--surface-muted)] animate-pulse" />
              ) : (
                <span className="mt-1 block font-mono text-xl font-bold" style={{ color: "var(--text-primary)" }}>{historySummary.totalTransfers}</span>
              )}
            </div>
            <div className="rounded-xl border p-3.5" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}>
              <span className="block text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total Moves</span>
              {historyLoading ? (
                <div className="mt-2 h-6 w-12 rounded bg-[var(--surface-muted)] animate-pulse" />
              ) : (
                <span className="mt-1 block font-mono text-xl font-bold text-cyan-400">{historySummary.totalMoves}</span>
              )}
            </div>
            <div className="rounded-xl border p-3.5" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}>
              <span className="block text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Point Deductions</span>
              {historyLoading ? (
                <div className="mt-2 h-6 w-16 rounded bg-[var(--surface-muted)] animate-pulse" />
              ) : (
                <span className={`mt-1 block font-mono text-xl font-bold ${historySummary.totalPenalty > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {historySummary.totalPenalty > 0 ? `-${historySummary.totalPenalty} pts` : '0 pts'}
                </span>
              )}
            </div>
            <div className="rounded-xl border p-3.5" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}>
              <span className="block text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Active Gameweeks</span>
              {historyLoading ? (
                <div className="mt-2 h-6 w-12 rounded bg-[var(--surface-muted)] animate-pulse" />
              ) : (
                <span className="mt-1 block font-mono text-xl font-bold text-amber-400">{historySummary.totalGameweeks}</span>
              )}
            </div>
          </div>

          <div className="mb-8 grid gap-4 xl:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Net Budget Change
              </span>
              {historyLoading ? (
                <div className="mt-2 space-y-2 animate-pulse">
                  <div className="h-7 w-24 rounded bg-[var(--surface-muted)]" />
                  <div className="h-3.5 w-44 max-w-full rounded bg-[var(--surface-muted)]" />
                </div>
              ) : (
                <>
                  <span className={`mt-1 block font-mono text-2xl font-bold ${
                    transferAnalytics.netBudgetChange === null
                      ? 'text-[var(--text-muted)]'
                      : transferAnalytics.netBudgetChange > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                        : transferAnalytics.netBudgetChange < 0
                      ? 'text-rose-600 dark:text-rose-400'
                          : 'text-[var(--text-primary)]'
                  }`}>
                    {transferAnalytics.netBudgetChange === null
                      ? 'Unavailable'
                      : `${transferAnalytics.netBudgetChange > 0 ? '+$' : transferAnalytics.netBudgetChange < 0 ? '-$' : '$'}${Math.abs(transferAnalytics.netBudgetChange).toFixed(2)}M`}
                  </span>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {transferAnalytics.totalTransactions === 0
                      ? 'No transfer transactions are recorded.'
                      : `Based on ${transferAnalytics.pricedTransactions} of ${transferAnalytics.totalTransactions} fully priced transactions.`}
                  </p>
                </>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 xl:col-span-2">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Owned Squad Value</h3>
                <p className="text-xs text-[var(--text-muted)]">Historical player market value by completed gameweek, excluding bank balance.</p>
              </div>
              {historyLoading ? (
                <div className="h-52 w-full animate-pulse rounded-xl bg-[var(--surface-muted)]" />
              ) : transferAnalytics.squadValueHistory.some((point) => point.value !== null) ? (
                <div className="h-52 w-full" role="img" aria-label="Squad market value history chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={transferAnalytics.squadValueHistory} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="gameweekNumber"
                        tickFormatter={(value: number) => `GW ${value}`}
                        stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border)' }}
                      />
                      <YAxis
                        stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border)' }}
                        tickFormatter={(value: number) => `$${value.toFixed(0)}M`}
                        width={54}
                      />
                      <Tooltip
                        labelFormatter={(value) => `Gameweek ${value}`}
                        formatter={(value) => typeof value === 'number' ? [`$${value.toFixed(1)}M`, 'Squad value'] : ['Unavailable', 'Squad value']}
                    contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.75rem', color: 'var(--text-primary)' }}
                        labelStyle={{ color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--accent-secondary)' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name="Squad value"
                    stroke="var(--accent-secondary)"
                        strokeWidth={2}
                    dot={{ r: 3, fill: 'var(--accent-secondary)', stroke: 'var(--surface)', strokeWidth: 1.5 }}
                    activeDot={{ r: 5, fill: 'var(--accent-secondary)', stroke: 'var(--text-primary)', strokeWidth: 2 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                  Squad value history is unavailable until completed gameweeks have complete player price records.
                </p>
              )}
              {!historyLoading && transferAnalytics.squadValueHistory.some((point) => point.value === null) && (
                <p className="mt-2 text-xs text-[var(--text-muted)]">Gaps indicate missing price or ownership history for that gameweek.</p>
              )}
            </div>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            {[
              { title: 'Best Transfer', insight: transferAnalytics.bestTransfer, positive: true },
              { title: 'Worst Transfer', insight: transferAnalytics.worstTransfer, positive: false },
            ].map(({ title, insight, positive }) => (
              <div key={title} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
                {historyLoading ? (
                  <div className="mt-3 space-y-2.5 animate-pulse">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-20 rounded bg-[var(--surface-muted)]" />
                      <div className="h-3.5 w-3.5 rounded bg-[var(--surface-muted)]" />
                      <div className="h-4 w-20 rounded bg-[var(--surface-muted)]" />
                    </div>
                    <div className="h-6 w-20 rounded bg-[var(--surface-muted)]" />
                    <div className="h-3.5 w-44 max-w-full rounded bg-[var(--surface-muted)]" />
                  </div>
                ) : insight ? (
                  <>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-rose-700 dark:text-rose-300">{insight.playerOut}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
                      <span className="text-emerald-700 dark:text-emerald-300">{insight.playerIn}</span>
                    </p>
                    <p className={`mt-2 font-mono text-lg font-bold ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {insight.netPoints > 0 ? '+' : ''}{insight.netPoints.toFixed(1)} pts
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Net player points over GW {insight.gameweekNumbers.join(', ')}.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    {transferHistory.length === 0
                      ? 'No transfer swaps are recorded yet.'
                      : 'No transfers have a fully completed three-gameweek scoring window yet.'}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mb-4">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Transfer Timeline</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Chronological audit of all player transactions and penalties.</p>
          </div>

          {historyLoading ? (
            <PageSkeleton label="Loading transfer history" className="py-2">
              <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-cyan-500/20">
                <div className="space-y-6">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="relative">
                      <div className="absolute -left-6 sm:-left-8 top-3 h-3 w-3 rounded-full border-2 border-cyan-400/50 bg-[var(--surface)]" />
                      <div
                        className="rounded-xl border p-4 relative overflow-hidden animate-pulse"
                        style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-3">
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-14 rounded-md bg-[var(--surface-muted)]" />
                            <div className="h-4 w-32 rounded bg-[var(--surface-muted)]" />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-24 rounded-md bg-[var(--surface-muted)]" />
                            <div className="h-5 w-28 rounded-md bg-[var(--surface-muted)]" />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="h-7 w-28 rounded-lg bg-[var(--surface-muted)]" />
                          <div className="h-4 w-4 rounded bg-[var(--surface-muted)]" />
                          <div className="h-7 w-28 rounded-lg bg-[var(--surface-muted)]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </PageSkeleton>
          ) : historyError ? (
            <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-200">
              {historyError}
            </p>
          ) : transferHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-12 text-center text-sm text-[var(--text-muted)]">
              No transfer history is recorded yet. Completed transfers will appear here along with their points impact.
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-cyan-500/20">
              <div className="space-y-6">
                {transferHistory.map((transfer) => {
                  const dateStr = new Date(transfer.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div key={transfer.id} className="relative group">
                      {/* Timeline Node Dot */}
                      <div className="absolute -left-6 sm:-left-8 top-3 h-3 w-3 rounded-full border-2 border-cyan-400 bg-[var(--surface)] group-hover:scale-125 transition-transform" />

                      <div className="rounded-xl border p-4 transition-all hover:shadow-md relative overflow-hidden" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}>
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-500 to-emerald-500" />
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-3">
                          <div className="flex items-center gap-2">
                            {transfer.gameweekNumber !== null ? (
                              <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-300">
                                GW {transfer.gameweekNumber}
                              </span>
                            ) : null}
                            <span className="text-xs text-[var(--text-muted)]">{dateStr}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {transfer.penaltyPoints === null ? (
                              <span className="text-xs font-medium text-[var(--text-muted)]">Free move</span>
                            ) : transfer.penaltyPoints > 0 ? (
                              <span className="rounded-md bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-xs font-bold text-rose-300">
                                -{transfer.penaltyPoints} pts penalty
                              </span>
                            ) : (
                              <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                                Free Transfer
                              </span>
                            )}
                            <span className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                              {transfer.budgetImpact === null
                                ? 'Budget impact unavailable'
                                : `Budget ${transfer.budgetImpact > 0 ? '+$' : transfer.budgetImpact < 0 ? '-$' : '$'}${Math.abs(transfer.budgetImpact).toFixed(2)}M`}
                            </span>
                          </div>
                        </div>

                        {/* Moves List */}
                        <div className="space-y-2">
                          {transfer.moves.map((move, idx) => (
                            <div key={idx} className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 text-rose-700 dark:text-rose-300">
                                <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                                <span className="font-medium">{move.playerOut ?? 'Squad addition'}</span>
                              </span>
                              <ArrowRight className="h-4 w-4 text-[var(--text-muted)]" />
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                <span className="font-medium">{move.playerIn ?? 'Squad removal'}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          {error && (
            <div className="mb-8 rounded-lg border border-red-500/50 bg-red-900/50 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {!loading && ownedRoster.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-16 text-center">
              <Users className="mx-auto h-12 w-12 text-[var(--text-muted)] mb-3" />
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Your squad is currently empty</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                Sign 5 core starters and up to 3 bench players to compete in upcoming gameweeks.
              </p>
              <Link
                href="/transfers"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition-colors hover:bg-cyan-500"
              >
                Go to Transfer Market
              </Link>
            </div>
          ) : viewMode === 'pitch' ? (
            /* Dota Tactical Pitch View */
            <section
              data-guide="squad-pitch"
              data-tour="squad-pitch"
              aria-label="Tactical Pitch Formation"
              className="space-y-6"
            >
              {/* Tactical Battlefield */}
              <div
                className="relative overflow-hidden rounded-3xl p-4 shadow-xl sm:p-8 transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                {/* Tactical map background accents */}
                <div className="pointer-events-none absolute inset-0 opacity-10">
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-cyan-400/50 -rotate-12 transform origin-center" />
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-cyan-400/30" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full border border-cyan-400/40" />
                  <div className="absolute top-4 left-4 h-24 w-24 rounded-full border border-amber-500/20" />
                  <div className="absolute bottom-4 right-4 h-24 w-24 rounded-full border border-emerald-500/20" />
                </div>

                <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">
                      Tactical Lane Formation
                    </span>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Starting Five</h2>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      background: 'var(--surface-raised)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    5 Starters on Pitch
                  </span>
                </div>

                {/* Tactical Lanes */}
                <div className="relative z-10 space-y-6">
                  {/* Top Lane: Offlane */}
                  <div className="flex justify-start sm:pl-12">
                    <PitchPlayerSlot
                      roleTitle="Pos 3 · Offlane"
                      roleFilter="Offlane"
                      slotItem={pitchRoster.offlane}
                      onSelect={openPlayerDetails}
                      isLoading={loading}
                    />
                  </div>

                  {/* Mid Lane: Centre */}
                  <div className="flex justify-center">
                    <PitchPlayerSlot
                      roleTitle="Pos 2 · Mid"
                      roleFilter="Mid"
                      slotItem={pitchRoster.mid}
                      onSelect={openPlayerDetails}
                      isLoading={loading}
                    />
                  </div>

                  {/* Dual Support / Roam Lane */}
                  <div className="flex justify-around sm:px-16">
                    <PitchPlayerSlot
                      roleTitle="Pos 4 · Support"
                      roleFilter="Support"
                      slotItem={pitchRoster.pos4}
                      onSelect={openPlayerDetails}
                      isLoading={loading}
                    />
                    <PitchPlayerSlot
                      roleTitle="Pos 5 · Hard Sup."
                      roleFilter="Hard Support"
                      slotItem={pitchRoster.pos5}
                      onSelect={openPlayerDetails}
                      isLoading={loading}
                    />
                  </div>

                  {/* Safe Lane: Carry */}
                  <div className="flex justify-end sm:pr-12">
                    <PitchPlayerSlot
                      roleTitle="Pos 1 · Carry"
                      roleFilter="Carry"
                      slotItem={pitchRoster.carry}
                      onSelect={openPlayerDetails}
                      isLoading={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Bench Dugout */}
              <div
                className="rounded-2xl p-5 sm:p-6 transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Substitutes</span>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Bench Dugout</h3>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {loading ? 'Reserves' : `${pitchRoster.bench.length} Reserves`}
                  </span>
                </div>

                {loading ? (
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                    {[1, 2, 3].map((b) => (
                      <div
                        key={b}
                        className="flex items-center gap-3 rounded-xl p-3 animate-pulse"
                        style={{
                          background: 'var(--surface-raised)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div className="h-11 w-11 shrink-0 rounded-full bg-[var(--surface-muted)]" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="h-2.5 w-14 rounded bg-[var(--surface-muted)]" />
                          <div className="h-3.5 w-24 rounded bg-[var(--surface-muted)]" />
                          <div className="h-2.5 w-16 rounded bg-[var(--surface-muted)]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : pitchRoster.bench.length === 0 ? (
                  <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>No substitutes on the bench.</p>
                ) : (
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                    {pitchRoster.bench.map(({ player, lineupEntry }) => (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => openPlayerDetails(player.id)}
                        className="flex items-center gap-3 rounded-xl p-3 text-left transition-all hover:scale-[1.02] cursor-pointer"
                        style={{
                          background: 'var(--surface-raised)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border"
                          style={{
                            borderColor: 'var(--border)',
                            background: 'var(--surface-muted)',
                          }}
                        >
                          {player.profile_image_url ? (
                            <Image
                              src={player.profile_image_url}
                              alt=""
                              width={44}
                              height={44}
                              unoptimized={!canOptimizeImage(player.profile_image_url)}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                              {(player.in_game_name || player.name || 'P').substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            {lineupEntry?.slot ? lineupEntry.slot.replace('_', ' ') : player.primary_role || 'Bench'}
                          </span>
                          <span className="block truncate text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {player.in_game_name || player.name}
                          </span>
                          <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                            {player.professional_teams?.slug?.toUpperCase() || player.professional_teams?.name || 'Free Agent'}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-semibold text-amber-500 dark:text-amber-400">
                          {formatPlayerPrice(player.current_price)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            /* Roster Card Grid View */
            <section
              data-guide="squad-pitch"
              data-tour="squad-pitch"
              className="rounded-3xl border p-4 shadow-xl sm:p-6"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span
                    data-guide="squad-starters-badge"
                    className="squad-section-label text-xs font-bold uppercase tracking-widest text-cyan-400"
                  >
                    My Squad
                  </span>
                  <h2 className="mt-1 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Squad Roster</h2>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Select a player to view details. Squad ownership is separate from your gameweek lineup.
                  </p>
                </div>
                <div
                  className="rounded-xl border px-3 py-2 text-right"
                  style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
                >
                  <span className="block font-mono text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {loading ? '—' : `${ownedRoster.length}/8`}
                  </span>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Squad players
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {loading ? (
                  [1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                    <div
                      key={item}
                      className="flex min-h-64 w-full flex-col items-center rounded-2xl border p-4 animate-pulse"
                      style={{
                        background: 'var(--surface-raised)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <div className="mb-5 h-4 w-full rounded bg-[var(--surface-muted)]" />
                      <div className="h-20 w-20 rounded-full bg-[var(--surface-muted)]" />
                      <div className="mt-4 h-4 w-3/4 rounded bg-[var(--surface-muted)]" />
                      <div className="mt-2 h-3 w-1/2 rounded bg-[var(--surface-muted)]" />
                      <div className="mt-auto h-10 w-full rounded bg-[var(--surface-muted)]" />
                    </div>
                  ))
                ) : gridRoster.map(({ player, lineupEntry }, index) => {
                  const playerName = player.in_game_name || player.name;
                  const roleLabel = player.primary_role || 'Role unavailable';
                  const isUnavailable = Boolean(
                    player.availability_status && player.availability_status !== 'available',
                  );
                  const lineupStatus = lineupEntry
                    ? lineupEntry.is_starter ? 'Starting five' : 'Bench'
                    : 'Not in lineup';
                  const gameweekLabel = gameweek
                    ? `${gameweek.status === 'closed' ? 'Last' : 'Selected'} GW ${gameweek.gameweek_number}`
                    : 'No current gameweek';

                  return (
                    <button
                      key={player.id}
                      type="button"
                      data-guide={index === 0 ? 'squad-first-player' : undefined}
                      data-tour={index === 0 ? 'squad-first-player' : undefined}
                      onClick={() => openPlayerDetails(player.id)}
                      className="group relative flex min-h-64 w-full flex-col overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      style={{
                        background: 'var(--surface-raised)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <span
                        className="absolute inset-x-0 top-0 h-1 transition-opacity group-hover:opacity-100"
                        style={{
                          background: lineupEntry?.is_captain
                            ? 'linear-gradient(90deg, #f59e0b, #fcd34d)'
                            : lineupEntry?.is_vice_captain
                              ? 'linear-gradient(90deg, #06b6d4, #67e8f9)'
                              : 'var(--accent-primary)',
                          opacity: 0.75,
                        }}
                      />
                      <div className="flex w-full items-center justify-between gap-2 pt-1">
                        <span
                          className="truncate text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: 'var(--accent-primary)' }}
                        >
                          {roleLabel}
                        </span>
                        <span
                          className="shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider"
                          style={{
                            borderColor: lineupEntry?.is_starter
                              ? 'color-mix(in srgb, var(--accent-primary) 35%, transparent)'
                              : 'var(--border)',
                            background: lineupEntry?.is_starter
                              ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)'
                              : 'var(--surface)',
                            color: lineupEntry?.is_starter ? 'var(--accent-primary)' : 'var(--text-muted)',
                          }}
                        >
                          {lineupStatus}
                        </span>
                      </div>

                      <div className="relative mt-5">
                        <div
                          className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 shadow-md transition-transform duration-200 group-hover:scale-105"
                          style={{
                            borderColor: 'var(--accent-primary)',
                            background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
                          }}
                        >
                          {player.profile_image_url ? (
                            <Image
                              src={player.profile_image_url}
                              alt=""
                              width={80}
                              height={80}
                              unoptimized={!canOptimizeImage(player.profile_image_url)}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-lg font-bold" style={{ color: 'var(--accent-primary)' }}>
                              {(playerName || 'P').substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>

                        {lineupEntry?.is_captain && (
                          <span
                            aria-label="Captain (2x Points)"
                            className="absolute right-0 top-0 z-10 flex items-center gap-0.5 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider shadow-md"
                            style={{
                              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                              color: '#ffffff',
                              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.45)',
                            }}
                          >
                            <span>C</span>
                            <span className="text-[8px] font-bold opacity-90">2×</span>
                          </span>
                        )}

                        {lineupEntry?.is_vice_captain && !lineupEntry?.is_captain && (
                          <span
                            aria-label="Vice-captain"
                            className="absolute right-0 top-0 z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[9px] font-black shadow-md"
                            style={{
                              background: 'linear-gradient(135deg, #06b6d4, #0284c7)',
                              color: '#ffffff',
                              boxShadow: '0 2px 6px rgba(6, 182, 212, 0.35)',
                            }}
                          >
                            V
                          </span>
                        )}
                      </div>

                      <div className="mt-3 w-full min-w-0 text-center">
                        <span className="block truncate text-base font-bold transition-colors group-hover:text-cyan-500" style={{ color: 'var(--text-primary)' }} title={playerName}>
                          {playerName}
                        </span>
                        <span className="block truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                          {player.professional_teams?.slug?.toUpperCase() ||
                            player.professional_teams?.name ||
                            'Free Agent'}
                        </span>
                        <span className="mt-1 block text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                          {gameweekLabel} · {lineupEntry ? lineupEntry.slot.replace('_', ' ') : 'Squad ownership'}
                        </span>
                      </div>

                      <div className="mt-auto flex w-full items-center justify-between gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <span className="block text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Price</span>
                          <span className="font-mono text-sm font-bold text-amber-500 dark:text-amber-400">
                            {formatPlayerPrice(player.current_price)}
                          </span>
                        </div>
                        <span
                          title={player.availability_reason || undefined}
                          className="max-w-[55%] truncate rounded-full border px-2 py-1 text-[9px] font-semibold capitalize"
                          style={{
                            background: isUnavailable
                              ? 'color-mix(in srgb, #f43f5e 10%, transparent)'
                              : 'color-mix(in srgb, #10b981 10%, transparent)',
                            borderColor: isUnavailable
                              ? 'color-mix(in srgb, #f43f5e 30%, transparent)'
                              : 'color-mix(in srgb, #10b981 30%, transparent)',
                            color: isUnavailable ? '#fb7185' : '#34d399',
                          }}
                        >
                          {player.availability_status || 'Available'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* Loading overlay for player details */}
      {playerLoading && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="status" aria-label="Loading player details">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl animate-pulse">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-[var(--surface-raised)]" />
                <div className="space-y-2">
                  <div className="h-4 w-20 rounded-full bg-[var(--surface-raised)]" />
                  <div className="h-7 w-40 rounded-lg bg-[var(--surface-raised)]" />
                  <div className="h-3.5 w-32 rounded bg-[var(--surface-raised)]" />
                </div>
              </div>
              <div className="h-9 w-9 rounded-xl bg-[var(--surface-raised)]" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-3.5">
                  <div className="h-2.5 w-16 rounded bg-[var(--surface)] mb-2" />
                  <div className="h-6 w-12 rounded bg-[var(--surface)]" />
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] p-5">
              <div className="h-4 w-36 rounded bg-[var(--surface)] mb-4" />
              <div className="h-32 w-full rounded-xl bg-[var(--surface)]" />
            </div>
          </div>
        </div>
      )}

      {/* Player details modal */}
      {selectedPlayer && (
        <div
          ref={playerDialogRef}
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="squad-player-title"
          tabIndex={-1}
          onClick={() => setSelectedPlayer(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-6 shadow-2xl"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-cyan-400">Player Details</p>
                <h2 id="squad-player-title" className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {selectedPlayer.in_game_name || selectedPlayer.name}
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {selectedPlayer.professional_teams?.name || 'Free Agent'} ·{' '}
                  {selectedPlayer.primary_role || 'Role unavailable'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlayer(null)}
                aria-label="Close player details"
                className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border p-3" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}>
                <p className="text-xs text-[var(--text-muted)]">Price</p>
                <p className="mt-1 font-mono font-bold text-amber-400">
                  {formatPlayerPrice(selectedPlayer.current_price)}
                </p>
              </div>
              <div className="rounded-xl border p-3" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}>
                <p className="text-xs text-[var(--text-muted)]">Season Points</p>
                <p className="mt-1 font-bold" style={{ color: "var(--text-primary)" }}>{selectedPlayer.total_season_points ?? 0}</p>
              </div>
              <div className="rounded-xl border p-3" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}>
                <p className="text-xs text-[var(--text-muted)]">Last GW</p>
                <p className="mt-1 font-bold" style={{ color: "var(--text-primary)" }}>{selectedPlayer.last_gw_points ?? 0}</p>
              </div>
              <div className="rounded-xl border p-3" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}>
                <p className="text-xs text-[var(--text-muted)]">Availability</p>
                <p className="mt-1 text-sm font-semibold capitalize text-emerald-400">
                  {selectedPlayer.availability_status || 'Unknown'}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-[var(--text-secondary)]">Recent Performances</h3>
              {selectedPlayer.performances?.length ? (
                <div className="space-y-2">
                  {selectedPlayer.performances.slice(0, 5).map((performance) => (
                    <div
                      key={performance.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 text-sm"
                    >
                      <span className="text-[var(--text-primary)]">GW {performance.gameweek_id}</span>
                      <span className="text-[var(--text-secondary)]">
                        {performance.kills}/{performance.deaths}/{performance.assists}
                      </span>
                      <span className="font-semibold text-cyan-400">
                        {performance.fantasy_points_breakdown?.total_points ?? 0} pts
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No performance data available yet.</p>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Link
                href={`/transfers?playerOutId=${selectedPlayer.id}`}
                onClick={() => setSelectedPlayer(null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Transfer Out
              </Link>
              <Link
                href={`/players/${selectedPlayer.id}`}
                onClick={() => setSelectedPlayer(null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-500/20 dark:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                View Full Player Profile
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Component for an individual slot node on the Tactical Pitch View
 */
function PitchPlayerSlot({
  roleTitle,
  roleFilter,
  slotItem,
  onSelect,
  isLoading = false,
}: {
  roleTitle: string;
  roleFilter: string;
  slotItem: OwnedSquadPlayer | null;
  onSelect: (playerId: number) => void;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div
        className="w-48 sm:w-56 rounded-2xl border p-3 flex items-center gap-3 animate-pulse"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface-raised)',
        }}
      >
        <div className="h-12 w-12 shrink-0 rounded-full bg-[var(--surface-muted)]" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
            {roleTitle}
          </span>
          <div className="h-3.5 w-24 rounded bg-[var(--surface-muted)]" />
          <div className="h-2.5 w-16 rounded bg-[var(--surface-muted)]" />
        </div>
      </div>
    );
  }

  if (!slotItem) {
    return (
      <Link
        href={`/transfers?role=${encodeURIComponent(roleFilter)}`}
        aria-label={`Add a ${roleFilter} player from the Transfer Market`}
        className="group flex w-48 sm:w-56 items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-raised)]/60 p-3 text-left transition-all hover:border-cyan-500/60 hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-cyan-500/40 bg-cyan-500/10 text-cyan-700 transition-colors group-hover:border-cyan-500 group-hover:text-cyan-600 dark:text-cyan-300">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{roleTitle}</span>
          <span className="mt-1 block text-xs font-semibold text-cyan-700 dark:text-cyan-300">Vacant · Add player</span>
        </span>
      </Link>
    );
  }

  const { player, lineupEntry } = slotItem;
  const playerName = player.in_game_name || player.name;
  const initials = (playerName || 'P').substring(0, 2).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onSelect(player.id)}
      className="group relative flex w-48 sm:w-56 items-center gap-3 rounded-2xl p-3 text-left shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Avatar + Captain Badge */}
      <div className="relative">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 shadow-md"
          style={{
            borderColor: 'var(--accent-primary)',
            background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
          }}
        >
          {player.profile_image_url ? (
            <Image
              src={player.profile_image_url}
              alt=""
              width={48}
              height={48}
              unoptimized={!canOptimizeImage(player.profile_image_url)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs font-bold" style={{ color: 'var(--accent-primary)' }}>
              {initials}
            </span>
          )}
        </div>

        {lineupEntry?.is_captain && (
          <span
            aria-label="Captain (2x Points)"
            className="absolute -top-1.5 -left-1.5 z-10 flex items-center gap-0.5 rounded-full px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider shadow-md"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.45)',
            }}
          >
            <span>C</span>
            <span className="text-[8px] font-bold opacity-90">2×</span>
          </span>
        )}

        {lineupEntry?.is_vice_captain && !lineupEntry?.is_captain && (
          <span
            aria-label="Vice-captain"
            className="absolute -top-1.5 -left-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black shadow-md"
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #0284c7)',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(6, 182, 212, 0.35)',
            }}
          >
            V
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <span className="block whitespace-nowrap text-[8px] font-bold uppercase leading-tight tracking-normal" style={{ color: 'var(--accent-primary)' }}>
          {roleTitle}
        </span>
        <span
          className="block truncate text-sm font-bold transition-colors group-hover:text-cyan-500"
          style={{ color: 'var(--text-primary)' }}
          title={playerName}
        >
          {playerName}
        </span>
        <span className="block truncate text-xs" style={{ color: 'var(--text-muted)' }}>
          {player.professional_teams?.name || 'Free Agent'}
        </span>
      </div>

      <div className="text-right">
        <span className="block font-mono text-xs font-bold text-amber-500 dark:text-amber-400">
          {formatPlayerPrice(player.current_price)}
        </span>
      </div>
    </button>
  );
}
