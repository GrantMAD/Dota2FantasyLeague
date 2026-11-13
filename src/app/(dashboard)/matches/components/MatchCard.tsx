'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { TeamLogo } from './TeamLogo';
import type { MatchSquadPlayer } from '@/lib/match-squad-tracking';
import { getCompletedGamesAwaitingPlayerStats, summarizeMatchSeries } from '@/lib/match-series';

export interface MatchData {
  id: number;
  series_id?: number | null;
  gameweek_id?: number | null;
  series_matches?: MatchData[];
  status: 'completed' | 'live' | 'scheduled' | string;
  scheduled_at: string;
  duration_seconds: number | null;
  radiant_team_id: number;
  dire_team_id: number;
  winner_team_id: number | null;
  player_ids?: number[];
  match_number?: number;
  best_of?: number;
  series_number?: number;
  radiant_team?: {
    id: number;
    name: string;
    tag?: string;
    logo_url?: string | null;
    region?: string | null;
  } | null;
  dire_team?: {
    id: number;
    name: string;
    tag?: string;
    logo_url?: string | null;
    region?: string | null;
  } | null;
  tournaments?: {
    id: number;
    name: string;
    slug: string;
    tier?: string | null;
  } | null;
}

interface MatchCardProps {
  match: MatchData;
  seriesMatches?: MatchData[];
  userSquadPlayers?: MatchSquadPlayer[];
  getSquadPlayersForMatch?: (match: MatchData) => MatchSquadPlayer[];
}

