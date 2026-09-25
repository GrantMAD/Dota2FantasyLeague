'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Trophy,
  Zap,
  Flame,
  Swords,
  ChevronRight,
  ShieldAlert,
  User,
  ExternalLink,
} from 'lucide-react';
import { TeamLogo } from '@/app/(dashboard)/matches/components/TeamLogo';

interface ProfessionalTeam {
  id: number;
  name: string;
  tag?: string;
  logo_url?: string | null;
}

interface MatchItem {
  id: number;
  status: string;
  scheduled_at: string;
  radiant_team_id: number;
  dire_team_id: number;
  winner_team_id?: number | null;
  duration_seconds?: number | null;
  radiant_score?: number | null;
  dire_score?: number | null;
  professional_teams?: ProfessionalTeam | null;
  dire_team?: ProfessionalTeam | null;
}

interface TeamFlag {
  id: number;
  flag: string;
  team_id: number;
  professional_teams?: ProfessionalTeam | null;
}

interface TopScorer {
  player_id: number;
  name: string;
  in_game_name: string;
  primary_role: string | null;
  profile_image_url?: string | null;
  total_points: number;
  matches_played: number;
}

interface GameweekData {
  id: number;
  gameweek_number: number;
  season_id: number;
  start_date: string;
  end_date: string;
  deadline: string;
  status: 'upcoming' | 'active' | 'closed' | 'locked';
}

interface GameweekDetailResponse {
  gameweek: GameweekData;
  matches: MatchItem[];
  teamFlags: TeamFlag[];
  tournaments: Array<{ id: number; name: string; slug?: string | null }>;
  topScorers: TopScorer[];
  userScore: number | null;
}

