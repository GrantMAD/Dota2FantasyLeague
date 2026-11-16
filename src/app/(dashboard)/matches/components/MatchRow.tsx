'use client';

import Link from 'next/link';
import { Star, ChevronRight } from 'lucide-react';
import { TeamLogo } from './TeamLogo';
import { formatTeamName, type MatchData } from './MatchCard';
import type { MatchSquadPlayer } from '@/lib/match-squad-tracking';
import { getCompletedGamesAwaitingPlayerStats, getEffectiveBestOf, summarizeMatchSeries } from '@/lib/match-series';

interface MatchRowProps {
  match: MatchData;
  seriesMatches?: MatchData[];
  userSquadPlayers?: MatchSquadPlayer[];
  getSquadPlayersForMatch?: (match: MatchData) => MatchSquadPlayer[];
}

/** Inline dots for the list row — compact sizing */
function RowSeriesDots({
  games,
  bestOf,
  radiantTeamId,
}: {
  games: MatchData[];
  bestOf: number;
  radiantTeamId: number;
}) {
  const slots: (MatchData | null)[] = Array.from({ length: bestOf }, (_, i) => games[i] ?? null);

  return (
    <span className="inline-flex items-center gap-1" aria-label="Series results">
      {slots.map((game, i) => {
        const key = game?.id ?? `empty-${i}`;
        if (!game || game.status === 'scheduled') {
          return (
            <span
              key={key}
              className="w-1.5 h-1.5 rounded-full border border-[var(--border)] opacity-30"
            />
          );
        }
        if (game.status === 'live' || game.status === 'in_progress') {
          return (
            <span key={key} className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          );
        }
        const radiantWon = game.winner_team_id === radiantTeamId;
        return (
          <span
            key={key}
            className={`w-1.5 h-1.5 rounded-full ${radiantWon ? 'bg-emerald-400' : 'bg-rose-400'}`}
          />
        );
      })}
    </span>
  );
}

