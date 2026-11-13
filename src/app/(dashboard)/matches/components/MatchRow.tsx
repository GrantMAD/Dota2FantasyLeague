import Link from 'next/link';
import { TeamLogo } from './TeamLogo';
import type { MatchData } from './MatchCard';
import type { MatchSquadPlayer } from '@/lib/match-squad-tracking';
import { getCompletedGamesAwaitingPlayerStats, summarizeMatchSeries } from '@/lib/match-series';

interface MatchRowProps {
  match: MatchData;
  seriesMatches?: MatchData[];
  userSquadPlayers?: MatchSquadPlayer[];
  getSquadPlayersForMatch?: (match: MatchData) => MatchSquadPlayer[];
}

export function MatchRow({
  match: initialMatch,
  seriesMatches,
  userSquadPlayers = [],
  getSquadPlayersForMatch,
}: MatchRowProps) {
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
      className={`group flex flex-col rounded-xl transition-all ${
        squadPlayers.length > 0
          ? 'border border-amber-400/70 bg-amber-500/10 shadow-[0_0_18px_rgba(245,158,11,0.1)] hover:border-amber-300'
          : 'border border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/60 hover:border-slate-700'
      }`}
    >
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between p-4 gap-4">
      {/* Left: Tournament & Status */}
      <div className="flex items-center gap-3 min-w-[200px]">
        {isLive ? (
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
        ) : (
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
        )}
        <div>
          <div className="text-xs font-semibold text-slate-300 truncate max-w-[180px]">
            {match.tournaments?.name || 'Tournament'}
          </div>
          <div suppressHydrationWarning className="text-[11px] text-slate-500 font-mono">
            {isLive ? (
              <span className="text-red-400 font-bold uppercase">Live Now</span>
            ) : isCompleted ? (
              <span>Series Final · {formattedDate}</span>
            ) : seriesScore.completedGames > 0 ? (
              <span>Game {seriesScore.completedGames + 1} · {formattedDate} {formattedTime}</span>
            ) : (
              <span>{formattedDate} {formattedTime}</span>
            )}
            {match.best_of && ` · Bo${match.best_of} · ${seriesScore.completedGames} played`}
          </div>
          </div>
        </div>
      </div>

      {/* Middle: Teams and Score */}
      <div className="flex-1 flex items-center justify-center gap-2 sm:gap-4">
        {/* Radiant */}
      <div className="flex-1 rounded-xl border border-emerald-500/25 bg-emerald-500/5 py-2 flex items-center justify-end gap-2.5">
          <span
            className={`text-sm font-bold truncate text-right ${
              isRadiantWinner ? 'text-white' : isCompleted ? 'text-slate-400' : 'text-slate-200'
            }`}
          >
            {match.radiant_team?.name || 'Radiant'}
          </span>
          <TeamLogo
            name={match.radiant_team?.name || 'Radiant'}
            logoUrl={match.radiant_team?.logo_url}
            tag={match.radiant_team?.tag}
            size="sm"
            faction="radiant"
            isWinner={isRadiantWinner}
          />
        </div>

        {/* Score / VS */}
        <div className="shrink-0 px-2 min-w-[70px] text-center">
          {seriesScore.completedGames > 0 || isLive || isCompleted ? (
            <span className="font-mono text-sm font-black px-2.5 py-1 rounded bg-slate-950 border border-slate-700/70 text-slate-300">
              <span className={isRadiantWinner ? 'text-emerald-400' : ''}>{seriesScore.radiantWins}</span>
              <span className="text-slate-600 mx-1">:</span>
              <span className={isDireWinner ? 'text-rose-400' : ''}>{seriesScore.direWins}</span>
            </span>
          ) : isLive ? (
            <span className="font-mono text-xs font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-800 animate-pulse">
              LIVE
            </span>
          ) : (
            <span className="text-xs font-black text-slate-500 bg-slate-800 px-2 py-1 rounded">
              VS
            </span>
          )}
        </div>

        {/* Dire */}
        <div className="flex-1 rounded-xl border border-rose-500/25 bg-rose-500/5 py-2 flex items-center justify-start gap-2.5">
          <TeamLogo
            name={match.dire_team?.name || 'Dire'}
            logoUrl={match.dire_team?.logo_url}
            tag={match.dire_team?.tag}
            size="sm"
            faction="dire"
            isWinner={isDireWinner}
          />
          <span
            className={`text-sm font-bold truncate text-left ${
              isDireWinner ? 'text-white' : isCompleted ? 'text-slate-400' : 'text-slate-200'
            }`}
          >
            {match.dire_team?.name || 'Dire'}
          </span>
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

      {/* Right: Fantasy squad badge & Action */}
      <div className="flex items-center justify-between md:justify-end gap-3 min-w-[160px]">
        {squadPlayers.length > 0 && (
          <span
            className="max-w-64 truncate rounded-lg border border-amber-500/45 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300"
            title={`${squadPlayers.every((player) => player.confirmedAppearance) ? 'Your players confirmed in this match' : 'Your squad players on these teams; appearances unconfirmed'}: ${squadPlayers.map((player) => player.name).join(', ')}`}
          >
            ⭐ {squadPlayers.every((player) => player.confirmedAppearance)
              ? 'Players appeared: '
              : 'Team fixture: '}
            {squadPlayers.map((player) => player.name).join(', ')}
          </span>
        )}
        <Link href={`/matches/${match.id}`} className="text-xs text-amber-400 group-hover:text-amber-300 font-medium flex items-center gap-0.5">
          {games.length > 1 ? 'Series Stats →' : 'Match Stats →'}
        </Link>
      </div>
    </div>
  );
}
