'use client';

import Link from 'next/link';
import { TeamLogo } from './TeamLogo';

export interface MatchData {
  id: number;
  status: 'completed' | 'live' | 'scheduled' | string;
  scheduled_at: string;
  duration_seconds: number | null;
  radiant_team_id: number;
  dire_team_id: number;
  winner_team_id: number | null;
  match_number?: number;
  best_of?: number;
  series_number?: number;
  radiant_team?: {
    id: number;
    name: string;
    tag?: string;
    logo_url?: string | null;
    region?: string;
  } | null;
  dire_team?: {
    id: number;
    name: string;
    tag?: string;
    logo_url?: string | null;
    region?: string;
  } | null;
  tournaments?: {
    id: number;
    name: string;
    slug: string;
    tier?: string;
  } | null;
}

interface MatchCardProps {
  match: MatchData;
  userSquadPlayerNames?: string[]; // e.g. ['Yatoro', 'Nisha']
}

export function MatchCard({ match, userSquadPlayerNames = [] }: MatchCardProps) {
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
      className={`group relative flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden ${
        isLive
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
            <span className="bg-slate-800 border border-slate-700/60 text-slate-400 text-[10px] px-1.5 py-0.5 rounded font-mono">
              Bo{match.best_of} · G{match.match_number || 1}
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
            <span className="text-slate-400 font-medium font-mono text-[11px]">
              Final · {formattedDate}
            </span>
          ) : (
            <span className="text-amber-400/90 font-mono text-[11px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {formattedDate} {formattedTime}
            </span>
          )}
        </div>
      </div>

      {/* Main Matchup Arena */}
      <div className="px-5 py-6 flex items-center justify-between gap-3">
        {/* Radiant Side */}
        <div className="flex-1 flex flex-col items-center text-center group/rad">
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
              {match.radiant_team?.name || 'Radiant'}
            </div>
            <div className="text-[10px] text-emerald-400/70 font-semibold tracking-wide uppercase mt-0.5">
              Radiant
            </div>
          </div>
        </div>

        {/* Center Scoreboard / VS Pill */}
        <div className="shrink-0 flex flex-col items-center justify-center px-2">
          {isCompleted ? (
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-1.5 shadow-inner">
              <span
                className={`font-mono text-lg font-black ${
                  isRadiantWinner ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {isRadiantWinner ? '1' : '0'}
              </span>
              <span className="text-slate-600 font-bold">:</span>
              <span
                className={`font-mono text-lg font-black ${
                  isDireWinner ? 'text-rose-400' : 'text-slate-400'
                }`}
              >
                {isDireWinner ? '1' : '0'}
              </span>
            </div>
          ) : isLive ? (
            <div className="flex flex-col items-center">
              <div className="bg-red-950/60 border border-red-600/50 rounded-lg px-3 py-1 font-mono font-black text-red-400 text-sm tracking-widest animate-pulse">
                LIVE
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-xs font-black text-slate-400 tracking-wider">
              VS
            </div>
          )}

          {isCompleted && match.duration_seconds && (
            <span className="text-[10px] text-slate-500 font-mono mt-1.5 flex items-center gap-1">
              ⏱ {formatDuration(match.duration_seconds)}
            </span>
          )}
        </div>

        {/* Dire Side */}
        <div className="flex-1 flex flex-col items-center text-center group/dire">
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
              {match.dire_team?.name || 'Dire'}
            </div>
            <div className="text-[10px] text-rose-400/70 font-semibold tracking-wide uppercase mt-0.5">
              Dire
            </div>
          </div>
        </div>
      </div>

      {/* Fantasy League Impact Footer */}
      {userSquadPlayerNames.length > 0 && (
        <div className="mx-4 mb-3 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
          <span className="text-amber-400 font-medium flex items-center gap-1.5 truncate">
            <span>⭐</span>
            <span className="truncate">
              {userSquadPlayerNames.length} squad {userSquadPlayerNames.length === 1 ? 'player' : 'players'}: {userSquadPlayerNames.join(', ')}
            </span>
          </span>
          <span className="text-[10px] text-amber-300/80 font-semibold uppercase shrink-0">Fantasy</span>
        </div>
      )}

      {/* Hover action footer */}
      <div className="match-card-footer mt-auto px-5 py-2.5 bg-slate-950/40 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <span className="match-card-footer-meta flex items-center gap-1 text-[11px]">
          {match.radiant_team?.region && (
            <span className="text-slate-500">{match.radiant_team.region} vs {match.dire_team?.region || 'INT'}</span>
          )}
        </span>
        <span className="text-amber-400 group-hover:text-amber-300 font-medium flex items-center gap-1 transition-colors">
          View Match Center
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
