'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserCheck,
  ArrowLeftRight,
  Trophy,
  UserRound,
  Users,
  DollarSign,
  Wallet,
  BarChart3,
  Zap,
  Megaphone,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  Shield,
  Info,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';
import type { DashboardData } from '@/types/fantasy';
import { PlayerDetailModal, type PlayerDetails } from '@/app/(dashboard)/squads/components/PlayerDetailModal';
import { TotalPointsModal } from './components/TotalPointsModal';

interface StatCard {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  trendColor?: string;
}

interface WhatsNewEvent {
  kind: 'tournament';
  id: number;
  title: string;
  startedAt: string;
  href: string;
  tier?: string | null;
  seriesCount?: number;
  matchCount?: number;
  bestOfFormats?: number[];
  deadline?: string | null;
  matchStatuses?: Record<string, number>;
}

interface WhatsNewGameweek {
  id: number;
  number: number;
  status: string;
  startsAt: string;
  isCurrent: boolean;
  endsSoon: boolean;
  deadline: string;
  matchCount: number;
  matchStatuses: Record<string, number>;
  href: string;
}

interface WhatsNewUpdate {
  id: number;
  kind: 'price_change' | 'availability';
  title: string;
  message: string;
  createdAt: string;
  href: string;
}

interface WhatsNewData {
  events: WhatsNewEvent[];
  gameweek: WhatsNewGameweek | null;
  updates: WhatsNewUpdate[];
}

type WhatsNewTab = 'tournaments' | 'players';

