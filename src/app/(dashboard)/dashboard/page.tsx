'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trophy,
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
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';
import type { DashboardData, DashboardStarter, ScoreBreakdown } from '@/types/fantasy';
import { PlayerDetailModal, type PlayerDetails } from '@/app/(dashboard)/squads/components/PlayerDetailModal';
import { TotalPointsModal } from './components/TotalPointsModal';
import { DashboardQuickActions } from './components/DashboardQuickActions';
import { DashboardStatCards, type DashboardStatCardData } from './components/DashboardStatCards';
import { DashboardStarterCard } from './components/DashboardStarterCard';
import { EmptySquadState } from './components/EmptySquadState';
import { DashboardLiveMatches } from './components/DashboardLiveMatches';
import type { MatchData } from '@/app/(dashboard)/matches/components/MatchCard';

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

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStatCardData[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetails | null>(null);
  const [selectedScoreBreakdown, setSelectedScoreBreakdown] = useState<ScoreBreakdown | null | undefined>(undefined);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [showPointsBreakdown, setShowPointsBreakdown] = useState(false);
  const [whatsNew, setWhatsNew] = useState<WhatsNewData | null>(null);
  const [whatsNewError, setWhatsNewError] = useState<string | null>(null);
  const [whatsNewTab, setWhatsNewTab] = useState<WhatsNewTab>('tournaments');
  const [tournamentsExpanded, setTournamentsExpanded] = useState(false);
  const [playersExpanded, setPlayersExpanded] = useState(false);
  const [liveMatches, setLiveMatches] = useState<MatchData[]>([]);
  const [liveMatchesLoading, setLiveMatchesLoading] = useState(true);

  const openPlayerDetails = async (starter: DashboardStarter) => {
    setSelectedScoreBreakdown(starter.score_breakdown ?? null);
    setPlayerLoading(true);
    try {
      const response = await fetchWithAuth(`/api/players/${starter.id}`);
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

  useEffect(() => {
    let cancelled = false;

    const fetchLiveMatches = async () => {
      try {
        const response = await fetchWithAuth('/api/matches?status=live&limit=6');
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data && Array.isArray(data.matches)) {
          setLiveMatches(data.matches);
        }
      } catch {
        // Silently tolerate live match polling error
      } finally {
        if (!cancelled) {
          setLiveMatchesLoading(false);
        }
      }
    };

    void fetchLiveMatches();
    // Poll live matches every 60 seconds
    const intervalId = window.setInterval(() => void fetchLiveMatches(), 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const hasTournamentUpdates = (whatsNew?.events.length ?? 0) > 0;
  const hasPlayerUpdates = (whatsNew?.updates.length ?? 0) > 0;
  const activeWhatsNewTab: WhatsNewTab = whatsNewTab === 'tournaments'
    ? hasTournamentUpdates || !hasPlayerUpdates ? 'tournaments' : 'players'
    : hasPlayerUpdates || !hasTournamentUpdates ? 'players' : 'tournaments';

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
                Welcome back{dashboardData?.displayName ? `, ${dashboardData.displayName}` : ''}
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
            <DashboardStatCards
              stats={stats}
              onOpenPointsBreakdown={() => setShowPointsBreakdown(true)}
            />
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
                      aria-selected={activeWhatsNewTab === 'tournaments'}
                      className={`wn-tab ${activeWhatsNewTab === 'tournaments' ? 'wn-tab--active' : ''}`}
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
                      aria-selected={activeWhatsNewTab === 'players'}
                      className={`wn-tab ${activeWhatsNewTab === 'players' ? 'wn-tab--active' : ''}`}
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
                    hidden={activeWhatsNewTab !== 'tournaments'}
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
                    hidden={activeWhatsNewTab !== 'players'}
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
            {loading ? (
              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="h-36 animate-pulse rounded-lg border border-slate-700 bg-slate-800/50" />
                ))}
              </div>
            ) : dashboardData ? (
              <DashboardQuickActions
                activeSquadCount={dashboardData.activeSquadCount}
                bankBalance={Number(dashboardData.bankBalance)}
                freeTransfers={dashboardData.freeTransfers}
                hasLeagues={dashboardData.leagueStandings.length > 0}
              />
            ) : null}

            {/* Live Matches In Progress */}
            <DashboardLiveMatches
              matches={liveMatches}
              loading={liveMatchesLoading}
              userSquadTeamIds={
                dashboardData?.starters
                  ?.map((s) => s.team_id)
                  .filter((id): id is number => typeof id === 'number') ?? []
              }
            />

            {/* Squads Status Section */}
            {loading ? (
              <div className="bg-slate-800/30 border border-slate-700/80 rounded-lg p-8 animate-pulse text-center">
                <div className="h-10 w-10 bg-slate-700/60 rounded-full mx-auto mb-4" />
                <div className="h-5 w-48 bg-slate-700/60 rounded mx-auto mb-2" />
                <div className="h-4 w-64 bg-slate-700/40 rounded mx-auto" />
              </div>
            ) : !dashboardData ? null : !dashboardData.activeSquadCount ? (
              <EmptySquadState />
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
                  <div className="flex gap-3 overflow-x-auto pb-3 sm:grid sm:grid-cols-5 sm:overflow-visible">
                    {[...dashboardData.starters]
                      .sort((a, b) => {
                        const getRank = (player: typeof a) => player.is_captain ? 0 : player.is_vice_captain ? 1 : 2;
                        return getRank(a) - getRank(b);
                      })
                      .map((player) => (
                        <DashboardStarterCard
                          key={`${player.slot}-${player.id}`}
                          player={player}
                          onOpenPlayer={openPlayerDetails}
                        />
                      ))}
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
        scoreBreakdown={selectedScoreBreakdown}
        onClose={() => {
          setSelectedPlayer(null);
          setSelectedScoreBreakdown(undefined);
        }}
      />
      {showPointsBreakdown && <TotalPointsModal onClose={() => setShowPointsBreakdown(false)} />}
    </div>
  );
}
