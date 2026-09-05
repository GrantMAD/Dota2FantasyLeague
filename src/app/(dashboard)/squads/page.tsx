'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Users } from 'lucide-react';
import Link from 'next/link';

type SquadPlayer = {
  id: number;
  name: string;
  in_game_name: string | null;
  primary_role: string | null;
  profile_image_url: string | null;
  availability_status: string | null;
  current_price: number;
  professional_teams?: { name?: string; slug?: string } | null;
};

type LineupEntry = {
  slot: string;
  player_id: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  professional_players?: SquadPlayer | null;
};

type Gameweek = { id: number; gameweek_number: number };

type PlayerPerformance = {
  id: number;
  gameweek_id: number;
  kills: number;
  deaths: number;
  assists: number;
  fantasy_points_breakdown?: { total_points?: number } | null;
};

type PlayerDetails = SquadPlayer & {
  total_season_points?: number;
  last_gw_points?: number;
  performances?: PlayerPerformance[];
};

export default function SquadsPage() {
  const [lineup, setLineup] = useState<LineupEntry[]>([]);
  const [gameweek, setGameweek] = useState<Gameweek | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetails | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLineup() {
      try {
        // Fetch active gameweek
        const gwRes = await fetch('/api/gameweeks?status=active');
        const gwData = await gwRes.json();
        const activeGw = gwData.gameweeks?.[0];

        if (activeGw) {
          setGameweek(activeGw);
          // Fetch lineup
          const lineupRes = await fetch(`/api/fantasy/lineup?gameweekId=${activeGw.id}`);
          if (lineupRes.ok) {
            const lineupData = await lineupRes.json();
            setLineup(lineupData.lineup || []);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load lineup');
      } finally {
        setLoading(false);
      }
    }
    fetchLineup();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPlayer(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  const openPlayerDetails = async (playerId: number) => {
    setPlayerLoading(true);
    try {
      const response = await fetch(`/api/players/${playerId}`);
      if (!response.ok) throw new Error('Unable to load player details');
      const data = (await response.json()) as { player: PlayerDetails };
      setSelectedPlayer(data.player);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'Unable to load player details');
    } finally {
      setPlayerLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex animate-pulse items-end justify-between gap-4">
          <div>
            <div className="mb-3 h-9 w-40 rounded-lg bg-slate-800" />
            <div className="h-4 w-28 rounded bg-slate-800" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-32 rounded-lg bg-slate-800" />
            <div className="h-10 w-28 rounded-lg bg-slate-800" />
          </div>
        </div>

        <div className="mb-8 animate-pulse rounded-2xl border border-slate-700 bg-slate-900/50 p-4 sm:p-6">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <div className="mb-2 h-3 w-28 rounded bg-slate-800" />
              <div className="h-6 w-44 rounded bg-slate-800" />
            </div>
            <div className="h-3 w-24 rounded bg-slate-800" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="flex min-h-24 items-center gap-4 rounded-xl border border-slate-800 bg-slate-800/50 px-4 py-3">
                <div className="h-14 w-14 shrink-0 rounded-full bg-slate-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 rounded bg-slate-700" />
                  <div className="h-4 w-40 rounded bg-slate-700" />
                  <div className="h-3 w-24 rounded bg-slate-700" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="ml-auto h-4 w-14 rounded bg-slate-700" />
                  <div className="ml-auto h-3 w-12 rounded bg-slate-700" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="animate-pulse rounded-2xl border border-slate-700/70 bg-slate-800/40 p-4 sm:p-6">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <div className="mb-2 h-3 w-24 rounded bg-slate-700" />
              <div className="h-6 w-36 rounded bg-slate-700" />
            </div>
            <div className="h-3 w-20 rounded bg-slate-700" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[1, 2, 3].map((slot) => (
              <div key={slot} className="flex min-h-24 items-center gap-4 rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3">
                <div className="h-12 w-12 rounded-full bg-slate-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 rounded bg-slate-700" />
                  <div className="h-4 w-24 rounded bg-slate-700" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const renderSlot = (slotName: string, roleLabel: string, isStarter: boolean = true) => {
    const playerEntry = lineup.find((p) => p.slot === slotName);

    if (!playerEntry) {
      return (
        <Link href="/transfers" className="flex min-h-24 flex-1 items-center justify-between rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-5 py-4 transition-colors hover:border-cyan-500/50 hover:bg-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">{roleLabel}</p>
            <p className="mt-1 text-sm text-slate-500">No player selected</p>
          </div>
          <span className="squad-empty-slot-icon flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 text-xl text-slate-400">+</span>
        </Link>
      );
    }

    const player = playerEntry.professional_players;
    if (!player) {
      return (
        <Link href="/transfers" className="flex min-h-24 flex-1 items-center justify-between rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-5 py-4 transition-colors hover:border-cyan-500/50 hover:bg-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">{roleLabel}</p>
            <p className="mt-1 text-sm text-slate-500">Player data unavailable</p>
          </div>
          <span className="squad-empty-slot-icon flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 text-xl text-slate-400">+</span>
        </Link>
      );
    }

    return (
      <div data-guide={slotName === 'carry' ? 'squad-first-player' : undefined} role="button" tabIndex={0} onClick={() => openPlayerDetails(player.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openPlayerDetails(player.id); }} className="relative flex min-h-24 flex-1 cursor-pointer items-center gap-4 rounded-xl border border-cyan-500/30 bg-slate-800/80 px-4 py-3 shadow-lg transition-colors hover:border-cyan-400/70 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-400">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-700">
          {player.profile_image_url ? (
            <Image src={player.profile_image_url} alt={player.in_game_name || player.name} width={56} height={56} unoptimized className="h-full w-full object-cover" />
          ) : (
            <span className="squad-card-muted text-xs text-slate-300">{(player.in_game_name || player.name || 'P').substring(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">{roleLabel}</p>
          <p className="truncate text-base font-bold text-white" title={player.in_game_name || player.name}>{player.in_game_name || player.name}</p>
          <p className="squad-card-muted truncate text-sm text-slate-400">{player.professional_teams?.slug?.toUpperCase() || player.professional_teams?.name || 'FA'}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span className="font-mono text-sm text-amber-400">${player.current_price || '0.0'}M</span>
          <span className="text-xs text-slate-500">{isStarter ? 'Starter' : 'Bench'}</span>
        </div>
        {(playerEntry.is_captain || playerEntry.is_vice_captain) && (
          <span className={`absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-xs font-bold ${playerEntry.is_captain ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-900'}`}>
            {playerEntry.is_captain ? 'C' : 'VC'}
          </span>
        )}
      </div>
    );
  };


  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-white">
            <Users className="h-7 w-7 text-cyan-400" aria-hidden="true" />
            My Squad
          </h1>
          {gameweek && (
            <div>
              <p className="text-amber-500 font-semibold">Gameweek {gameweek.gameweek_number}</p>
              <p className="mt-1 text-sm text-slate-400">Review your active starters, bench players, captain, and current player values.</p>
            </div>
          )}
        </div>
        <div data-guide="squad-actions" className="flex gap-4">
           <Link href="/transfers" className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
             Make Transfers
           </Link>
           <Link href="/lineups" className="bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-lg shadow-orange-500/20 text-sm">
             Edit Lineup
           </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-8 text-sm">
          {error}
        </div>
      )}

      {/* Role-based squad board */}
      <div data-guide="squad-pitch" className="mb-8 rounded-2xl border border-slate-700 bg-slate-900/50 p-4 shadow-xl sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <span data-guide="squad-starters-badge" className="squad-section-label text-xs font-bold uppercase tracking-widest text-cyan-400">Starting Squad</span>
            <h2 className="mt-1 text-xl font-bold text-white">Five active roles</h2>
          </div>
          <span className="text-xs text-slate-500">1 player per role</span>
        </div>
        <div className="space-y-3">
          {renderSlot('carry', 'Carry')}
          {renderSlot('mid', 'Mid')}
          {renderSlot('offlane', 'Offlane')}
          {renderSlot('support', 'Support')}
          {renderSlot('hard_support', 'Hard Support')}
        </div>
      </div>

      {/* Bench */}
      <div data-guide="squad-bench" className="rounded-2xl border border-slate-700/70 bg-slate-800/40 p-4 sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <span className="squad-section-label text-xs font-bold uppercase tracking-widest text-slate-400">Substitutes</span>
            <h2 className="mt-1 text-xl font-bold text-white">Bench players</h2>
          </div>
          <span className="text-xs text-slate-500">Priority order</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {renderSlot('bench_1', 'Bench 1', false)}
          {renderSlot('bench_2', 'Bench 2', false)}
          {renderSlot('bench_3', 'Bench 3', false)}
        </div>
      </div>

      {playerLoading && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/70 p-4" role="status">
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-4 text-sm text-slate-300">Loading player details...</div>
        </div>
      )}

      {selectedPlayer && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-labelledby="squad-player-title" onClick={() => setSelectedPlayer(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-cyan-400">Player Details</p>
                <h2 id="squad-player-title" className="text-2xl font-bold text-white">{selectedPlayer.in_game_name || selectedPlayer.name}</h2>
                <p className="text-sm text-slate-400">{selectedPlayer.professional_teams?.name || 'Free Agent'} · {selectedPlayer.primary_role || 'Role unavailable'}</p>
              </div>
              <button type="button" onClick={() => setSelectedPlayer(null)} aria-label="Close player details" className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white">X</button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3"><p className="text-xs text-slate-500">Price</p><p className="mt-1 font-mono font-bold text-amber-400">${Number(selectedPlayer.current_price || 0).toFixed(1)}M</p></div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3"><p className="text-xs text-slate-500">Season Points</p><p className="mt-1 font-bold text-white">{selectedPlayer.total_season_points ?? 0}</p></div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3"><p className="text-xs text-slate-500">Last GW</p><p className="mt-1 font-bold text-white">{selectedPlayer.last_gw_points ?? 0}</p></div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3"><p className="text-xs text-slate-500">Availability</p><p className="mt-1 text-sm font-semibold capitalize text-emerald-400">{selectedPlayer.availability_status || 'Unknown'}</p></div>
            </div>

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Recent Performances</h3>
              {selectedPlayer.performances?.length ? (
                <div className="space-y-2">
                  {selectedPlayer.performances.slice(0, 5).map((performance) => (
                    <div key={performance.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm">
                      <span className="text-slate-300">GW {performance.gameweek_id}</span>
                      <span className="text-slate-400">{performance.kills}/{performance.deaths}/{performance.assists}</span>
                      <span className="font-semibold text-cyan-400">{performance.fantasy_points_breakdown?.total_points ?? 0} pts</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">No performance data available yet.</p>}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
