'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { use, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Share2, Check, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { TeamLogo } from '../components/TeamLogo';

import { MatchFantasyImpactBanner, type UserFantasyImpact } from '../components/MatchFantasyImpactBanner';
import { MatchLeadersStrip } from '../components/MatchLeadersStrip';

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
  hero_name?: string | null;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_minute?: number;
  experience_per_minute?: number;
  hero_damage?: number;
  tower_damage?: number;
  tower_participation?: number;
  wards_placed?: number;
  wards_destroyed?: number;
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
  teamfight_points?: number;
  win_points?: number;
  series_points?: number;
  performance_index_points?: number;
  consistency_points?: number;
  penalty_points?: number;
};

type MatchApiResponse = {
  match?: MatchDetail;
  playerStats?: PlayerStat[];
  fantasyBreakdown?: FantasyBreakdown[];
  userFantasyImpact?: UserFantasyImpact | null;
};

function MatchDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8 animate-pulse" role="status" aria-label="Loading match center">
      <div className="flex items-center justify-between">
        <div className="h-4 w-36 rounded bg-slate-800" />
        <div className="h-7 w-28 rounded-lg bg-slate-800" />
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="space-y-3">
            <div className="h-4 w-40 rounded bg-slate-800" />
            <div className="h-3 w-52 rounded bg-slate-800" />
          </div>
          <div className="h-8 w-24 rounded-full bg-slate-800" />
        </div>
        <div className="grid grid-cols-1 items-center gap-6 py-6 md:grid-cols-[1fr_auto_1fr]">
          {[1, 2].map((team) => (
            <div key={team} className={`flex flex-col items-center gap-4 ${team === 1 ? 'md:items-end' : 'md:items-start'}`}>
              <div className="h-20 w-20 rounded-2xl bg-slate-800" />
              <div className="h-6 w-40 max-w-[50vw] rounded bg-slate-800" />
              <div className="h-3 w-20 rounded bg-slate-800" />
            </div>
          ))}
          <div className="mx-auto h-16 w-28 rounded-2xl border border-slate-800 bg-slate-950" />
        </div>
      </section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
        <div className="mb-5 h-6 w-48 rounded bg-slate-800" />
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="grid grid-cols-2 gap-4 border-t border-slate-800 py-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((cell) => <div key={cell} className="h-4 rounded bg-slate-800" />)}
          </div>
        ))}
      </section>
    </div>
  );
}

function MatchDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const fromGameweek = searchParams.get('from') === 'gameweek';
  const gwId = searchParams.get('gwId');
  const toast = useToast();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [fantasyBreakdown, setFantasyBreakdown] = useState<FantasyBreakdown[]>([]);
  const [userFantasyImpact, setUserFantasyImpact] = useState<UserFantasyImpact | null>(null);
  const [viewMode, setViewMode] = useState<'fantasy' | 'traditional'>('fantasy');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMatch() {
      try {
        const response = await fetchWithAuth(`/api/matches/${id}`);
        const data = (await response.json()) as MatchApiResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Failed to load match');
        setMatch(data.match ?? null);
        setPlayerStats(data.playerStats ?? []);
        setFantasyBreakdown(data.fantasyBreakdown ?? []);
        setUserFantasyImpact(data.userFantasyImpact ?? null);
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load match');
      } finally {
        setLoading(false);
      }
    }

    void loadMatch();
  }, [id]);

  if (loading) {
    return <MatchDetailSkeleton />;
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

  const fantasyMap = new Map<number, FantasyBreakdown>(
    fantasyBreakdown.map((f) => [f.player_id, f])
  );
  const fantasyPointsByPlayer = new Map<number, number>(
    fantasyBreakdown.map((f) => [f.player_id, Number(f.total_points || 0)])
  );

  const lineupDetailMap = new Map<number, { slot: string; isCaptain: boolean; isViceCaptain: boolean; isStarter: boolean }>(
    (userFantasyImpact?.lineupDetails ?? []).map((d) => [d.playerId, d])
  );
  const userOwnedSet = new Set<number>(userFantasyImpact?.userOwnedPlayerIds ?? []);

  // Some teams were auto-registered during ingestion with their numeric provider ID as the name or 'Team null'.
  const formatTeamName = (name: string | undefined | null, teamId: number | undefined | null, fallback: string) => {
    if (!name || name === 'Team null' || name === 'null') {
      return teamId ? `Team #${teamId}` : fallback;
    }
    if (/^\d+$/.test(name)) return `Team ${name}`;
    return name;
  };

  const cleanPlayerName = (stat: PlayerStat): string => {
    const raw = stat.professional_players?.in_game_name || stat.professional_players?.name || '';
    if (!raw || /^Player\s*\(/i.test(raw)) {
      if (stat.hero_name && stat.hero_name.toLowerCase() !== 'unknown' && !/^Hero\s+\d+$/i.test(stat.hero_name)) return stat.hero_name;
      return `Player #${stat.player_id}`;
    }
    return raw;
  };

  const radiantStats = playerStats.filter((p) => p.team_id === match.radiant_team_id);
  const direStats = playerStats.filter((p) => p.team_id === match.dire_team_id);

  // Calculate Match Leaders
  let fantasyMVP: { playerId: number; playerName: string; heroName?: string | null; role: string; value: number; formattedValue: string } | null = null;
  let highestDamage: { playerId: number; playerName: string; heroName?: string | null; role: string; value: number; formattedValue: string } | null = null;
  let highestGPM: { playerId: number; playerName: string; heroName?: string | null; role: string; value: number; formattedValue: string } | null = null;
  let highestKills: { playerId: number; playerName: string; heroName?: string | null; role: string; value: number; formattedValue: string } | null = null;

  for (const s of playerStats) {
    const pName = cleanPlayerName(s);
    const role = s.professional_players?.primary_role || 'Core';
    const pts = fantasyPointsByPlayer.get(s.player_id) ?? 0;
    const dmg = Number(s.hero_damage || 0);
    const gpm = Number(s.gold_per_minute || 0);
    const kills = Number(s.kills || 0);

    if (!fantasyMVP || pts > fantasyMVP.value) {
      fantasyMVP = { playerId: s.player_id, playerName: pName, heroName: s.hero_name, role, value: pts, formattedValue: `${pts.toFixed(1)} pts` };
    }
    if (!highestDamage || dmg > highestDamage.value) {
      highestDamage = { playerId: s.player_id, playerName: pName, heroName: s.hero_name, role, value: dmg, formattedValue: dmg.toLocaleString() };
    }
    if (!highestGPM || gpm > highestGPM.value) {
      highestGPM = { playerId: s.player_id, playerName: pName, heroName: s.hero_name, role, value: gpm, formattedValue: `${gpm} GPM` };
    }
    if (!highestKills || kills > highestKills.value) {
      highestKills = { playerId: s.player_id, playerName: pName, heroName: s.hero_name, role, value: kills, formattedValue: `${kills} kills` };
    }
  }

  const renderRosterTable = (stats: PlayerStat[], teamFaction: 'radiant' | 'dire', teamName: string, isWinner: boolean) => {
    const isRadiant = teamFaction === 'radiant';
    const borderTheme = isRadiant ? 'border-emerald-900/40' : 'border-rose-900/40';
    const headerBg = isRadiant ? 'bg-emerald-950/30' : 'bg-rose-950/30';
    const textTheme = isRadiant ? 'text-emerald-400' : 'text-rose-400';

    return (
      <div className={`rounded-2xl border ${borderTheme} bg-slate-900/60 overflow-hidden shadow-lg`}>
        <div className={`px-5 py-3 ${headerBg} border-b ${borderTheme} flex items-center justify-between`}>
          <span className={`text-xs font-bold ${textTheme} tracking-wider uppercase flex items-center gap-2`}>
            <span>{isRadiant ? '🟢' : '🔴'}</span>
            <span>{teamName} Performances</span>
          </span>
          {isWinner && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isRadiant ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
              Winner
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-3">Role</th>
                {viewMode === 'fantasy' ? (
                  <>
                    <th className="py-3 px-3" title="Combat: Kills, Deaths, Assists">Combat</th>
                    <th className="py-3 px-3" title="Economy: GPM, Last Hits, Denies">Economy</th>
                    <th className="py-3 px-3" title="Objectives: Tower kills, Roshan kills, Wards">Objectives</th>
                    <th className="py-3 px-3" title="Teamfight: Participation & Fight impact">Teamfight</th>
                    <th className="py-3 px-3" title="Match victory bonus">Win</th>
                    <th className="py-3 px-4 text-right">Total Fantasy</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-3">K / D / A</th>
                    <th className="py-3 px-3">GPM / XPM</th>
                    <th className="py-3 px-3">Damage</th>
                    <th className="py-3 px-3">Wards</th>
                    <th className="py-3 px-3">Healing</th>
                    <th className="py-3 px-4 text-right">Fantasy Points</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stats.map((stat) => {
                const playerName = cleanPlayerName(stat);
                const role = stat.professional_players?.primary_role || 'Core';
                const fBreakdown = fantasyMap.get(stat.player_id);
                const fp = fBreakdown?.total_points ?? fantasyPointsByPlayer.get(stat.player_id);
                const lineupDetail = lineupDetailMap.get(stat.player_id);
                const isOwned = userOwnedSet.has(stat.player_id);

                return (
                  <tr key={stat.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-white">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/players/${stat.player_id}`} className="hover:text-amber-400 transition-colors">
                          {playerName}
                        </Link>
                        {stat.hero_name && (
                          <span className="text-[10px] font-normal text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                            {stat.hero_name}
                          </span>
                        )}
                        {lineupDetail?.isCaptain && (
                          <span className="text-[9px] font-extrabold bg-amber-500 text-slate-950 px-1 py-0.5 rounded">
                            CAPTAIN
                          </span>
                        )}
                        {lineupDetail?.isViceCaptain && (
                          <span className="text-[9px] font-extrabold bg-slate-700 text-slate-200 px-1 py-0.5 rounded">
                            VC
                          </span>
                        )}
                        {isOwned && !lineupDetail && (
                          <span className="text-[9px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1 py-0.5 rounded">
                            OWNED
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{role}</td>

                    {viewMode === 'fantasy' ? (
                      <>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {fBreakdown?.combat_points !== undefined ? fBreakdown.combat_points.toFixed(1) : '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {fBreakdown?.economy_points !== undefined ? fBreakdown.economy_points.toFixed(1) : '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {fBreakdown?.objective_points !== undefined ? fBreakdown.objective_points.toFixed(1) : '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {fBreakdown?.teamfight_points !== undefined ? fBreakdown.teamfight_points.toFixed(1) : '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {fBreakdown?.win_points !== undefined ? `+${fBreakdown.win_points.toFixed(1)}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                            {fp !== undefined ? `${fp.toFixed(1)} pts` : '-'}
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {stat.kills} / <span className="text-rose-400">{stat.deaths}</span> / {stat.assists}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {stat.gold_per_minute || '-'} / {stat.experience_per_minute || '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {stat.hero_damage ? Number(stat.hero_damage).toLocaleString() : '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {stat.wards_placed ?? '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {stat.healing ? Number(stat.healing).toLocaleString() : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                            {fp !== undefined ? `${fp.toFixed(1)} pts` : '-'}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href={fromGameweek && gwId ? `/gameweeks/${gwId}` : '/matches'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>{fromGameweek && gwId ? `Back to Gameweek ${match?.gameweeks?.gameweek_number ?? gwId}` : 'Back to Matches'}</span>
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  void navigator.clipboard.writeText(window.location.href);
                  setCopied(true);
                  toast.success('Link Copied', 'Match center link copied to clipboard.');
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border border-slate-700 bg-slate-800/80 text-slate-300 hover:border-amber-500/50 hover:text-amber-400 transition"
              title="Share Match"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied!' : 'Share'}</span>
            </button>

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
                  {formatTeamName(match.radiant_team?.name, match.radiant_team_id, 'Radiant')}
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
              isRadiantWinner || isDireWinner ? (
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
              ) : (
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-700/80 rounded-2xl px-5 py-2 shadow-2xl">
                  <span className="font-mono text-xl font-black text-slate-300 tracking-wider">FT</span>
                </div>
              )
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
                  {formatTeamName(match.dire_team?.name, match.dire_team_id, 'Dire')}
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

      {/* Match Leaders Strip */}
      <MatchLeadersStrip
        fantasyMVP={fantasyMVP}
        highestDamage={highestDamage}
        highestGPM={highestGPM}
        highestKills={highestKills}
      />

      {/* User Fantasy Impact Banner */}
      <MatchFantasyImpactBanner
        impact={userFantasyImpact}
        playerStats={playerStats}
        fantasyPointsByPlayer={fantasyPointsByPlayer}
        gameweekNumber={match.gameweeks?.gameweek_number}
      />

      {/* Player Stats & Fantasy Breakdown Section */}
      {playerStats.length > 0 ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📊</span>
                <span>Player Performance & Box Score</span>
              </h3>
              <p className="text-xs text-slate-400">
                Official in-game statistics and calculated fantasy point impacts
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1">
              <button
                type="button"
                onClick={() => setViewMode('fantasy')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'fantasy'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Fantasy Breakdown
              </button>
              <button
                type="button"
                onClick={() => setViewMode('traditional')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'traditional'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Traditional Box Score
              </button>
            </div>
          </div>

          {/* Radiant Roster Stats */}
          {renderRosterTable(radiantStats, 'radiant', formatTeamName(match.radiant_team?.name, match.radiant_team_id, 'Radiant'), isRadiantWinner)}

          {/* Dire Roster Stats */}
          {renderRosterTable(direStats, 'dire', formatTeamName(match.dire_team?.name, match.dire_team_id, 'Dire'), isDireWinner)}
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

export default function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<MatchDetailSkeleton />}>
      <MatchDetailInner params={params} />
    </Suspense>
  );
}