function useCountdown(targetDateStr: string | null | undefined): string {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!targetDateStr) { setLabel(''); return; }
    const tick = () => {
      const diff = new Date(targetDateStr).getTime() - Date.now();
      if (diff <= 0) { setLabel('Deadline passed'); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      if (h > 48) {
        const d = Math.floor(h / 24);
        setLabel(`${d}d ${h % 24}h`);
      } else if (h > 0) {
        setLabel(`${h}h ${m}m`);
      } else {
        setLabel(`${m}m ${s}s`);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDateStr]);
  return label;
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatCard[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetails | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [showPointsBreakdown, setShowPointsBreakdown] = useState(false);
  const [whatsNew, setWhatsNew] = useState<WhatsNewData | null>(null);
  const [whatsNewError, setWhatsNewError] = useState<string | null>(null);
  const [whatsNewTab, setWhatsNewTab] = useState<WhatsNewTab>('tournaments');
  const [tournamentsExpanded, setTournamentsExpanded] = useState(false);
  const [playersExpanded, setPlayersExpanded] = useState(false);

  const openPlayerDetails = async (playerId: number) => {
    setPlayerLoading(true);
    try {
      const response = await fetchWithAuth(`/api/players/${playerId}`);
      if (!response.ok) throw new Error('Unable to load player details');
      const data = (await response.json()) as { player: PlayerDetails };
      setSelectedPlayer(data.player);
    } catch (detailError) {
      toast.error(detailError instanceof Error ? detailError.message : 'Unable to load player details');
    } finally {
      setPlayerLoading(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetchWithAuth('/api/dashboard/stats');
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          if (res.status === 401) { router.push('/login'); return; }
          throw new Error(errBody?.error || `Failed to fetch stats (${res.status})`);
        }
        const data = (await res.json()) as DashboardData;
        setDashboardData(data);
        
        setStats([
          {
            icon: <Users className="w-5 h-5 text-cyan-400" />,
            label: 'Active Squads',
            value: data.activeSquadCount || 0,
            trend: data.activeSquadCount > 0 ? 'Ready' : 'Create one',
            trendColor: data.activeSquadCount > 0 ? 'text-green-500' : 'text-amber-500',
          },
          {
            icon: <DollarSign className="w-5 h-5 text-emerald-400" />,
            label: 'Squad Value',
            value: `${Number(data.squadValue || 0).toFixed(1)}M`,
            trend: 'Current squad',
            trendColor: 'text-slate-400',
          },
          {
            icon: <Wallet className="w-5 h-5 text-amber-400" />,
            label: 'Bank Balance',
            value: `${Number(data.bankBalance || 0).toFixed(1)}M`,
            trend: 'Available budget',
            trendColor: 'text-amber-500',
          },
          {
            icon: <Trophy className="w-5 h-5 text-yellow-400" />,
            label: 'Total Points',
            value: data.totalPoints || 0,
            trend: 'Overall',
            trendColor: 'text-slate-400',
          },
          {
            icon: <BarChart3 className="w-5 h-5 text-teal-400" />,
            label: 'Global Rank',
            value: data.globalRank || '-',
            trend: data.globalRank ? 'Active' : 'Unranked',
            trendColor: data.globalRank ? 'text-green-500' : 'text-slate-400',
          },
          {
            icon: <Zap className="w-5 h-5 text-orange-400" />,
            label: 'Free Transfers',
            value: data.freeTransfers || 0,
            trend: 'Ready to use',
            trendColor: 'text-amber-500',
          },
        ]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error fetching dashboard stats';
        setError(msg);
        toast.error('Load Error', msg);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, [router, toast]);

  useEffect(() => {
    let cancelled = false;

    const fetchWhatsNew = async () => {
      try {
        const response = await fetchWithAuth('/api/dashboard/whats-new');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Failed to load What's New (${response.status})`);
        }
        if (!cancelled) {
          setWhatsNew(data as WhatsNewData);
          setWhatsNewError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setWhatsNewError(err instanceof Error ? err.message : 'Unable to load What’s New.');
        }
      }
    };

    void fetchWhatsNew();
    const intervalId = window.setInterval(() => void fetchWhatsNew(), 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const countdown = useCountdown(whatsNew?.gameweek?.deadline);

  const formatUtcDate = (date: string) =>
    new Intl.DateTimeFormat('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(date));

  const describeMatchStatuses = (statuses: Record<string, number>) => {
    const labels: Record<string, string> = {
      scheduled: 'scheduled',
      in_progress: 'live',
      completed: 'completed',
      cancelled: 'cancelled',
      postponed: 'postponed',
    };
    return Object.entries(statuses)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => `${count} ${labels[status] ?? status.replaceAll('_', ' ')}`)
      .join(' · ');
  };

  return (
    <div className="dashboard-page min-h-screen">
      {/* Hero Section */}
      <section className="dashboard-hero bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 py-12 px-4">
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

          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

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
            <div data-guide="dashboard-stats" data-tour="dashboard-stats" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {stats.map((stat, idx) => (
                stat.label === 'Squad Value' ? (
                  <Link
                    key={idx}
                    href="/squads"
                    aria-label={`Squad Value: ${stat.value}. Go to squads`}
                    className="group w-full rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-left transition-all hover:border-emerald-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/60 p-2.5 transition-colors group-hover:border-emerald-500/40">
                        {stat.icon}
                      </div>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 text-slate-500 transition-all group-hover:translate-x-1 group-hover:text-emerald-300" />
                    </div>
                    <p className="mb-1 text-sm text-slate-400">{stat.label}</p>
                    <p className="mb-2 text-2xl font-bold text-white">{stat.value}</p>
                    {stat.trend && <p className={`text-xs ${stat.trendColor}`}>{stat.trend} · View squads</p>}
                  </Link>
                ) : stat.label === 'Total Points' ? (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setShowPointsBreakdown(true)}
                    aria-haspopup="dialog"
                    aria-expanded={showPointsBreakdown}
                    className="w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-left transition-all group hover:border-amber-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/60 p-2.5 transition-colors group-hover:border-amber-500/40">
                        {stat.icon}
                      </div>
                      <Info aria-hidden="true" className="h-4 w-4 text-slate-500 transition-colors group-hover:text-amber-300" />
                    </div>
                    <p className="mb-1 text-sm text-slate-400">{stat.label}</p>
                    <p className="mb-2 text-2xl font-bold text-white">{stat.value}</p>
                    {stat.trend && <p className={`text-xs ${stat.trendColor}`}>{stat.trend} · View breakdown</p>}
                  </button>
                ) : (
                  <div
                    key={idx}
                    className="group rounded-lg border border-slate-700 bg-slate-800/50 p-4 transition-all hover:border-slate-600"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/60 p-2.5 transition-colors group-hover:border-slate-600">
                        {stat.icon}
                      </div>
                    </div>
                    <p className="mb-1 text-sm text-slate-400">{stat.label}</p>
                    <p className="mb-2 text-2xl font-bold text-white">{stat.value}</p>
                    {stat.trend && <p className={`text-xs ${stat.trendColor}`}>{stat.trend}</p>}
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        {whatsNew && (whatsNew.events.length > 0 || whatsNew.gameweek || whatsNew.updates.length > 0) && (
          <section className="wn-panel" aria-labelledby="whats-new-heading">
            {/* ── Header ── */}
            <div className="wn-header">
              <div className="wn-header-left">
                <span className="wn-heading-icon" aria-hidden="true">
                  <Megaphone className="h-5 w-5" />
                </span>
                <h3 id="whats-new-heading" className="wn-title">What&apos;s New</h3>
                <span className="wn-live-badge">
                  <span className="wn-live-dot" aria-hidden="true" />
                  <span className="wn-live-ring" aria-hidden="true" />
                  Live
                </span>
              </div>
              {whatsNew.gameweek && countdown && (
                <div className="wn-countdown" aria-label={`Deadline in ${countdown}`}>
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="wn-countdown-label">Deadline in</span>
                  <span className="wn-countdown-value">{countdown}</span>
                </div>
              )}
            </div>

            {/* ── Gameweek — always visible, above the tabs ── */}
            {whatsNew.gameweek && (
              <div className="wn-gw-strip">
                <Link href={whatsNew.gameweek.href} className="wn-gw-card group">
                  {/* Row 1: icon + label + GW number + match meta + urgency */}
                  <div className="wn-gw-row1">
                    <span className="wn-icon-bubble wn-icon-bubble--gw">
                      <Calendar className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="wn-gw-label">
                      {whatsNew.gameweek.isCurrent ? 'Current' : 'Next'} Gameweek
                    </span>
                    <span className="wn-gw-number">GW {whatsNew.gameweek.number}</span>
                    <span className="wn-gw-dot" aria-hidden="true">·</span>
                    <span className="wn-gw-meta">
                      {whatsNew.gameweek.matchCount} matches
                      {describeMatchStatuses(whatsNew.gameweek.matchStatuses) && (
                        <> · {describeMatchStatuses(whatsNew.gameweek.matchStatuses)}</>
                      )}
                    </span>
                    {whatsNew.gameweek.endsSoon && (
                      <span className="wn-urgency-badge">⚡ Ends soon</span>
                    )}
                  </div>
                  {/* Row 2: deadline + CTA */}
                  <div className="wn-gw-row2">
                    <span className="wn-gw-deadline-inline">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      Deadline: {formatUtcDate(whatsNew.gameweek.deadline)} UTC
                    </span>
                    <span className="wn-gw-cta">
                      View details
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </div>
            )}

            {/* ── Tabs (Tournaments & Player Updates only) ── */}
            {(whatsNew.events.length > 0 || whatsNew.updates.length > 0) && (
              <>
                <div className="wn-tabs" role="tablist" aria-label="Recent updates">
                  {whatsNew.events.length > 0 && (
                    <button
                      role="tab"
                      id="wn-tab-tournaments"
                      aria-controls="wn-panel-tournaments"
                      aria-selected={whatsNewTab === 'tournaments'}
                      className={`wn-tab ${whatsNewTab === 'tournaments' ? 'wn-tab--active' : ''}`}
                      onClick={() => setWhatsNewTab('tournaments')}
                    >
                      <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                      Tournaments
                      <span className="wn-tab-badge wn-tab-badge--tournament">{whatsNew.events.length}</span>
                    </button>
                  )}
                  {whatsNew.updates.length > 0 && (
                    <button
                      role="tab"
                      id="wn-tab-players"
                      aria-controls="wn-panel-players"
                      aria-selected={whatsNewTab === 'players'}
                      className={`wn-tab ${whatsNewTab === 'players' ? 'wn-tab--active' : ''}`}
                      onClick={() => setWhatsNewTab('players')}
                    >
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                      Player Updates
                      <span className="wn-tab-badge wn-tab-badge--player">{whatsNew.updates.length}</span>
                    </button>
                  )}
                </div>

                {/* ── Tournaments panel ── */}
                {whatsNew.events.length > 0 && (
                  <div
                    role="tabpanel"
                    id="wn-panel-tournaments"
                    aria-labelledby="wn-tab-tournaments"
                    hidden={whatsNewTab !== 'tournaments'}
                    className="wn-tab-content"
                  >
                    <div className="wn-list">
                      {(tournamentsExpanded
                        ? whatsNew.events
                        : whatsNew.events.slice(0, 4)
                      ).map((event) => (
                        <Link
                          href={event.href}
                          key={`tournament-${event.id}`}
                          className="wn-row wn-row--tournament group"
                        >
                          <span className="wn-icon-bubble wn-icon-bubble--tournament">
                            <Trophy className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <div className="wn-row-body">
                            <span className="wn-row-type">Tournament active</span>
                            <span className="wn-row-title">{event.title}</span>
                            <span className="wn-row-detail">
                              {[event.tier, `${event.seriesCount ?? 0} series`, `${event.matchCount ?? 0} matches`,
                                ...(event.bestOfFormats && event.bestOfFormats.length > 0
                                  ? [`Bo${event.bestOfFormats.join(' / Bo')}`]
                                  : [])]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </div>
                          <ArrowRight aria-hidden="true" className="wn-row-arrow h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
                        </Link>
                      ))}
                      {whatsNew.events.length > 4 && (
                        <button
                          type="button"
                          className="wn-more-btn"
                          onClick={() => setTournamentsExpanded((prev) => !prev)}
                        >
                          {tournamentsExpanded ? (
                            <>
                              <span>Show less</span>
                              <ChevronUp className="h-4 w-4" aria-hidden="true" />
                            </>
                          ) : (
                            <>
                              <span>Show {whatsNew.events.length - 4} more tournaments</span>
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Player Updates panel ── */}
                {whatsNew.updates.length > 0 && (
                  <div
                    role="tabpanel"
                    id="wn-panel-players"
                    aria-labelledby="wn-tab-players"
                    hidden={whatsNewTab !== 'players'}
                    className="wn-tab-content"
                  >
                    <div className="wn-list">
                      {(playersExpanded
                        ? whatsNew.updates
                        : whatsNew.updates.slice(0, 4)
                      ).map((update) => {
                        const isAvailability = update.kind === 'availability';
                        const UpdateIcon = isAvailability ? AlertTriangle : TrendingUp;
                        return (
                          <Link
                            href={update.href}
                            key={`${update.kind}-${update.id}`}
                            className={`wn-row group ${isAvailability ? 'wn-row--availability' : 'wn-row--price'}`}
                          >
                            <span className={`wn-icon-bubble ${isAvailability ? 'wn-icon-bubble--availability' : 'wn-icon-bubble--price'}`}>
                              <UpdateIcon className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="wn-row-body">
                              <span className="wn-row-type">
                                {isAvailability ? 'Squad availability' : 'Player price'}
                              </span>
                              <span className="wn-row-title">{update.title}</span>
                              <span className="wn-row-detail">{update.message}</span>
                            </div>
                            <ArrowRight aria-hidden="true" className="wn-row-arrow h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
                          </Link>
                        );
                      })}
                      {whatsNew.updates.length > 4 && (
                        <button
                          type="button"
                          className="wn-more-btn"
                          onClick={() => setPlayersExpanded((prev) => !prev)}
                        >
                          {playersExpanded ? (
                            <>
                              <span>Show less</span>
                              <ChevronUp className="h-4 w-4" aria-hidden="true" />
                            </>
                          ) : (
                            <>
                              <span>Show {whatsNew.updates.length - 4} more updates</span>
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}
        {whatsNewError && (
          <div role="status" className="mb-8 rounded-xl border border-rose-500/30 bg-rose-950/30 px-5 py-4 text-sm text-rose-200">
            What&apos;s New could not be loaded: {whatsNewError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Primary Actions */}
          <div className="lg:col-span-2">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-6">Quick Actions</h2>
              <div data-guide="dashboard-actions" data-tour="dashboard-actions" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                  href="/lineups"
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-amber-500/50 hover:bg-slate-800 transition-all group"
                >
                  <div className="mb-3 text-amber-400 group-hover:scale-110 transition-transform inline-block">
                    <UserCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-amber-500">
                    Set Lineup
                  </h3>
                  <p className="text-slate-400 text-sm">Choose your starting XI and captain</p>
                </Link>

                <Link
                  href="/transfers"
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-amber-500/50 hover:bg-slate-800 transition-all group"
                >
                  <div className="mb-3 text-amber-400 group-hover:scale-110 transition-transform inline-block">
                    <ArrowLeftRight className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-amber-500">
                    Transfer Market
                  </h3>
                  <p className="text-slate-400 text-sm">Buy and sell players to optimize squad</p>
                </Link>

                <Link
                  href="/leagues"
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-amber-500/50 hover:bg-slate-800 transition-all group"
                >
                  <div className="mb-3 text-amber-400 group-hover:scale-110 transition-transform inline-block">
                    <Trophy className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-amber-500">
                    Leagues
                  </h3>
                  <p className="text-slate-400 text-sm">View leagues and compete with friends</p>
                </Link>

                <Link
                  href="/players"
                  className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:border-amber-500/50 hover:bg-slate-800 transition-all group"
                >
                  <div className="mb-3 text-amber-400 group-hover:scale-110 transition-transform inline-block">
                    <UserRound className="w-8 h-8" />
                  </div>
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
                <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-500">
                  <Shield className="w-8 h-8" />
                </div>
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
              <div className="rounded-2xl p-5 shadow-sm"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

                {/* Panel header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 mb-5"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                        style={{ background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)' }}>
                        <Shield className="h-4 w-4" style={{ color: 'var(--accent-primary)' }} />
                      </div>
                      <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                        {dashboardData.squadName || 'Active Squad'}
                      </h3>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)' }}>
                        Active
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Gameweek {dashboardData.gameweek?.gameweek_number || 1} &nbsp;&middot;&nbsp; 5 Starters &nbsp;&middot;&nbsp; Squad Value: ${Number(dashboardData.squadValue || 0).toFixed(1)}M
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href="/lineups"
                      className="rounded-xl px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
                      style={{ background: 'var(--accent-primary)' }}
                    >
                      Edit Lineup
                    </Link>
                    <Link
                      href="/squads"
                      className="rounded-xl px-3.5 py-1.5 text-xs font-semibold transition hover:opacity-80"
                      style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                    >
                      Full Squad
                    </Link>
                  </div>
                </div>

                {/* Section label */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                      Starting Five
                    </span>
                    {dashboardData.starters && dashboardData.starters.some(s => s.gw_points != null) && (
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                        style={{ background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)', color: 'var(--accent-primary)', border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)' }}>
                        Live Scores
                      </span>
                    )}
                  </div>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {dashboardData.starters && dashboardData.starters.length > 0
                      ? `${dashboardData.starters.length} / 5 set`
                      : 'Not configured'}
                  </span>
                </div>

                {dashboardData.starters && dashboardData.starters.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[...dashboardData.starters].sort((a, b) => {
                      const getRank = (p: typeof a) => {
                        if (p.is_captain) return 0;
                        if (p.is_vice_captain) return 1;
                        return 2;
                      };
                      return getRank(a) - getRank(b);
                    }).map((player) => {
                      const roleColours: Record<string, { bg: string; text: string; border: string }> = {
                        carry:        { bg: 'rgba(251,113,133,0.12)', text: '#fb7185', border: 'rgba(251,113,133,0.28)' },
                        mid:          { bg: 'rgba(251,191,36,0.12)',  text: '#f59e0b', border: 'rgba(251,191,36,0.28)' },
                        offlane:      { bg: 'rgba(52,211,153,0.12)',  text: '#34d399', border: 'rgba(52,211,153,0.28)' },
                        support:      { bg: 'rgba(96,165,250,0.12)',  text: '#60a5fa', border: 'rgba(96,165,250,0.28)' },
                        hard_support: { bg: 'rgba(167,139,250,0.12)', text: '#a78bfa', border: 'rgba(167,139,250,0.28)' },
                      };
                      const rc = roleColours[player.slot] ?? { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8', border: 'rgba(148,163,184,0.28)' };
                      const displayName = player.in_game_name || player.name;
                      const initials = displayName.substring(0, 2).toUpperCase();
                      const roleLabel = player.slot.replace('_', ' ');

                      return (
                        <div
                          key={`${player.slot}-${player.id}`}
                          onClick={() => openPlayerDetails(player.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openPlayerDetails(player.id);
                            }
                          }}
                          className="relative flex flex-col rounded-2xl overflow-visible transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:z-20 cursor-pointer select-none"
                          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
                        >
                          {/* Role-coloured top accent bar */}
                          <div className="h-0.75 w-full rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${rc.text}, transparent)` }} />

                          {/* Captain / VC badge */}
                          {player.is_captain && (
                            <span className="absolute -top-2 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black shadow-md"
                              style={{ background: 'var(--accent-primary)', color: 'var(--background)' }}>
                              C
                            </span>
                          )}
                          {player.is_vice_captain && (
                            <span className="absolute -top-2 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black shadow-md"
                              style={{ background: 'var(--accent-secondary)', color: 'var(--background)' }}>
                              V
                            </span>
                          )}

                          <div className="flex flex-col gap-2 p-3 flex-1">
                            {/* Avatar */}
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden text-sm font-black"
                              style={{ background: rc.bg, border: `1px solid ${rc.border}`, color: rc.text }}>
                              {player.profile_image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={player.profile_image_url}
                                  alt={displayName}
                                  className="h-full w-full object-cover object-top"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    (e.currentTarget.nextSibling as HTMLElement | null)?.removeAttribute('hidden');
                                  }}
                                />
                              ) : null}
                              <span hidden={!!player.profile_image_url}>{initials}</span>
                            </div>

                            {/* Player name + team */}
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-bold leading-snug"
                                style={{ color: 'var(--text-primary)' }}
                                title={displayName}>
                                {displayName}
                              </p>
                              <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                {player.team_name || 'Free Agent'}
                              </p>
                            </div>

                            {/* Role pill on its own row (tightened spacing) */}
                            <div>
                              <span className="inline-block rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide leading-none"
                                style={{ background: rc.bg, border: `1px solid ${rc.border}`, color: rc.text }}>
                                {roleLabel}
                              </span>
                            </div>
                          </div>

                          {/* Footer — always same structure: GW pts row + price row */}
                          <div className="mt-auto px-3 pb-3">
                            <div className="relative group/tooltip rounded-xl px-2.5 py-2"
                              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>

                              {/* Info hint indicator icon positioned half-in half-off the top-right corner */}
                              <div
                                className="absolute -top-2 -right-2 z-10 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold shadow-md transition-transform duration-150 group-hover/tooltip:scale-110"
                                style={{
                                  background: 'var(--accent-secondary, #f59e0b)',
                                  color: 'var(--background, #0f172a)',
                                  border: '1.5px solid var(--surface-raised, #1e293b)'
                                }}
                                title="Score breakdown info"
                              >
                                <Info className="h-2.5 w-2.5" />
                              </div>

                              {/* Row 1: GW Points */}
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>GW Pts</span>
                                {player.gw_points != null ? (
                                  <span className="font-mono text-sm font-black" style={{ color: 'var(--accent-primary)' }}>
                                    {player.is_captain
                                      ? (player.gw_points * 2).toFixed(2)
                                      : player.gw_points.toFixed(2)}
                                    {player.is_captain && (
                                      <span className="ml-0.5 text-[9px] font-bold opacity-60">&times;2</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="font-mono text-sm font-semibold" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>
                                )}
                              </div>

                              {/* Row 2: Price — always present */}
                              <div className="mt-0.5 flex items-center justify-between">
                                <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Price</span>
                                <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--success)' }}>
                                  ${Number(player.current_price || 0).toFixed(1)}M
                                </span>
                              </div>

                              {/* Score breakdown tooltip */}
                              <div
                                className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 hidden w-52 rounded-2xl p-3 shadow-2xl group-hover/tooltip:block"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest"
                                  style={{ color: 'var(--text-muted)' }}>
                                  Score Breakdown
                                </p>
                                {player.score_breakdown ? (
                                  <>
                                    {([
                                      ['\u2694\uFE0F Combat',    player.score_breakdown.combat],
                                      ['\uD83D\uDCB0 Economy',   player.score_breakdown.economy],
                                      ['\uD83C\uDFC6 Objective', player.score_breakdown.objective],
                                      ['Teamfight',              player.score_breakdown.teamfight],
                                      ['\uD83C\uDFC5 Win',       player.score_breakdown.win],
                                      ['Series',                 player.score_breakdown.series],
                                      ['\uD83D\uDCCA Perf.',     player.score_breakdown.performance],
                                      ['Consistency',            player.score_breakdown.consistency],
                                      ['Penalty',                player.score_breakdown.penalty],
                                    ] as [string, number][]).map(([label, val]) => (
                                      <div key={label} className="flex items-center justify-between py-0.75 text-[11px]">
                                        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                                        <span className="font-mono font-semibold"
                                          style={{ color: val >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>
                                          {val >= 0 ? '+' : ''}{val.toFixed(2)}
                                        </span>
                                      </div>
                                    ))}
                                    <div className="mt-2 flex items-center justify-between border-t pt-2 text-[11px]"
                                      style={{ borderColor: 'var(--border)' }}>
                                      <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Total</span>
                                      <span className="font-mono font-black" style={{ color: 'var(--accent-primary)' }}>
                                        {player.score_breakdown.total.toFixed(2)} pts
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-xs leading-relaxed py-1" style={{ color: 'var(--text-muted)' }}>
                                    This player does not yet have any fantasy points.
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center rounded-2xl border border-dashed py-12 text-center"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}>
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
                      <Shield className="h-7 w-7" style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      No lineup set yet
                    </p>
                    <p className="mt-1 mb-6 max-w-[26ch] text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      Pick your 5 starters and a captain to start accumulating points this gameweek
                    </p>
                    <Link
                      href="/lineups"
                      className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90"
                      style={{ background: 'var(--accent-primary)' }}
                    >
                      Set Starting Lineup &rarr;
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6 lg:pt-14">

            {/* Upcoming Gameweek */}
            <div data-guide="dashboard-gameweek" data-tour="dashboard-gameweek" className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
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
                View Leaderboards â†’
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Player Detail Modal */}
      <PlayerDetailModal
        player={selectedPlayer}
        loading={playerLoading}
        onClose={() => setSelectedPlayer(null)}
      />
      {showPointsBreakdown && <TotalPointsModal onClose={() => setShowPointsBreakdown(false)} />}
    </div>
  );
}
