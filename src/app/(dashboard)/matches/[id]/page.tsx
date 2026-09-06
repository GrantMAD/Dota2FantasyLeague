'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { TeamLogo } from '../components/TeamLogo';

type MatchDetail = {
  id: number;
  status: string;
  scheduled_at: string;
  duration_seconds: number | null;
  winner_team_id: number | null;
  radiant_team_id: number;
  dire_team_id: number;
  best_of?: number;
  match_number?: number;
  series_number?: number;
  radiant_team?: { id: number; name: string; tag?: string; logo_url?: string | null; region?: string } | null;
  dire_team?: { id: number; name: string; tag?: string; logo_url?: string | null; region?: string } | null;
  tournaments?: { id: number; name: string; tier?: string } | null;
  gameweeks?: { gameweek_number: number; status: string } | null;
};

type PlayerStat = {
  id: number;
  player_id: number;
  team_id: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_minute?: number;
  experience_per_minute?: number;
  hero_damage?: number;
  tower_participation?: number;
  wards_placed?: number;
  healing?: number;
  professional_players?: {
    id: number;
    name: string;
    in_game_name?: string | null;
    primary_role?: string | null;
    profile_image_url?: string | null;
  } | null;
};

type FantasyBreakdown = {
  player_id: number;
  total_points: number;
  combat_points?: number;
  economy_points?: number;
  objective_points?: number;
  win_points?: number;
};

type MatchApiResponse = {
  match?: MatchDetail;
  playerStats?: PlayerStat[];
  fantasyBreakdown?: FantasyBreakdown[];
};