export function MatchCard({
  match: initialMatch,
  seriesMatches,
  userSquadPlayers = [],
  getSquadPlayersForMatch,
}: MatchCardProps) {
  const games = seriesMatches?.length
    ? seriesMatches
    : initialMatch.series_matches?.length ? initialMatch.series_matches : [initialMatch];
  const match = initialMatch;
  const seriesScore = summarizeMatchSeries(games, match.best_of ?? 3);
  const gamesAwaitingPlayerStats = getCompletedGamesAwaitingPlayerStats(games);
  const isRadiantWinner = seriesScore.clinchedTeamId === match.radiant_team_id;
  const isDireWinner = seriesScore.clinchedTeamId === match.dire_team_id;
  const isLive = seriesScore.isLive && !seriesScore.isComplete;
  const isCompleted = seriesScore.isComplete;
  const completedGames = games.filter((game) => game.status === 'completed');
  const displayGame = isCompleted
    ? completedGames[completedGames.length - 1] ?? games[games.length - 1] ?? match
    : games.find((game) => game.status === 'live')
      ?? games.find((game) => game.status === 'scheduled')
      ?? games[games.length - 1]
      ?? match;
  const squadPlayersById = new Map<number, MatchSquadPlayer>();
  if (getSquadPlayersForMatch) {
    for (const game of games) {
      for (const player of getSquadPlayersForMatch(game)) {
        const existing = squadPlayersById.get(player.id);
        if (!existing || player.confirmedAppearance) squadPlayersById.set(player.id, player);
      }
    }
  }
  const squadPlayers = getSquadPlayersForMatch ? [...squadPlayersById.values()] : userSquadPlayers;

  // Some teams were auto-registered during ingestion with their numeric provider ID as the name.
  // Detect this and display as "Team [number]" rather than a bare number.
  const formatTeamName = (name: string | undefined | null, fallback: string) => {
    if (!name) return fallback;
    if (/^\d+$/.test(name)) return `Team ${name}`;
    return name;
  };

  const formattedDate = new Date(displayGame.scheduled_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = new Date(displayGame.scheduled_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden ${
        squadPlayers.length > 0
          ? 'border-amber-400/70 bg-amber-950/20 shadow-[0_0_24px_rgba(245,158,11,0.12)] hover:border-amber-300'
          : isLive
          ? 'bg-slate-900/90 border-red-500/60 shadow-[0_0_25px_rgba(239,68,68,0.15)] hover:border-red-400'
          : 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700 hover:bg-slate-800/50 hover:shadow-xl hover:-translate-y-1'
      }`}
    >
      {/* Radiant and Dire ambient glows */}
      <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Card Header: Tournament, Series & Status */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-800/70 text-xs">
        <div className="flex items-center gap-2 truncate max-w-[65%]">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          <span className="font-semibold text-slate-300 truncate" title={match.tournaments?.name || 'Tournament'}>
            {match.tournaments?.name || 'Tournament'}
          </span>
          {match.best_of && (
            <span className="rounded border border-slate-700/60 bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
              Bo{match.best_of} Series
            </span>
          )}
        </div>

        <div>
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Live
            </span>
          ) : isCompleted ? (
            <span suppressHydrationWarning className="text-slate-400 font-medium font-mono text-[11px]">
              Series Final · {formattedDate}
            </span>
          ) : seriesScore.completedGames > 0 ? (
            <span suppressHydrationWarning className="text-amber-400/90 font-mono text-[11px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Game {seriesScore.completedGames + 1} · {formattedDate} {formattedTime}
            </span>
          ) : (
            <span suppressHydrationWarning className="text-amber-400/90 font-mono text-[11px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {formattedDate} {formattedTime}
            </span>
          )}
        </div>
      </div>

      {/* Main Matchup Arena */}
      <div className="px-4 py-5 flex items-stretch justify-between gap-2 sm:px-5 sm:py-6 sm:gap-3">
        {/* Radiant Side */}
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/5 py-3 text-center group/rad">
          <TeamLogo
            name={match.radiant_team?.name || 'Radiant'}
            logoUrl={match.radiant_team?.logo_url}
            tag={match.radiant_team?.tag}
            size="md"
            faction="radiant"
            isWinner={isRadiantWinner}
          />
          <div className="mt-2.5 max-w-30">
            <div
              className={`match-card-team-name text-sm font-bold truncate transition-colors ${
                isRadiantWinner
                  ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]'
                  : isCompleted
                  ? 'text-slate-400'
                  : 'text-slate-200'
              }`}
              title={match.radiant_team?.name || 'Radiant'}
            >
              {formatTeamName(match.radiant_team?.name, 'Radiant')}
            </div>
            <div className="text-[10px] text-emerald-400/70 font-semibold tracking-wide uppercase mt-0.5">
              Radiant
            </div>
          </div>
        </div>

        {/* Center Scoreboard / VS Pill */}
        <div className="shrink-0 flex flex-col items-center justify-center px-1 sm:px-2">
          {seriesScore.completedGames > 0 || isLive || isCompleted ? (
            <div className="match-card-score-pill flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-1.5 shadow-inner dark:border-slate-700/80 dark:bg-slate-950/80">
              <span
                className={`font-mono text-lg font-black ${
                  isRadiantWinner ? 'text-emerald-500 dark:text-emerald-400' : 'text-[var(--text-muted)]'
                }`}
              >
                {seriesScore.radiantWins}
              </span>
              <span className="text-[var(--text-muted)] font-bold">:</span>
              <span
                className={`font-mono text-lg font-black ${
                  isDireWinner ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--text-muted)]'
                }`}
              >
                {seriesScore.direWins}
              </span>
            </div>
          ) : (
            <div className="match-card-vs-pill w-9 h-9 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] flex items-center justify-center text-xs font-black text-[var(--text-secondary)] tracking-wider dark:border-slate-700 dark:bg-slate-800/80">
              VS
            </div>
          )}

          {seriesScore.completedGames > 0 && (
            <span className="text-[10px] text-slate-500 font-mono mt-1.5">
              {seriesScore.completedGames} {seriesScore.completedGames === 1 ? 'game' : 'games'} played
            </span>
          )}
        </div>

        {/* Dire Side */}
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/5 py-3 text-center group/dire">
          <TeamLogo
            name={match.dire_team?.name || 'Dire'}
            logoUrl={match.dire_team?.logo_url}
            tag={match.dire_team?.tag}
            size="md"
            faction="dire"
            isWinner={isDireWinner}
          />
          <div className="mt-2.5 max-w-30">
            <div
              className={`match-card-team-name text-sm font-bold truncate transition-colors ${
                isDireWinner
                  ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]'
                  : isCompleted
                  ? 'text-slate-400'
                  : 'text-slate-200'
              }`}
              title={match.dire_team?.name || 'Dire'}
            >
              {formatTeamName(match.dire_team?.name, 'Dire')}
            </div>
            <div className="text-[10px] text-rose-400/70 font-semibold tracking-wide uppercase mt-0.5">
              Dire
            </div>
          </div>
        </div>
      </div>

      {gamesAwaitingPlayerStats.length > 0 && (
        <p
          role="status"
          className="mx-4 mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
        >
          Player stats for {gamesAwaitingPlayerStats.length} completed {gamesAwaitingPlayerStats.length === 1 ? 'game are' : 'games are'} still being processed.
        </p>
      )}

      {/* Fantasy League Impact Footer */}
      {squadPlayers.length > 0 && (
        <div className="mx-4 mb-3 rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
            <Star className="h-4 w-4 shrink-0 fill-current" aria-hidden="true" />
            <span>
              {squadPlayers.every((player) => player.confirmedAppearance)
                ? 'Your players confirmed in this series'
                : 'Your squad team fixture · appearances unconfirmed'}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {squadPlayers.map((player) => (
              <span key={player.id} className="rounded-full border border-amber-500/30 bg-[var(--surface)] px-2 py-1 text-[10px] font-semibold text-[var(--text-primary)]">
                {player.name}
              </span>
            ))}
          </div>
          <span className="sr-only">
            {squadPlayers.length} {squadPlayers.length === 1 ? 'squad player is' : 'squad players are'}
            {squadPlayers.every((player) => player.confirmedAppearance)
              ? ' confirmed to have appeared in this series.'
              : ' on a team in this fixture; their appearance is not confirmed.'}
          </span>
        </div>
      )}

      {/* Hover action footer */}
      <div className="match-card-footer mt-auto px-5 py-2.5 bg-[var(--surface-raised)] border-t border-[var(--border)] dark:bg-slate-950/40 dark:border-slate-800/60 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <span className="match-card-footer-meta flex items-center gap-1 text-[11px]">
          {match.radiant_team?.region && (
            <span className="text-slate-500">{match.radiant_team.region} vs {match.dire_team?.region || 'INT'}</span>
          )}
        </span>
        <Link
          href={`/matches/${match.id}`}
          className="text-amber-400 group-hover:text-amber-300 font-medium flex items-center gap-1 transition-colors"
        >
          {games.length > 1 ? 'View Series Details' : 'View Match Details'}
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
