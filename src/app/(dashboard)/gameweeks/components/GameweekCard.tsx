import Link from 'next/link';
import { Activity, CalendarClock, Flame, Trophy, Zap } from 'lucide-react';
import type { GameweekRow } from '../page';
import { formatGameweekDate, formatGameweekDeadline } from '../gameweeks-utils';

interface GameweekCardProps {
  gameweek: GameweekRow;
  compact?: boolean;
}

export function GameweekCard({ gameweek, compact = false }: GameweekCardProps) {
  const statusLabel =
    gameweek.status === 'active'
      ? 'Active'
      : gameweek.status === 'upcoming'
        ? 'Upcoming'
        : gameweek.status === 'locked'
          ? 'Locked'
          : 'Closed';

  const borderTone =
    gameweek.status === 'active'
      ? 'border-amber-500/40 bg-amber-500/[0.04]'
      : gameweek.status === 'upcoming'
        ? 'border-sky-500/30 bg-sky-500/[0.03]'
        : 'border-slate-800 bg-slate-950/60';

  const doubleTeams = gameweek.flags.filter((flag) => flag.flag === 'double');
  const blankTeams = gameweek.flags.filter((flag) => flag.flag === 'blank');

  return (
    <div className={`rounded-2xl border p-5 shadow-lg shadow-slate-950/30 transition hover:-translate-y-0.5 ${borderTone}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            GW {gameweek.gameweek_number}
          </div>
          <h3 className="text-xl font-bold text-white">{statusLabel}</h3>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
          {gameweek.match_count} matches
        </span>
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <CalendarClock className="h-4 w-4 text-slate-400" />
        <span>
          {formatGameweekDate(gameweek.start_date)} - {formatGameweekDate(gameweek.end_date)}
        </span>
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
        <Activity className="h-4 w-4 text-slate-400" />
        <span>Deadline {formatGameweekDeadline(gameweek.deadline)}</span>
      </div>

      {(doubleTeams.length > 0 || blankTeams.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {doubleTeams.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300">
              <Zap className="h-3.5 w-3.5" />
              Double GW
            </span>
          )}
          {blankTeams.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-300">
              <Flame className="h-3.5 w-3.5" />
              Blank GW
            </span>
          )}
        </div>
      )}

      {gameweek.tournaments.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-300">
          {gameweek.tournaments.slice(0, 2).map((tournament) => (
            <span key={tournament.id} className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-1">
              {tournament.name}
            </span>
          ))}
        </div>
      )}

      {gameweek.status === 'closed' || gameweek.status === 'locked' ? (
        <div className="space-y-3 border-t border-slate-800 pt-4">
          {gameweek.user_score !== null && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-200">
              <span>Your Score</span>
              <span className="font-bold text-white">{gameweek.user_score.toFixed(1)} pts</span>
            </div>
          )}

          {gameweek.top_scorer && (
            <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                Top Scorer
              </span>
              <span className="text-white">{gameweek.top_scorer.in_game_name || gameweek.top_scorer.name} ({gameweek.top_scorer.total_points.toFixed(1)} pts)</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 border-t border-slate-800 pt-4 text-sm text-slate-300">
          <div className="flex items-center justify-between">
            <span>Fixture focus</span>
            <span>{gameweek.match_count} matches</span>
          </div>
          {gameweek.flags.length > 0 && (
            <div className="flex items-center justify-between">
              <span>Planning notes</span>
              <span>{doubleTeams.length > 0 ? 'DGW' : blankTeams.length > 0 ? 'BGW' : 'Standard'}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
        {gameweek.status === 'active' ? (
          <Link href="/lineups" className="text-sm font-medium text-amber-300 hover:text-amber-200">
            Manage Lineup →
          </Link>
        ) : gameweek.status === 'upcoming' ? (
          <Link href="/transfers" className="text-sm font-medium text-sky-300 hover:text-sky-200">
            Review Transfers →
          </Link>
        ) : (
          <Link href={`/gameweeks/${gameweek.id}`} className="text-sm font-medium text-slate-300 hover:text-white">
            View Results →
          </Link>
        )}

        <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
          {compact ? 'Quick view' : 'Full card'}
        </span>
      </div>
    </div>
  );
}
