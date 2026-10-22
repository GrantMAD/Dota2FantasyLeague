'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Activity, CalendarDays, Check, CheckCircle2, ChevronLeft, Clock3, Gamepad2, ListFilter, Trophy, Users } from 'lucide-react';
import { TeamLogo } from '../../matches/components/TeamLogo';
import { MatchCard, MatchData } from '../../matches/components/MatchCard';

interface TournamentTeam {
  id: number;
  name: string;
  slug: string;
  region?: string;
  logo_url: string | null;
}

interface TournamentDetail {
  id: number;
  name: string;
  slug: string;
  status: 'eligible' | 'excluded' | 'provisional' | 'archived' | string;
  tier: string | null;
  start_date: string;
  end_date: string;
  eligible?: boolean;
}

interface TournamentApiResponse {
  tournament?: TournamentDetail;
  teams?: TournamentTeam[];
  series?: Array<{
    id: number;
    series_number: number;
    best_of: number;
    gameweek_id: number;
    team_a_id: number;
    team_b_id: number;
  }>;
  matches?: MatchData[];
}

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const tournamentId = resolvedParams.id;
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [series, setSeries] = useState<NonNullable<TournamentApiResponse['series']>>([]);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'matches' | 'teams'>('matches');
  const [matchFilter, setMatchFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const matchCounts = {
    all: matches.length,
    live: matches.filter((match) => match.status === 'live').length,
    upcoming: matches.filter((match) => match.status === 'scheduled').length,
    completed: matches.filter((match) => match.status === 'completed').length,
  };
  const visibleMatches = matches
    .filter((match) => {
      if (matchFilter === 'live') return match.status === 'live';
      if (matchFilter === 'upcoming') return match.status === 'scheduled';
      if (matchFilter === 'completed') return match.status === 'completed';
      return true;
    })
    .sort((a, b) => {
      const statusOrder = (status: string) => status === 'live' ? 0 : status === 'scheduled' ? 1 : 2;
      const statusDifference = statusOrder(a.status) - statusOrder(b.status);
      if (statusDifference !== 0) return statusDifference;
      const timeA = new Date(a.scheduled_at).getTime();
      const timeB = new Date(b.scheduled_at).getTime();
      return a.status === 'completed' ? timeB - timeA : timeA - timeB;
    });

  useEffect(() => {
    async function fetchTournament() {
      try {
        setLoading(true);
        const res = await fetchWithAuth(`/api/tournaments/${tournamentId}`);
        if (!res.ok) {
          throw new Error('Tournament could not be found');
        }
        const data = (await res.json()) as TournamentApiResponse;
        setTournament(data.tournament || null);
        setTeams(data.teams || []);
        setSeries(data.series || []);
        setMatches((data.matches || []).map((match) => ({
          ...match,
          status: match.status === 'in_progress' ? 'live' : match.status,
        })));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load tournament');
      } finally {
        setLoading(false);
      }
    }
    fetchTournament();
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="tournament-detail-page mx-auto max-w-7xl px-4 py-10 space-y-8 animate-pulse" role="status" aria-label="Loading tournament hub">
        <div className="flex items-center justify-between gap-4">
          <div className="h-4 w-48 rounded bg-slate-800" />
          <div className="h-4 w-40 rounded bg-slate-800" />
        </div>
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="w-full space-y-4">
              <div className="flex gap-2">
                <div className="h-6 w-24 rounded-full bg-slate-800" />
                <div className="h-6 w-32 rounded-full bg-slate-800" />
              </div>
              <div className="h-10 w-3/4 max-w-xl rounded bg-slate-800" />
              <div className="h-4 w-52 rounded bg-slate-800" />
            </div>
            <div className="grid w-full grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 md:w-auto">
              {[1, 2, 3].map((item) => (
                <div key={item} className="space-y-2 border-r border-slate-800 px-3 text-center last:border-0">
                  <div className="mx-auto h-6 w-10 rounded bg-slate-800" />
                  <div className="mx-auto h-3 w-14 rounded bg-slate-800" />
                </div>
              ))}
            </div>
          </div>
        </section>
        <div className="flex gap-3 border-b border-slate-800 pb-4">
          <div className="h-9 w-36 rounded-xl bg-slate-800" />
          <div className="h-9 w-36 rounded-xl bg-slate-800" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-5 flex justify-between">
                <div className="h-4 w-24 rounded bg-slate-800" />
                <div className="h-6 w-16 rounded-full bg-slate-800" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2"><div className="h-9 w-9 rounded-full bg-slate-800" /><div className="h-4 w-20 rounded bg-slate-800" /></div>
                <div className="h-4 w-6 rounded bg-slate-800" />
                <div className="flex items-center gap-2"><div className="h-9 w-9 rounded-full bg-slate-800" /><div className="h-4 w-20 rounded bg-slate-800" /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/40 border border-rose-800 flex items-center justify-center text-2xl mx-auto mb-4 text-rose-400">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Tournament Not Found</h1>
        <p className="text-slate-400 text-sm mb-6">{error || 'This tournament could not be loaded.'}</p>
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
        >
          ← Return to Tournaments
        </Link>
      </div>
    );
  }

  const isTier1 = tournament.tier?.toLowerCase().includes('tier 1') || tournament.tier?.toLowerCase().includes('major');
  const startDate = new Date(tournament.start_date);
  const endDate = new Date(tournament.end_date);
  const completedMatchesCount = matches.filter((m) => m.status === 'completed').length;
  const liveMatchesCount = matches.filter((m) => m.status === 'live').length;
  const upcomingMatchesCount = matches.filter((match) => match.status === 'scheduled').length;
  const completionPercent = matches.length ? Math.round((completedMatchesCount / matches.length) * 100) : 0;
  return (
    <div className="tournament-detail-page mx-auto max-w-7xl space-y-6 px-4 py-8 sm:py-10">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-amber-600 dark:hover:text-amber-300"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Tournaments Circuit</span>
        </Link>

        <Link
          href="/matches"
          className="flex items-center gap-1 text-xs font-medium text-amber-700 transition-colors hover:text-amber-600 dark:text-amber-300 dark:hover:text-amber-200"
        >
          <span>View Global Match Center</span>
          <span>→</span>
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-amber-500/35 bg-[var(--surface)] p-5 shadow-xl shadow-amber-500/5 sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.13),transparent_55%)]" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500" />

        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                  isTier1
                    ? 'border-amber-400/60 bg-gradient-to-r from-amber-400/25 to-yellow-500/10 text-amber-800 dark:text-amber-200'
                    : 'border-cyan-400/60 bg-gradient-to-r from-slate-300/20 to-cyan-500/15 text-cyan-800 dark:text-cyan-200'
                }`}
              >
                <Trophy className="h-3.5 w-3.5" />
                {tournament.tier || 'Unranked'}
              </span>

              {tournament.eligible && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300">
                  <Check className="h-3 w-3" /> Fantasy points eligible
                </span>
              )}

              {liveMatchesCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                  {liveMatchesCount} live {liveMatchesCount === 1 ? 'match' : 'matches'}
                </span>
              )}
            </div>

            <h1 className="mb-3 text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-4xl">
              {tournament.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-[var(--text-muted)]" />
                {startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} &mdash;{' '}
                {endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="capitalize">{tournament.status}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[22rem]">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 text-center">
              <Users className="mx-auto h-4 w-4 text-cyan-700 dark:text-cyan-300" />
              <div className="tournament-detail-stat-value mt-1 text-xl font-black text-[var(--text-primary)]">{teams.length}</div>
              <div className="tournament-detail-stat-label text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Teams</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 text-center">
              <Trophy className="mx-auto h-4 w-4 text-amber-600 dark:text-amber-300" />
              <div className="tournament-detail-stat-value mt-1 text-xl font-black text-[var(--text-primary)]">{series?.length ?? 0}</div>
              <div className="tournament-detail-stat-label text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Series</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 text-center">
              <Gamepad2 className="mx-auto h-4 w-4 text-[var(--text-muted)]" />
              <div className="tournament-detail-stat-value mt-1 text-xl font-black text-[var(--text-primary)]">{matches.length}</div>
              <div className="tournament-detail-stat-label text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Matches</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 text-center">
              <Activity className="mx-auto h-4 w-4 text-emerald-700 dark:text-emerald-300" />
              <div className="tournament-detail-stat-value mt-1 text-xl font-black text-emerald-700 dark:text-emerald-300">{completedMatchesCount}</div>
              <div className="tournament-detail-stat-label text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Complete</div>
            </div>
          </div>
        </div>
        <div className="relative mt-5 border-t border-[var(--border)] pt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">Tournament match progress</span>
            <span className="font-semibold tabular-nums text-[var(--text-primary)]">{completedMatchesCount} / {matches.length} complete · {completionPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-[width]" style={{ width: `${completionPercent}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--text-muted)]">
            <span>{liveMatchesCount} live</span>
            <span>{upcomingMatchesCount} upcoming</span>
            <span>{series?.length ?? 0} series scheduled</span>
          </div>
        </div>
      </section>

      <div role="group" aria-label="Tournament details" className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3">
        <button
          type="button"
          aria-pressed={activeTab === 'matches'}
          onClick={() => setActiveTab('matches')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'matches'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Gamepad2 className="h-4 w-4" />
          <span>Series & Matches</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'matches' ? 'bg-slate-950/20 text-slate-950' : 'bg-[var(--surface)] text-[var(--text-muted)]'
            }`}
          >
            {matches.length}
          </span>
        </button>

        <button
          type="button"
          aria-pressed={activeTab === 'teams'}
          onClick={() => setActiveTab('teams')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'teams'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Competing Teams</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'teams' ? 'bg-slate-950/20 text-slate-950' : 'bg-[var(--surface)] text-[var(--text-muted)]'
            }`}
          >
            {teams.length}
          </span>
        </button>
      </div>

      {activeTab === 'matches' && (
        <div className="space-y-5">
          <div role="group" aria-label="Filter tournament matches by status" className="flex flex-wrap gap-2">
            {([
              ['all', 'All Matches', ListFilter],
              ['live', 'Live', Activity],
              ['upcoming', 'Upcoming', Clock3],
              ['completed', 'Results', CheckCircle2],
            ] as const).map(([filter, label, FilterIcon]) => (
              <button
                key={filter}
                type="button"
                aria-pressed={matchFilter === filter}
                onClick={() => setMatchFilter(filter)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  matchFilter === filter
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-800 shadow-sm shadow-amber-500/10 dark:text-amber-200'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]'
                }`}
              >
                <FilterIcon className="h-3.5 w-3.5" />
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  matchFilter === filter ? 'bg-amber-500/15' : 'bg-[var(--surface-raised)]'
                }`}>
                  {matchCounts[filter]}
                </span>
              </button>
            ))}
          </div>

          {matches.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-raised)] text-[var(--text-muted)]">
                <CalendarDays className="h-6 w-6" />
              </div>
              <h3 className="mb-1 text-base font-bold text-[var(--text-primary)]">No Matches Scheduled Yet</h3>
              <p className="mx-auto max-w-sm text-xs text-[var(--text-secondary)]">
                Matches for this tournament series will appear as soon as the bracket and group stages are synced.
              </p>
            </div>
          ) : visibleMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
              No {matchFilter === 'completed' ? 'completed' : matchFilter} matches are available.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'teams' && (
        <div>
          {teams.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-raised)] text-[var(--text-muted)]">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mb-1 text-base font-bold text-[var(--text-primary)]">Roster Invitations Pending</h3>
              <p className="mx-auto max-w-sm text-xs text-[var(--text-secondary)]">
                Qualified and invited professional teams will appear once roster submissions are locked.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500/50 hover:bg-[var(--surface-raised)] hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-2 shadow-inner">
                    <TeamLogo
                      name={team.name}
                      logoUrl={team.logo_url}
                      tag={team.name.slice(0, 4).toUpperCase()}
                      size="md"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold text-[var(--text-primary)] transition-colors group-hover:text-amber-600 dark:group-hover:text-amber-300">
                      {team.name}
                    </h4>
                    {team.region && (
                      <span className="mt-1 inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                        {team.region}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