export function MatchRow({
  match: initialMatch,
  seriesMatches,
  userSquadPlayers = [],
  getSquadPlayersForMatch,
}: MatchRowProps) {
  const games = seriesMatches?.length
    ? seriesMatches
    : (initialMatch.series_matches?.length ? initialMatch.series_matches : [initialMatch]);

  const match = initialMatch;
  const bestOf = getEffectiveBestOf(games, match.best_of);
  const isSeries = bestOf > 1;

  const seriesScore = summarizeMatchSeries(games, bestOf);
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

  // ── Status column config ────────────────────────────────────────────────────
  const statusBg = isLive
    ? 'bg-rose-500/10 border-r border-rose-500/20'
    : isCompleted
    ? 'bg-[var(--surface-raised)] border-r border-[var(--border)]'
    : 'bg-[var(--surface-raised)] border-r border-[var(--border)]';

  const statusLabel = isLive ? 'LIVE' : isCompleted ? (bestOf > 1 ? 'SERIES\nCOMPLETE' : 'COMPLETED') : formattedTime;
  const statusSub = isLive ? null : isCompleted ? formattedDate : formattedDate;
  const statusTextColor = isLive ? 'text-rose-500' : isCompleted ? 'text-[var(--text-muted)]' : 'text-[var(--accent-primary)]';

  // ── Card outline ────────────────────────────────────────────────────────────
  const cardBorder = hasSquad
    ? 'border-amber-400/40'
    : isLive
    ? 'border-rose-500/30'
    : 'border-[var(--border)]';

  const radiantDim = isCompleted && !isRadiantWinner;
  const direDim = isCompleted && !isDireWinner;

  return (
    <div
      className={`group flex flex-col rounded-xl border overflow-hidden transition-all duration-150 hover:shadow-lg bg-[var(--surface)] ${cardBorder}`}
    >
      <div className="flex items-stretch">

        {/* ── Left status column ── */}
        <div
          className={`w-[64px] shrink-0 flex flex-col items-center justify-center gap-0.5 py-3 ${statusBg}`}
        >
          {isLive && (
            <span className="relative flex h-2 w-2 mb-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
          )}
          <span className={`text-center text-[10px] font-black uppercase tracking-wide leading-tight whitespace-pre-line ${statusTextColor}`}>
            {statusLabel}
          </span>
          {statusSub && (
            <span className="text-[9px] text-[var(--text-muted)] leading-none mt-0.5">
              {statusSub}
            </span>
          )}
        </div>

        {/*
          ── Main content ──────────────────────────────────────────────────────
          Layout uses three fixed-width flanks around the teams+score centre
          so every row in the list is identically aligned:

            [status 64px] | [px-4] [team–score–team flex-1] [meta w-44] [action w-14] |
                                        ↑ always same width, score always centred
        */}
        <div className="flex-1 flex items-center min-w-0 py-3">

          {/* Teams + score — takes all remaining space between meta and action */}
          <div className="flex-1 flex items-center px-4 gap-3 min-w-0">

            {/* Radiant — right-aligned inside its half */}
            <div className={`flex-1 flex items-center justify-end gap-2 min-w-0 transition-opacity ${radiantDim ? 'opacity-35' : ''}`}>
              <span
                className={`text-sm font-bold text-right truncate ${isRadiantWinner ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}
                title={match.radiant_team?.name ?? 'Radiant'}
              >
                {formatTeamName(match.radiant_team?.name, 'Radiant')}
              </span>
              <TeamLogo
                name={match.radiant_team?.name ?? 'Radiant'}
                logoUrl={match.radiant_team?.logo_url}
                tag={match.radiant_team?.tag}
                size="sm"
                faction="radiant"
                isWinner={isRadiantWinner}
              />
            </div>

            {/* Score / VS — fixed width so colon never shifts */}
            <div className="w-14 shrink-0 flex items-center justify-center gap-1">
              {hasScore ? (
                <>
                  <span
                    className={`text-lg font-black tabular-nums leading-none ${isRadiantWinner ? 'text-emerald-400' : isCompleted ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}
                  >
                    {seriesScore.radiantWins}
                  </span>
                  <span className="text-[var(--border)] font-bold text-sm">:</span>
                  <span
                    className={`text-lg font-black tabular-nums leading-none ${isDireWinner ? 'text-rose-400' : isCompleted ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}
                  >
                    {seriesScore.direWins}
                  </span>
                </>
              ) : (
                <span className="text-[11px] font-black text-[var(--text-muted)] tracking-widest">VS</span>
              )}
            </div>

            {/* Dire — left-aligned inside its half */}
            <div className={`flex-1 flex items-center gap-2 min-w-0 transition-opacity ${direDim ? 'opacity-35' : ''}`}>
              <TeamLogo
                name={match.dire_team?.name ?? 'Dire'}
                logoUrl={match.dire_team?.logo_url}
                tag={match.dire_team?.tag}
                size="sm"
                faction="dire"
                isWinner={isDireWinner}
              />
              <span
                className={`text-sm font-bold truncate ${isDireWinner ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}
                title={match.dire_team?.name ?? 'Dire'}
              >
                {formatTeamName(match.dire_team?.name, 'Dire')}
              </span>
            </div>
          </div>

          {/* Tournament + series info — ALWAYS fixed w-44, hidden on mobile */}
          <div className="hidden lg:flex w-44 shrink-0 flex-col items-end justify-center gap-1 pr-3 border-l border-[var(--border)] pl-3">
            <span
              className="text-[11px] text-[var(--text-muted)] truncate w-full text-right"
              title={match.tournaments?.name}
            >
              {match.tournaments?.name ?? 'Tournament'}
            </span>
            <div className="flex items-center gap-2 justify-end">
              <span className="text-[10px] font-mono font-bold text-[var(--text-muted)] bg-[var(--surface-raised)] border border-[var(--border)] px-1.5 py-0.5 rounded">
                {bestOf === 1 ? 'Bo1' : `Bo${bestOf}`}
              </span>
              {isSeries && (
                <RowSeriesDots
                  games={games}
                  bestOf={bestOf}
                  radiantTeamId={match.radiant_team_id}
                />
              )}
            </div>
          </div>

          {/* Action — ALWAYS fixed w-14 so it never shifts anything left */}
          <div className="w-14 shrink-0 flex items-center justify-center gap-2">
            {hasSquad && (
              <Star
                className="hidden lg:block w-3.5 h-3.5 text-amber-400 fill-current"
                aria-label="Your squad players in this match"
              />
            )}
            <Link
              href={`/matches/${match.id}`}
              aria-label={games.length > 1 ? 'View series details' : 'View match details'}
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all group-hover:border-[var(--text-secondary)]"
            >
              <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats processing notice (full width) ── */}
      {gamesAwaitingPlayerStats.length > 0 && (
        <p
          role="status"
          className="px-4 py-2 border-t border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-800 dark:text-amber-200"
        >
          Player stats for {gamesAwaitingPlayerStats.length}{' '}
          {gamesAwaitingPlayerStats.length === 1 ? 'game' : 'games'} still processing.
        </p>
      )}

      {/* ── Squad strip (full width, only on mobile since desktop shows the star icon) ── */}
      {hasSquad && (
        <div className="flex lg:hidden items-center gap-2 px-4 py-2 border-t border-amber-400/20 bg-amber-400/[0.05]">
          <Star className="h-3 w-3 shrink-0 text-amber-400 fill-current" aria-hidden />
          <span className="text-[11px] text-amber-500 dark:text-amber-300 font-semibold truncate">
            {squadPlayers.every((p) => p.confirmedAppearance)
              ? `Squad appeared: ${squadPlayers.map((p) => p.name).join(', ')}`
              : `Squad fixture: ${squadPlayers.map((p) => p.name).join(', ')}`}
          </span>
        </div>
      )}
    </div>
  );
}
