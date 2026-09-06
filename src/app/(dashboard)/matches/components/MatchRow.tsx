'use client';

import Link from 'next/link';
import { TeamLogo } from './TeamLogo';
import { MatchData } from './MatchCard';

interface MatchRowProps {
  match: MatchData;
  userSquadPlayerNames?: string[];
}

export function MatchRow({ match, userSquadPlayerNames = [] }: MatchRowProps) {
  const isRadiantWinner = match.winner_team_id === match.radiant_team_id;
  const isDireWinner = match.winner_team_id === match.dire_team_id;
  const isLive = match.status === 'live';
  const isCompleted = match.status === 'completed';

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formattedDate = new Date(match.scheduled_at).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = new Date(match.scheduled_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Link
      href={`/matches/${match.id}`}
      className="group flex flex-col md:flex-row items-stretch md:items-center justify-between p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl hover:bg-slate-800/60 hover:border-slate-700 transition-all gap-4"
    >
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
          <div className="text-[11px] text-slate-500 font-mono">
            {isLive ? (
              <span className="text-red-400 font-bold uppercase">Live Now</span>
            ) : isCompleted ? (
              <span>Final · {formattedDate}</span>
            ) : (
              <span>{formattedDate} {formattedTime}</span>
            )}
            {match.best_of && ` · Bo${match.best_of}`}
          </div>
        </div>
      </div>

      {/* Middle: Teams and Score */}
      <div className="flex-1 flex items-center justify-center gap-4">
        {/* Radiant */}
        <div className="flex-1 flex items-center justify-end gap-2.5">
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
          {isCompleted ? (
            <span className="font-mono text-sm font-black px-2.5 py-1 rounded bg-slate-950 border border-slate-700/70 text-slate-300">
              <span className={isRadiantWinner ? 'text-emerald-400' : ''}>{isRadiantWinner ? '1' : '0'}</span>
              <span className="text-slate-600 mx-1">:</span>
              <span className={isDireWinner ? 'text-rose-400' : ''}>{isDireWinner ? '1' : '0'}</span>
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
        <div className="flex-1 flex items-center justify-start gap-2.5">
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

      {/* Right: Fantasy squad badge & Action */}
      <div className="flex items-center justify-between md:justify-end gap-3 min-w-[160px]">
        {userSquadPlayerNames.length > 0 && (
          <span className="text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
            ⭐ {userSquadPlayerNames.length} squad
          </span>
        )}
        {isCompleted && match.duration_seconds && (
          <span className="text-xs text-slate-500 font-mono">
            {formatDuration(match.duration_seconds)}
          </span>
        )}
        <span className="text-xs text-amber-400 group-hover:text-amber-300 font-medium flex items-center gap-0.5">
          Stats →
        </span>
      </div>
    </Link>
  );
}
