'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
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
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'matches' | 'teams'>('matches');

  useEffect(() => {
    async function fetchTournament() {
      try {
        setLoading(true);
        const res = await fetch(`/api/tournaments/${tournamentId}`);
        if (!res.ok) {
          throw new Error('Tournament could not be found');
        }
        const data = (await res.json()) as TournamentApiResponse;
        setTournament(data.tournament || null);
        setTeams(data.teams || []);
        setMatches(data.matches || []);
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
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Loading tournament hub...</p>
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

  return (
    <div className="tournament-detail-page max-w-7xl mx-auto px-4 py-10 space-y-8">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
        >
          <span>←</span>
          <span>Back to Tournaments Circuit</span>
        </Link>

        <Link
          href="/matches"
          className="text-xs font-medium text-amber-400/90 hover:text-amber-300 transition-colors flex items-center gap-1"
        >
          <span>View Global Match Center</span>
          <span>→</span>
        </Link>
      </div>

      {/* Hero Stadium Banner */}
      <div className="relative rounded-3xl border border-slate-800 bg-linear-to-br from-slate-900 via-slate-900/95 to-slate-950 p-8 sm:p-10 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                  isTier1
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                }`}
              >
                {tournament.tier || 'Tier 1 Event'}
              </span>

              {tournament.eligible && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  ⭐ Fantasy Eligible
                </span>
              )}

              {liveMatchesCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Live Games
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-3">
              {tournament.name}
            </h1>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>📅</span>
              <span>
                {startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} &mdash;{' '}
                {endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="tournament-detail-stats flex items-center gap-3 bg-slate-950/70 border border-slate-800 p-4 rounded-2xl shrink-0">
            <div className="text-center px-3 border-r border-slate-800">
              <div className="tournament-detail-stat-value text-xl font-black text-white font-mono">{teams.length}</div>
              <div className="tournament-detail-stat-label text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Teams</div>
            </div>
            <div className="text-center px-3 border-r border-slate-800">
              <div className="tournament-detail-stat-value text-xl font-black text-amber-400 font-mono">{matches.length}</div>
              <div className="tournament-detail-stat-label text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Matches</div>
            </div>
            <div className="text-center px-3">
              <div className="tournament-detail-stat-value text-xl font-black text-emerald-400 font-mono">{completedMatchesCount}</div>
              <div className="tournament-detail-stat-label text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Finished</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation: Matches vs Teams */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'matches'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>⚔️ Series & Matches</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'matches' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {matches.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('teams')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'teams'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🛡️ Competing Teams</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'teams' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {teams.length}
          </span>
        </button>
      </div>

      {/* Tab Content: Matches */}
      {activeTab === 'matches' && (
        <div>
          {matches.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-xl mx-auto mb-3 text-slate-500">
                📅
              </div>
              <h3 className="text-base font-bold text-white mb-1">No Matches Scheduled Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Matches for this tournament series will appear as soon as the bracket and group stages are synced.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Competing Teams */}
      {activeTab === 'teams' && (
        <div>
          {teams.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-xl mx-auto mb-3 text-slate-500">
                🛡️
              </div>
              <h3 className="text-base font-bold text-white mb-1">Roster Invitations Pending</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Qualified and invited professional teams will appear once roster submissions are locked.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4 hover:border-slate-700 hover:bg-slate-800/50 transition-all group"
                >
                  <TeamLogo
                    name={team.name}
                    logoUrl={team.logo_url}
                    tag={team.name.slice(0, 4).toUpperCase()}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-amber-400 transition-colors">
                      {team.name}
                    </h4>
                    {team.region && (
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {team.region} Region
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