export default function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [fantasyBreakdown, setFantasyBreakdown] = useState<FantasyBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMatch() {
      try {
        const response = await fetch(`/api/matches/${id}`);
        const data = (await response.json()) as MatchApiResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Failed to load match');
        setMatch(data.match ?? null);
        setPlayerStats(data.playerStats ?? []);
        setFantasyBreakdown(data.fantasyBreakdown ?? []);
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load match');
      } finally {
        setLoading(false);
      }
    }

    void loadMatch();
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Loading match center...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/40 border border-rose-800 flex items-center justify-center text-2xl mx-auto mb-4 text-rose-400">
          ⚠️
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white">Match Not Found</h1>
        <p className="mb-6 text-slate-400 text-sm">{error || 'This match could not be found.'}</p>
        <Link
          href="/matches"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
        >
          ← Return to Match Center
        </Link>
      </div>
    );
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isRadiantWinner = match.winner_team_id === match.radiant_team_id;
  const isDireWinner = match.winner_team_id === match.dire_team_id;
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';

  const fantasyPointsByPlayer = new Map<number, number>(
    fantasyBreakdown.map((f) => [f.player_id, Number(f.total_points || 0)])
  );

  const radiantStats = playerStats.filter((p) => p.team_id === match.radiant_team_id);
  const direStats = playerStats.filter((p) => p.team_id === match.dire_team_id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/matches"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
        >
          <span>←</span>
          <span>Back to All Matches</span>
        </Link>

        {match.gameweeks && (
          <span className="text-xs font-medium text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
            Gameweek {match.gameweeks.gameweek_number} · <span className="capitalize">{match.gameweeks.status}</span>
          </span>
        )}
      </div>

      {/* Hero Match Arena Card */}
      <div className="relative rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl overflow-hidden">
        {/* Glow ambient background effects */}
        <div className="absolute -top-10 -left-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 -right-10 w-60 h-60 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top bar: Tournament & Schedule */}
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-6 mb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-amber-400 text-xs font-semibold tracking-wide uppercase">
                {match.tournaments?.name || 'Professional Match'}
              </span>
              {match.tournaments?.tier && (
                <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded font-medium border border-slate-700">
                  {match.tournaments.tier}
                </span>
              )}
              {match.best_of && (
                <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded font-mono border border-slate-700">
                  Best of {match.best_of} · Game {match.match_number || 1}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {new Date(match.scheduled_at).toLocaleString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div>
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Live Now
              </span>
            ) : isCompleted ? (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Completed Match
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                {match.status.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Center Matchup Stage */}
        <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-6 py-4">
          {/* Radiant Team */}
          <div className="flex flex-col items-center md:items-end text-center md:text-right">
            <div className="flex items-center gap-4 flex-col-reverse md:flex-row">
              <div>
                <h2
                  className={`text-2xl font-black tracking-tight ${
                    isRadiantWinner ? 'text-white drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]' : 'text-slate-300'
                  }`}
                >
                  {match.radiant_team?.name || 'Radiant'}
                </h2>
                <div className="flex items-center justify-center md:justify-end gap-2 mt-1">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Radiant</span>
                  {match.radiant_team?.region && (
                    <span className="text-[11px] text-slate-500">({match.radiant_team.region})</span>
                  )}
                </div>
                {isRadiantWinner && (
                  <span className="inline-block mt-2 text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                    🏆 Victory
                  </span>
                )}
              </div>
              <TeamLogo
                name={match.radiant_team?.name || 'Radiant'}
                logoUrl={match.radiant_team?.logo_url}
                tag={match.radiant_team?.tag}
                size="lg"
                faction="radiant"
                isWinner={isRadiantWinner}
              />
            </div>
          </div>

          {/* Scoreboard / Timer */}
          <div className="flex flex-col items-center justify-center px-6">
            {isCompleted ? (
              <div className="flex items-center gap-3 bg-slate-950 border border-slate-700/80 rounded-2xl px-6 py-2.5 shadow-2xl">
                <span
                  className={`font-mono text-3xl font-black ${
                    isRadiantWinner ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {isRadiantWinner ? '1' : '0'}
                </span>
                <span className="text-slate-600 font-black text-xl">:</span>
                <span
                  className={`font-mono text-3xl font-black ${
                    isDireWinner ? 'text-rose-400' : 'text-slate-400'
                  }`}
                >
                  {isDireWinner ? '1' : '0'}
                </span>
              </div>
            ) : isLive ? (
              <div className="flex flex-col items-center">
                <span className="font-mono text-lg font-black text-red-400 bg-red-950 border border-red-700 px-4 py-1.5 rounded-xl animate-pulse">
                  IN PROGRESS
                </span>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-base font-black text-slate-400">
                VS
              </div>
            )}

            {isCompleted && match.duration_seconds && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 font-mono bg-slate-950/60 px-3 py-1 rounded-full border border-slate-800">
                <span>⏱ Duration:</span>
                <span className="font-bold text-white">{formatDuration(match.duration_seconds)}</span>
              </div>
            )}
          </div>

          {/* Dire Team */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <div className="flex items-center gap-4 flex-col md:flex-row">
              <TeamLogo
                name={match.dire_team?.name || 'Dire'}
                logoUrl={match.dire_team?.logo_url}
                tag={match.dire_team?.tag}
                size="lg"
                faction="dire"
                isWinner={isDireWinner}
              />
              <div>
                <h2
                  className={`text-2xl font-black tracking-tight ${
                    isDireWinner ? 'text-white drop-shadow-[0_0_12px_rgba(244,63,94,0.3)]' : 'text-slate-300'
                  }`}
                >
                  {match.dire_team?.name || 'Dire'}
                </h2>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">Dire</span>
                  {match.dire_team?.region && (
                    <span className="text-[11px] text-slate-500">({match.dire_team.region})</span>
                  )}
                </div>
                {isDireWinner && (
                  <span className="inline-block mt-2 text-xs font-bold text-rose-400 bg-rose-950/60 border border-rose-500/40 px-2.5 py-0.5 rounded-full">
                    🏆 Victory
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Player Stats & Fantasy Breakdown Section */}
      {playerStats.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📊</span>
              <span>Player Performance & Fantasy Points</span>
            </h3>
            <span className="text-xs text-slate-500">Calculated under official league rules</span>
          </div>

          {/* Radiant Roster Stats */}
          <div className="rounded-2xl border border-emerald-900/40 bg-slate-900/60 overflow-hidden">
            <div className="px-5 py-3 bg-emerald-950/30 border-b border-emerald-900/40 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase">
                {match.radiant_team?.name || 'Radiant'} Performances
              </span>
              {isRadiantWinner && <span className="text-[11px] font-bold text-emerald-400">Winner</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">K / D / A</th>
                    <th className="py-3 px-3">GPM / XPM</th>
                    <th className="py-3 px-3">Damage</th>
                    <th className="py-3 px-4 text-right">Fantasy Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {radiantStats.map((stat) => {
                    const playerName = stat.professional_players?.in_game_name || stat.professional_players?.name || 'Player';
                    const role = stat.professional_players?.primary_role || 'Core';
                    const fp = fantasyPointsByPlayer.get(stat.player_id);

                    return (
                      <tr key={stat.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                          <Link href={`/players/${stat.player_id}`} className="hover:text-amber-400 transition-colors">
                            {playerName}
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{role}</td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {stat.kills} / <span className="text-rose-400">{stat.deaths}</span> / {stat.assists}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {stat.gold_per_minute || '-'} / {stat.experience_per_minute || '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {stat.hero_damage ? Number(stat.hero_damage).toLocaleString() : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                            {fp !== undefined ? `${fp.toFixed(1)} pts` : '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dire Roster Stats */}
          <div className="rounded-2xl border border-rose-900/40 bg-slate-900/60 overflow-hidden">
            <div className="px-5 py-3 bg-rose-950/30 border-b border-rose-900/40 flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 tracking-wider uppercase">
                {match.dire_team?.name || 'Dire'} Performances
              </span>
              {isDireWinner && <span className="text-[11px] font-bold text-rose-400">Winner</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">K / D / A</th>
                    <th className="py-3 px-3">GPM / XPM</th>
                    <th className="py-3 px-3">Damage</th>
                    <th className="py-3 px-4 text-right">Fantasy Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {direStats.map((stat) => {
                    const playerName = stat.professional_players?.in_game_name || stat.professional_players?.name || 'Player';
                    const role = stat.professional_players?.primary_role || 'Core';
                    const fp = fantasyPointsByPlayer.get(stat.player_id);

                    return (
                      <tr key={stat.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                          <Link href={`/players/${stat.player_id}`} className="hover:text-amber-400 transition-colors">
                            {playerName}
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{role}</td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {stat.kills} / <span className="text-rose-400">{stat.deaths}</span> / {stat.assists}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {stat.gold_per_minute || '-'} / {stat.experience_per_minute || '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {stat.hero_damage ? Number(stat.hero_damage).toLocaleString() : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                            {fp !== undefined ? `${fp.toFixed(1)} pts` : '-'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/40 text-center">
          <p className="text-sm text-slate-400">
            Detailed player stats and fantasy point breakdowns will populate here once match data is processed.
          </p>
        </div>
      )}
    </div>
  );
}
