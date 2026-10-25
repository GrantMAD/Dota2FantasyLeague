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
  Shield,
} from 'lucide-react';
import { fetchWithAuth, getAuthSession } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';
import type { DashboardData, DashboardStarter, ScoreBreakdown } from '@/types/fantasy';
import type { Session } from '@supabase/supabase-js';
import { PlayerDetailModal, type PlayerDetails } from '@/app/(dashboard)/squads/components/PlayerDetailModal';
import { TotalPointsModal } from './components/TotalPointsModal';
import { DashboardQuickActions } from './components/DashboardQuickActions';
import { DashboardOnboardingChecklist } from './components/DashboardOnboardingChecklist';
import { DashboardStatCards, type DashboardStatCardData } from './components/DashboardStatCards';
import { DashboardStarterCard } from './components/DashboardStarterCard';
import { EmptySquadState } from './components/EmptySquadState';
import { DashboardLiveMatches } from './components/DashboardLiveMatches';
import { DashboardWhatsNew, type WhatsNewData } from './components/DashboardWhatsNew';
import { DashboardGoalProgress } from './components/DashboardGoalProgress';
import { DashboardTransferRush } from './components/DashboardTransferRush';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';
import type { MatchData } from '@/app/(dashboard)/matches/components/MatchCard';

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
    let cancelled = false;
    let livePollTimer: number | null = null;
    let whatsNewPollTimer: number | null = null;
    let liveRequestInFlight = false;
    let whatsNewRequestInFlight = false;
    let hasLiveMatches = false;

    const clearLivePoll = () => {
      if (livePollTimer !== null) {
        window.clearTimeout(livePollTimer);
        livePollTimer = null;
      }
    };

    const clearWhatsNewPoll = () => {
      if (whatsNewPollTimer !== null) {
        window.clearTimeout(whatsNewPollTimer);
        whatsNewPollTimer = null;
      }
    };

    const fetchStats = async (session: Session | null) => {
      try {
        const res = await fetchWithAuth('/api/dashboard/stats', {}, session);
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          if (res.status === 401) {
            if (!cancelled) router.push('/login');
            return;
          }
          throw new Error(errBody?.error || `Failed to fetch stats (${res.status})`);
        }
        const data = (await res.json()) as DashboardData;
        if (cancelled) return;
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
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Error fetching dashboard stats';
        setError(msg);
        toast.error('Load Error', msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const scheduleWhatsNewPoll = () => {
      clearWhatsNewPoll();
      if (cancelled || document.visibilityState === 'hidden') return;
      whatsNewPollTimer = window.setTimeout(() => {
        void fetchWhatsNew();
      }, 15 * 60 * 1000);
    };

    const fetchWhatsNew = async (session?: Session | null) => {
      if (whatsNewRequestInFlight) return;
      whatsNewRequestInFlight = true;
      try {
        const response = await fetchWithAuth('/api/dashboard/whats-new', {}, session);
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
      } finally {
        whatsNewRequestInFlight = false;
        scheduleWhatsNewPoll();
      }
    };

    const scheduleLivePoll = () => {
      clearLivePoll();
      if (cancelled || document.visibilityState === 'hidden') return;
      livePollTimer = window.setTimeout(() => {
        void fetchLiveMatches();
      }, hasLiveMatches ? 60 * 1000 : 5 * 60 * 1000);
    };

    const fetchLiveMatches = async (session?: Session | null) => {
      if (liveRequestInFlight) return;
      liveRequestInFlight = true;
      try {
        const response = await fetchWithAuth('/api/matches?status=live&limit=6', {}, session);
        if (!response.ok) throw new Error(`Failed to load live matches (${response.status})`);
        const data = await response.json();
        if (!data || !Array.isArray(data.matches)) {
          throw new Error('Live matches response did not contain a matches list.');
        }
        if (!cancelled) {
          hasLiveMatches = data.matches.length > 0;
          setLiveMatches(data.matches);
        }
      } catch (matchError) {
        if (!cancelled) {
          console.warn('Unable to refresh dashboard live matches:', matchError);
        }
      } finally {
        liveRequestInFlight = false;
        if (!cancelled) {
          setLiveMatchesLoading(false);
          scheduleLivePoll();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearLivePoll();
        clearWhatsNewPoll();
        return;
      }
      void fetchLiveMatches();
      void fetchWhatsNew();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const loadDashboard = async () => {
      try {
        const session = await getAuthSession();
        if (cancelled) return;
        await Promise.all([
          fetchStats(session),
          fetchWhatsNew(session),
          fetchLiveMatches(session),
        ]);
      } catch (sessionError: unknown) {
        if (cancelled) return;
        const message = sessionError instanceof Error
          ? sessionError.message
          : 'Unable to establish an authenticated session.';
        setError(message);
        setWhatsNewError(message);
        toast.error('Load Error', message);
        setLoading(false);
        setLiveMatchesLoading(false);
      }
    };
    void loadDashboard();

    return () => {
      cancelled = true;
      clearLivePoll();
      clearWhatsNewPoll();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router, toast]);



  return (
    <div className="dashboard-page min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Hero Section */}
      <section
        className="dashboard-hero relative overflow-hidden border-b py-10 px-4 transition-colors"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Subtle ambient Dota aura gradients (Radiant teal + Dire crimson glows) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-15 blur-3xl"
          style={{ background: 'var(--accent-primary)' }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-10 blur-3xl"
          style={{ background: '#f59e0b' }}
        />

        <div className="relative max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="dashboard-hero-title text-3xl md:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  Welcome back{dashboardData?.displayName ? `, ${dashboardData.displayName}` : ''}
                </h1>
                <DataFreshnessBadge page="dashboard" />
              </div>
              <p className="text-base sm:text-lg" style={{ color: 'var(--text-secondary)' }}>
                Manage your fantasy squads and compete with players worldwide
              </p>
            </div>
            <Link
              href="/squads"
              className="mt-4 md:mt-0 px-6 py-2.5 rounded-xl font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ background: 'var(--accent-primary)' }}
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
      <section className="max-w-7xl mx-auto px-4 py-8">
        {!loading && dashboardData?.fantasySeasonId ? (
          <DashboardOnboardingChecklist
            hasSquad={dashboardData.activeSquadCount > 0}
            ownedPlayerCount={dashboardData.ownedPlayerCount}
            hasCompleteLineup={(dashboardData.starters?.length ?? 0) === 5 && Boolean(dashboardData.captain)}
            hasLeague={dashboardData.leagueStandings.length > 0}
          />
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Primary Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Transfer Deadline Rush Widget */}
            <DashboardTransferRush />

            {/* Squads Status & Starting Five Section */}
            {loading ? (
              <div
                className="rounded-2xl p-8 animate-pulse text-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="h-10 w-10 rounded-full mx-auto mb-4" style={{ background: 'var(--surface-muted)' }} />
                <div className="h-5 w-48 rounded mx-auto mb-2" style={{ background: 'var(--surface-muted)' }} />
                <div className="h-4 w-64 rounded mx-auto" style={{ background: 'var(--surface-muted)' }} />
              </div>
            ) : !dashboardData ? null : !dashboardData.activeSquadCount ? (
              <EmptySquadState />
            ) : (
              <div
                className="rounded-2xl p-5 shadow-sm transition-colors"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                {/* Panel header */}
                <div
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 mb-5"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-xl"
                        style={{
                          background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)',
                        }}
                      >
                        <Shield className="h-4 w-4" style={{ color: 'var(--accent-primary)' }} />
                      </div>
                      <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                        {dashboardData.squadName || 'Active Squad'}
                      </h3>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          background: 'color-mix(in srgb, var(--success) 12%, transparent)',
                          color: 'var(--success)',
                          border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
                        }}
                      >
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
                    {dashboardData.starters && dashboardData.starters.some((s) => s.gw_points != null) && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                        style={{
                          background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
                          color: 'var(--accent-primary)',
                          border: '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)',
                        }}
                      >
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
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {[...dashboardData.starters]
                      .sort((a, b) => {
                        const getRank = (player: typeof a) => (player.is_captain ? 0 : player.is_vice_captain ? 1 : 2);
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
                  <div
                    className="flex flex-col items-center rounded-2xl border border-dashed py-12 text-center"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}
                  >
                    <div
                      className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                      style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
                    >
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

            {/* Next Moves / Quick Actions */}
            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[0, 1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-36 animate-pulse rounded-2xl"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  />
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

            {/* What's New Feed */}
            {whatsNew && <DashboardWhatsNew whatsNew={whatsNew} />}
            {whatsNewError && (
              <div role="status" className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-5 py-4 text-sm text-rose-200">
                What&apos;s New could not be loaded: {whatsNewError}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Upcoming Gameweek */}
            <div
              data-guide="dashboard-gameweek"
              data-tour="dashboard-gameweek"
              className="rounded-2xl p-5 shadow-sm transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Current Gameweek</h3>
                {dashboardData?.gameweek?.status === 'active' && (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: 'color-mix(in srgb, var(--success) 12%, transparent)',
                      color: 'var(--success)',
                      border: '1px solid color-mix(in srgb, var(--success) 30%, transparent)',
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Gameweek</p>
                  <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                    {dashboardData?.gameweek?.gameweek_number || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Deadline</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--accent-primary)' }}>
                    {dashboardData?.gameweek?.deadline
                      ? new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          timeZoneName: 'short',
                        }).format(new Date(dashboardData.gameweek.deadline))
                      : 'Not Set'}
                  </p>
                </div>
              </div>
            </div>

            {/* Captain Status */}
            {dashboardData?.captain && (
              <div
                className="rounded-2xl p-5 shadow-sm transition-colors"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Leadership</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Captain (2x)</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{dashboardData.captain.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Vice-Captain</span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{dashboardData.viceCaptain?.name || 'None'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Season Goals */}
            {!loading && dashboardData?.fantasySeasonId ? (
              <DashboardGoalProgress
                initialTargetPoints={dashboardData.targetPoints}
                initialTargetRank={dashboardData.targetRank}
                totalPoints={dashboardData.totalPoints}
                globalRank={dashboardData.globalRank}
                onGoalsUpdated={({ targetPoints, targetRank }) => {
                  setDashboardData((prev) =>
                    prev ? { ...prev, targetPoints, targetRank } : prev
                  );
                }}
              />
            ) : null}

            {/* Leaderboard Preview */}
            <div
              className="rounded-2xl p-5 shadow-sm transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <h3 className="font-bold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Leagues Overview</h3>
              {dashboardData && dashboardData.leagueStandings.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.leagueStandings.map((l, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center text-sm pb-2.5 last:pb-0"
                      style={{ borderBottom: idx === dashboardData.leagueStandings.length - 1 ? 'none' : '1px solid var(--border)' }}
                    >
                      <span className="truncate pr-2 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{l.leagues?.name}</span>
                      <span className="text-xs font-bold font-mono" style={{ color: 'var(--accent-primary)' }}>Rank {l.rank || '-'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  Sign up and join to see global rankings
                </p>
              )}
              <Link
                href="/leagues"
                className="inline-flex items-center justify-center gap-1.5 w-full text-center text-xs font-bold mt-4 transition-colors hover:opacity-80"
                style={{ color: 'var(--accent-primary)' }}
              >
                View Leaderboards &rarr;
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