function formatDate(dateStr: string) {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function GameweekDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<GameweekDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGameweek() {
      try {
        setLoading(true);
        const res = await fetch(`/api/gameweeks/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Gameweek not found');
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to load gameweek details');
        }
        const json = await res.json();
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load gameweek');
      } finally {
        setLoading(false);
      }
    }

    void loadGameweek();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Loading gameweek details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400 mb-4 border border-rose-500/20">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Gameweek Not Found</h1>
        <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
          {error || 'Unable to locate the specified gameweek.'}
        </p>
        <Link
          href="/gameweeks"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Gameweeks
        </Link>
      </div>
    );
  }

  const { gameweek, matches, teamFlags, tournaments, topScorers, userScore } = data;
  const doubleTeams = teamFlags.filter((f) => f.flag === 'double');
  const blankTeams = teamFlags.filter((f) => f.flag === 'blank');

  const statusBadge = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    upcoming: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    locked: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    closed: 'bg-slate-800/60 text-slate-400 border-slate-700',
  }[gameweek.status] || 'bg-slate-800 text-slate-400 border-slate-700';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/gameweeks"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Gameweeks
        </Link>
      </div>

      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Gameweek {gameweek.gameweek_number}
              </span>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${statusBadge}`}>
                {gameweek.status}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              Gameweek {gameweek.gameweek_number} Details & Results
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs md:text-sm text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                {formatDate(gameweek.start_date)} - {formatDate(gameweek.end_date)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                Deadline: {formatDateTime(gameweek.deadline)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-300 font-medium">
                <Swords className="w-4 h-4 text-amber-400" />
                {matches.length} Matches
              </span>
            </div>

            {tournaments && tournaments.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tournaments.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800/80 border border-slate-700 text-slate-300"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* User Score Card if available */}
          {userScore !== null && (
            <div className="shrink-0 flex flex-col items-center justify-center p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-sm min-w-[150px]">
              <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400 mb-1">
                Your Score
              </span>
              <span className="text-3xl font-black text-white">
                {userScore.toFixed(1)}
              </span>
              <span className="text-[11px] text-emerald-300/80 mt-0.5">fantasy points</span>
            </div>
          )}
        </div>
      </div>

      {/* Double & Blank Gameweek notices */}
      {(doubleTeams.length > 0 || blankTeams.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {doubleTeams.length > 0 && (
            <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-950/10">
              <div className="flex items-center gap-2 mb-2 font-bold text-amber-400 text-sm">
                <Zap className="w-4 h-4" />
                Double Gameweek Teams
              </div>
              <p className="text-xs text-slate-400 mb-3">
                These teams play multiple fixtures in this gameweek:
              </p>
              <div className="flex flex-wrap gap-2">
                {doubleTeams.map((flag) => (
                  <span
                    key={flag.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-200"
                  >
                    {flag.professional_teams?.name || `Team #${flag.team_id}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {blankTeams.length > 0 && (
            <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-950/10">
              <div className="flex items-center gap-2 mb-2 font-bold text-rose-400 text-sm">
                <Flame className="w-4 h-4" />
                Blank Gameweek Teams
              </div>
              <p className="text-xs text-slate-400 mb-3">
                These teams have zero scheduled fixtures in this gameweek:
              </p>
              <div className="flex flex-wrap gap-2">
                {blankTeams.map((flag) => (
                  <span
                    key={flag.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 border border-rose-500/40 text-rose-200"
                  >
                    {flag.professional_teams?.name || `Team #${flag.team_id}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Layout: Fixtures + Top Performers */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Matches / Fixtures List (2 columns wide) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Swords className="w-5 h-5 text-amber-400" />
              Fixtures & Results
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              {matches.length} {matches.length === 1 ? 'fixture' : 'fixtures'}
            </span>
          </div>

          {matches.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-slate-400 text-sm">
              No matches scheduled for this gameweek yet.
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((match) => {
                const radiant = match.professional_teams;
                const dire = match.dire_team;
                const isCompleted = match.status === 'completed';
                const isLive = match.status === 'live';
                const hasWinner = Boolean(match.winner_team_id);
                const radiantWon = isCompleted && hasWinner && match.winner_team_id === match.radiant_team_id;
                const direWon = isCompleted && hasWinner && match.winner_team_id === match.dire_team_id;
                const duration = formatDuration(match.duration_seconds);

                const radiantName = (radiant?.name && radiant.name !== 'Team null')
                  ? radiant.name
                  : (match.radiant_team_id ? `Team #${match.radiant_team_id}` : 'Radiant');

                const direName = (dire?.name && dire.name !== 'Team null')
                  ? dire.name
                  : (match.dire_team_id ? `Team #${match.dire_team_id}` : 'Dire');

                return (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}?from=gameweek&gwId=${id}`}
                    className="group block p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700 transition duration-200 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left: Schedule & Status */}
                      <div className="flex items-center gap-2 sm:w-36 shrink-0">
                        {isLive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 border border-rose-500/40 text-rose-300 animate-pulse">
                            LIVE
                          </span>
                        ) : isCompleted ? (
                          <span className="text-xs font-semibold text-slate-400">
                            Completed {duration && `(${duration})`}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {formatDateTime(match.scheduled_at)}
                          </span>
                        )}
                      </div>

                      {/* Middle: Teams & Score */}
                      <div className="flex-1 flex items-center justify-between sm:justify-center gap-4 sm:gap-8">
                        {/* Radiant Team */}
                        <div className="flex items-center gap-2.5 flex-1 justify-end text-right">
                          <span
                            className={`font-semibold text-sm ${
                              radiantWon ? 'text-emerald-400 font-bold' : 'text-slate-200'
                            }`}
                          >
                            {radiantName}
                          </span>
                          <TeamLogo
                            name={radiantName}
                            logoUrl={radiant?.logo_url}
                            tag={radiant?.tag}
                            size="sm"
                            faction="radiant"
                            isWinner={radiantWon}
                          />
                        </div>

                        {/* VS or Score */}
                        <div className="shrink-0 px-3 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-bold text-slate-300">
                          {isCompleted ? (
                            (match.radiant_score !== null && match.dire_score !== null) || radiantWon || direWon ? (
                              <span>
                                {match.radiant_score ?? (radiantWon ? 1 : 0)} - {match.dire_score ?? (direWon ? 1 : 0)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">FT</span>
                            )
                          ) : (
                            <span className="text-slate-500">VS</span>
                          )}
                        </div>

                        {/* Dire Team */}
                        <div className="flex items-center gap-2.5 flex-1 justify-start text-left">
                          <TeamLogo
                            name={direName}
                            logoUrl={dire?.logo_url}
                            tag={dire?.tag}
                            size="sm"
                            faction="dire"
                            isWinner={direWon}
                          />
                          <span
                            className={`font-semibold text-sm ${
                              direWon ? 'text-rose-400 font-bold' : 'text-slate-200'
                            }`}
                          >
                            {direName}
                          </span>
                        </div>
                      </div>

                      {/* Right: Arrow Link */}
                      <div className="shrink-0 hidden sm:flex items-center text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Performers Sidebar (1 column wide) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Top Scorers
            </h2>
            <span className="text-xs text-slate-400 font-medium">GW Points</span>
          </div>

          {topScorers.length === 0 ? (
            <div className="p-6 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-slate-400 text-xs">
              No performance scores recorded for this gameweek yet.
            </div>
          ) : (
            <div className="space-y-2">
              {topScorers.map((player, idx) => (
                <Link
                  key={player.player_id}
                  href={`/players/${player.player_id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700 transition group"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-5 text-center text-xs font-bold ${
                        idx === 0
                          ? 'text-amber-400'
                          : idx === 1
                          ? 'text-slate-300'
                          : idx === 2
                          ? 'text-amber-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700">
                      {player.profile_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.profile_image_url}
                          alt={player.in_game_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white group-hover:text-amber-300 transition">
                        {player.in_game_name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {player.primary_role
                          ? ['1', '2', '3', '4', '5'].includes(String(player.primary_role))
                            ? `Pos ${player.primary_role}`
                            : player.primary_role
                          : 'Player'}{' '}
                        • {player.matches_played} {player.matches_played === 1 ? 'match' : 'matches'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-amber-400">
                      {player.total_points.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                      pts
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Quick link to Transfer Market / Stats */}
          <div className="pt-2">
            <Link
              href="/transfers"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-xs font-medium text-slate-300 hover:text-white transition"
            >
              <span>Explore All Players on Market</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
