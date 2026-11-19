'use client';

import Link from 'next/link';
import { Star, ChevronRight } from 'lucide-react';
import { TeamLogo } from './TeamLogo';
import type { MatchSquadPlayer } from '@/lib/match-squad-tracking';
import { getCompletedGamesAwaitingPlayerStats, getEffectiveBestOf, summarizeMatchSeries } from '@/lib/match-series';

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

export function formatTeamName(name: string | undefined | null, fallback: string): string {
  if (!name) return fallback;
  if (/^\d+$/.test(name)) return `Team ${name}`;
  return name;
}

/**
 * Row of small coloured dots showing each game's outcome in a Best-of series.
 * Emerald = Radiant won that game, Rose = Dire won, pulsing white = live game, ghost = not yet played.
 */
function SeriesDots({
  games,
  bestOf,
  radiantTeamId,
  size = 'md',
}: {
  games: MatchData[];
  bestOf: number;
  radiantTeamId: number;
  size?: 'sm' | 'md';
}) {
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  const slots: (MatchData | null)[] = Array.from({ length: bestOf }, (_, i) => games[i] ?? null);

  return (
    <span className="inline-flex items-center gap-1.5" aria-label="Series game results">
      {slots.map((game, i) => {
        const key = game?.id ?? `empty-${i}`;
        if (!game || game.status === 'scheduled') {
          return (
            <span
              key={key}
              aria-label={`Game ${i + 1}: not yet played`}
              className={`${dotSize} rounded-full border border-[var(--border)] opacity-30`}
            />
          );
        }
        if (game.status === 'live' || game.status === 'in_progress') {
          return (
            <span key={key} aria-label={`Game ${i + 1}: live`} className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-50" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
          );
        }
        // completed — colour by who won relative to the representative match's radiant side
        const radiantWon = game.winner_team_id === radiantTeamId;
        return (
          <span
            key={key}
            aria-label={`Game ${i + 1}: ${radiantWon ? 'Radiant' : 'Dire'} won`}
            className={`${dotSize} rounded-full ${radiantWon ? 'bg-emerald-400' : 'bg-rose-400'}`}
          />
        );
      })}
    </span>
  );
}

export function MatchCard({
  match: initialMatch,
  seriesMatches,
  userSquadPlayers = [],
  getSquadPlayersForMatch,
}: MatchCardProps) {
  const games = seriesMatches?.length
    ? seriesMatches
    : (initialMatch.series_matches?.length ? initialMatch.series_matches : [initialMatch]);

  const match = initialMatch;
  const bestOf = getEffectiveBestOf(games, match.best_of);
  const isSeries = bestOf > 1;

  const seriesScore = summarizeMatchSeries(games, bestOf, match.radiant_team_id, match.dire_team_id);
  const gamesAwaitingPlayerStats = getCompletedGamesAwaitingPlayerStats(games);
  const isRadiantWinner = seriesScore.clinchedTeamId === match.radiant_team_id;
  const isDireWinner = seriesScore.clinchedTeamId === match.dire_team_id;
  const isLive = seriesScore.isLive && !seriesScore.isComplete;
  const isCompleted = seriesScore.isComplete;
  const hasScore = seriesScore.completedGames > 0 || isLive || isCompleted;

  // Squad players
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
  const hasSquad = squadPlayers.length > 0;

  const displayGame = isCompleted
    ? games.filter((g) => g.status === 'completed').at(-1) ?? games.at(-1) ?? match
    : games.find((g) => g.status === 'live') ??
      games.find((g) => g.status === 'scheduled') ??
      games.at(-1) ??
      match;

  const formattedDate = new Date(displayGame.scheduled_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = new Date(displayGame.scheduled_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // ── Card border + accent line colour by state ──────────────────────────────
  const cardBorder = hasSquad
    ? 'border-amber-400/40'
    : isLive
    ? 'border-rose-500/35'
    : 'border-[var(--border)]';

  const accentLine = isLive
    ? 'bg-rose-500'
    : isCompleted
    ? 'bg-[var(--border)]'
    : hasSquad
    ? 'bg-amber-400'
    : 'bg-[var(--accent-primary)]';

  // ── Loser dim ──────────────────────────────────────────────────────────────
  const radiantDim = isCompleted && !isRadiantWinner;
  const direDim = isCompleted && !isDireWinner;

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl bg-[var(--surface)] ${cardBorder}`}
    >
      {/* ── Coloured top accent line ── */}
      <div className={`h-[3px] w-full ${accentLine} ${isLive ? 'animate-pulse' : ''}`} />

      {/* ── Header: tournament name + status chip ── */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2.5">
        <span
          className="text-[11px] font-semibold text-[var(--text-muted)] truncate"
          title={match.tournaments?.name ?? 'Tournament'}
        >
          {match.tournaments?.name ?? 'Tournament'}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Bo badge */}
          <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] bg-[var(--surface-raised)] border border-[var(--border)] px-1.5 py-0.5 rounded-md">
            {bestOf === 1 ? 'Bo1' : `Bo${bestOf}`}
          </span>
          {/* Status chip */}
          {isLive ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              Live
            </span>
          ) : isCompleted ? (
            <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--surface-raised)] border border-[var(--border)] px-2 py-0.5 rounded-full">
              {bestOf > 1 ? 'Series complete' : 'Completed'}
            </span>
          ) : (
            <span suppressHydrationWarning className="text-[11px] font-semibold text-[var(--accent-primary)] bg-[var(--surface-raised)] border border-[var(--border)] px-2 py-0.5 rounded-full">
              {formattedDate}
            </span>
          )}
        </div>
      </div>

      {/* ── Main matchup ── */}
      <div className="flex items-center px-4 pb-4 gap-2">

        {/* Radiant team */}
        <div className={`flex-1 flex flex-col items-center gap-2.5 py-4 transition-opacity duration-200 ${radiantDim ? 'opacity-35' : ''}`}>
          <TeamLogo
            name={match.radiant_team?.name ?? 'Radiant'}
            logoUrl={match.radiant_team?.logo_url}
            tag={match.radiant_team?.tag}
            size="lg"
            faction="radiant"
            isWinner={isRadiantWinner}
          />
          <div className="text-center space-y-0.5">
            <div
              className={`text-[13px] font-black tracking-tight leading-none truncate max-w-[88px] ${isRadiantWinner ? 'text-[var(--text-primary)]' : isCompleted ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}
              title={match.radiant_team?.name ?? 'Radiant'}
            >
              {formatTeamName(match.radiant_team?.name, 'Radiant')}
            </div>
            <div className="text-[9px] font-bold tracking-widest uppercase text-emerald-500/60">
              Radiant
            </div>
          </div>
        </div>

        {/* Centre: score + series dots */}
        <div className="shrink-0 flex flex-col items-center gap-2 px-1">
          {hasScore ? (
            /* Score */
            <div className="flex items-baseline gap-1">
              <span
                className={`text-[42px] font-black tabular-nums leading-none ${isRadiantWinner ? 'text-emerald-400' : isCompleted ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}
              >
                {seriesScore.radiantWins}
              </span>
              <span className="text-2xl font-bold text-[var(--border)] pb-0.5">:</span>
              <span
                className={`text-[42px] font-black tabular-nums leading-none ${isDireWinner ? 'text-rose-400' : isCompleted ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}
              >
                {seriesScore.direWins}
              </span>
            </div>
          ) : (
            /* VS pill — no games started yet */
            <div className="w-12 h-12 rounded-full border-2 border-[var(--border)] bg-[var(--surface-raised)] flex items-center justify-center">
              <span className="text-xs font-black tracking-widest text-[var(--text-muted)]">VS</span>
            </div>
          )}

          {/* Bo3/Bo5 game dots */}
          {isSeries && (
            <SeriesDots
              games={games}
              bestOf={bestOf}
              radiantTeamId={match.radiant_team_id}
            />
          )}

          {/* Bo1 — scheduled time below VS */}
          {!isSeries && !hasScore && (
            <span suppressHydrationWarning className="text-[10px] text-[var(--text-muted)] font-mono">
              {formattedTime}
            </span>
          )}

          {/* Games played count for in-progress series */}
          {isSeries && !isCompleted && seriesScore.completedGames > 0 && (
            <span className="text-[10px] text-[var(--text-muted)] font-mono leading-none">
              G{seriesScore.completedGames + 1} of {bestOf}
            </span>
          )}
        </div>

        {/* Dire team */}
        <div className={`flex-1 flex flex-col items-center gap-2.5 py-4 transition-opacity duration-200 ${direDim ? 'opacity-35' : ''}`}>
          <TeamLogo
            name={match.dire_team?.name ?? 'Dire'}
            logoUrl={match.dire_team?.logo_url}
            tag={match.dire_team?.tag}
            size="lg"
            faction="dire"
            isWinner={isDireWinner}
          />
          <div className="text-center space-y-0.5">
            <div
              className={`text-[13px] font-black tracking-tight leading-none truncate max-w-[88px] ${isDireWinner ? 'text-[var(--text-primary)]' : isCompleted ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}
              title={match.dire_team?.name ?? 'Dire'}
            >
              {formatTeamName(match.dire_team?.name, 'Dire')}
            </div>
            <div className="text-[9px] font-bold tracking-widest uppercase text-rose-500/60">
              Dire
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats processing notice ── */}
      {gamesAwaitingPlayerStats.length > 0 && (
        <p
          role="status"
          className="mx-4 mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200"
        >
          Player stats for {gamesAwaitingPlayerStats.length}{' '}
          {gamesAwaitingPlayerStats.length === 1 ? 'game' : 'games'} still processing.
        </p>
      )}

      {/* ── Footer — left side shows squad info when present, date otherwise ── */}
      <div className={`mt-auto flex items-center justify-between gap-2 px-4 py-2.5 border-t ${
        hasSquad
          ? 'border-amber-400/30 bg-amber-400/[0.09]'
          : 'border-[var(--border)] bg-[var(--surface-raised)]'
      }`}>

        {hasSquad ? (
          /* Squad info replaces the date — same single-line height, no extra row */
          <div className="flex items-center gap-1.5 min-w-0">
            <Star className="h-3 w-3 shrink-0 text-amber-400 fill-current" aria-hidden />
            <span className="text-[11px] font-bold text-amber-500 dark:text-amber-300 truncate">
              {squadPlayers.every((p) => p.confirmedAppearance) ? 'Appeared' : 'Fixture'}
              {' · '}
              <span className="font-semibold text-amber-600/80 dark:text-amber-400/80">
                {squadPlayers.map((p) => p.name).join(', ')}
              </span>
            </span>
          </div>
        ) : (
          <span suppressHydrationWarning className="text-[11px] text-[var(--text-muted)]">
            {isCompleted
              ? formattedDate
              : !hasScore
              ? formattedTime
              : isLive
              ? 'In progress'
              : `${formattedDate} · ${formattedTime}`}
          </span>
        )}

        <Link
          href={`/matches/${match.id}`}
          className={`shrink-0 inline-flex items-center gap-0.5 text-[11px] font-semibold transition-colors group/link ${
            hasSquad
              ? 'text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {games.length > 1 ? 'View Series' : 'View Match'}
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
