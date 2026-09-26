'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, ShieldAlert, ArrowLeftRight, UserCheck } from 'lucide-react';
import { SquadHero } from './components/SquadHero';
import { SquadFilters, type SquadTab, type SquadViewMode } from './components/SquadFilters';
import { SquadPlayerCard, type SquadPlayer } from './components/SquadPlayerCard';
import { PlayerDetailModal, type PlayerDetails } from './components/PlayerDetailModal';

type LineupEntry = {
  slot: string;
  player_id: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  professional_players?: SquadPlayer | null;
};

type Gameweek = {
  id: number;
  gameweekNumber: number;
  deadline?: string | null;
  isLocked?: boolean;
};

const STARTER_SLOTS = [
  { slot: 'carry', label: 'Carry', role: 'Carry' },
  { slot: 'mid', label: 'Mid', role: 'Mid' },
  { slot: 'offlane', label: 'Offlane', role: 'Offlane' },
  { slot: 'support', label: 'Support', role: 'Support' },
  { slot: 'hard_support', label: 'Hard Support', role: 'Hard Support' },
];

const BENCH_SLOTS = [
  { slot: 'bench_1', label: 'Bench 1', role: 'Bench 1' },
  { slot: 'bench_2', label: 'Bench 2', role: 'Bench 2' },
  { slot: 'bench_3', label: 'Bench 3', role: 'Bench 3' },
];

export default function SquadsPage() {
  const [lineup, setLineup] = useState<LineupEntry[]>([]);
  const [ownedPlayers, setOwnedPlayers] = useState<SquadPlayer[]>([]);
  const [gameweek, setGameweek] = useState<Gameweek | null>(null);
  const [budget, setBudget] = useState<number>(100);
  const [totalPoints, setTotalPoints] = useState<number>(0);
  const [globalRank, setGlobalRank] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<SquadTab>('all');
  const [viewMode, setViewMode] = useState<SquadViewMode>('pitch');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetails | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSquadContext() {
      try {
        setLoading(true);
        const res = await fetch('/api/fantasy/context');
        if (!res.ok) throw new Error('Failed to load fantasy context');

        const data = await res.json();
        if (data.gameweek) {
          setGameweek({
            id: data.gameweek.id,
            gameweekNumber: data.gameweek.gameweekNumber,
            deadline: data.gameweek.deadline,
            isLocked: data.gameweek.isLocked,
          });
        }
        setBudget(Number(data.budget ?? 0));
        setTotalPoints(Number(data.totalPoints ?? 0));
        setGlobalRank(data.globalRank ?? null);
        setLineup(data.lineup || []);
        setOwnedPlayers(data.ownedPlayers || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load squad lineup');
      } finally {
        setLoading(false);
      }
    }
    fetchSquadContext();
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

  // Derived squad statistics
  const totalSquadValue = useMemo(() => {
    return ownedPlayers.reduce((sum, p) => sum + (Number(p.current_price) || 0), 0);
  }, [ownedPlayers]);

  const captainEntry = useMemo(() => lineup.find((e) => e.is_captain), [lineup]);
  const viceCaptainEntry = useMemo(() => lineup.find((e) => e.is_vice_captain), [lineup]);

  const captainName =
    captainEntry?.professional_players?.in_game_name ||
    captainEntry?.professional_players?.name ||
    null;

  const viceCaptainName =
    viceCaptainEntry?.professional_players?.in_game_name ||
    viceCaptainEntry?.professional_players?.name ||
    null;

  const startersLineup = useMemo(
    () => lineup.filter((e) => !e.slot.startsWith('bench')),
    [lineup]
  );
  const benchLineup = useMemo(
    () => lineup.filter((e) => e.slot.startsWith('bench')),
    [lineup]
  );

  // Role filtering predicate
  const roleFilterMatch = (slotRole: string, player?: SquadPlayer | null) => {
    if (selectedRole === 'ALL') return true;
    if (player?.primary_role) {
      return player.primary_role.toLowerCase() === selectedRole.toLowerCase();
    }
    return slotRole.toLowerCase() === selectedRole.toLowerCase();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-4 h-6 w-48 rounded bg-slate-800" />
          <div className="mb-3 h-10 w-72 rounded bg-slate-800" />
          <div className="grid gap-3 sm:grid-cols-4 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-slate-800" />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 h-4 w-40 rounded bg-slate-800" />
              <div className="h-24 rounded bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Top Header & Actions Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-teal-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Fantasy Roster Management
          </span>
        </div>

        <div data-guide="squad-actions" className="flex items-center gap-3">
          <Link
            href="/transfers"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white dark:border-slate-700 dark:bg-slate-900/80"
          >
            <ArrowLeftRight className="h-4 w-4 text-teal-400" />
            Transfer Market
          </Link>
          <Link
            href="/lineups"
            className="inline-flex items-center gap-2 rounded-xl border border-teal-500/40 bg-teal-500/15 px-4 py-2 text-sm font-semibold text-teal-300 transition hover:border-teal-400 hover:bg-teal-500/25 shadow-sm"
          >
            <UserCheck className="h-4 w-4" />
            Edit Lineup
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-8 rounded-2xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Gameweek-inspired Hero Banner */}
      <SquadHero
        gameweek={gameweek}
        budget={budget}
        totalSquadValue={totalSquadValue}
        totalPoints={totalPoints}
        globalRank={globalRank}
        captainName={captainName}
        viceCaptainName={viceCaptainName}
        startersCount={startersLineup.length}
        totalPlayersCount={ownedPlayers.length}
      />

      {/* Empty Squad Onboarding Banner */}
      {ownedPlayers.length === 0 && (
        <div className="mb-8 relative overflow-hidden rounded-3xl border border-teal-500/40 bg-[linear-gradient(135deg,rgba(20,184,166,0.12),rgba(15,23,42,0.95))] p-6 sm:p-8 shadow-xl shadow-teal-500/5">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-400 rounded-l-3xl" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-bold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                GET STARTED
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Build Your Fantasy Squad</h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                Your squad is currently empty. Head over to the Transfer Market to acquire your 5 core starters and 3 substitutes within your $100.0M budget.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-teal-400 font-bold flex items-center justify-center text-[10px] border border-slate-700">1</span>
                  Pick 5 starting roles
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-teal-400 font-bold flex items-center justify-center text-[10px] border border-slate-700">2</span>
                  Add 3 bench players
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-teal-400 font-bold flex items-center justify-center text-[10px] border border-slate-700">3</span>
                  Earn points every GW
                </div>
              </div>
            </div>
            <Link
              href="/transfers"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-teal-500 text-slate-950 hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/25 transition-all shrink-0 cursor-pointer"
            >
              Build Your Squad
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Unassigned squad members warning */}
      {lineup.length === 0 && ownedPlayers.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <span className="font-semibold">You have {ownedPlayers.length} player{ownedPlayers.length !== 1 ? 's' : ''} in your squad</span> but haven&apos;t set a lineup for this gameweek yet.
            &nbsp;<Link href="/lineups" className="underline hover:text-amber-100 font-medium">Set your lineup now →</Link>
          </div>
        </div>
      )}

      {/* Unavailable active starters notice */}
      {startersLineup.some(
        (e) =>
          e.professional_players?.availability_status &&
          e.professional_players.availability_status !== 'available'
      ) && (
        <div className="mb-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3.5 text-sm text-rose-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold text-rose-300">Unavailable players in starting lineup:</span>{' '}
              One or more of your active starters are currently free agents or not on an active team roster, meaning they won&apos;t earn points this gameweek.
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-xs font-semibold">
            <Link
              href="/lineups"
              className="rounded-xl border border-rose-400/40 bg-rose-500/20 px-3 py-1.5 text-rose-200 hover:bg-rose-500/30 transition"
            >
              Rotate to Bench
            </Link>
            <Link
              href="/transfers"
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-slate-200 hover:text-white transition"
            >
              Transfer Replacement
            </Link>
          </div>
        </div>
      )}

      {/* Filter and View Mode Toolbar */}
      <SquadFilters
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        counts={{
          all: ownedPlayers.length,
          starters: startersLineup.length,
          bench: benchLineup.length,
        }}
      />

      {/* Squad Pitch / Slots Sections */}
      <div className="space-y-8">
        {/* Starters Section */}
        {(activeTab === 'all' || activeTab === 'starters') && (
          <div data-guide="squad-pitch" className="rounded-3xl border border-slate-700/80 bg-slate-900/50 p-5 shadow-xl sm:p-6 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <span data-guide="squad-starters-badge" className="squad-section-label text-xs font-bold uppercase tracking-widest text-teal-400">
                  Starting Squad
                </span>
                <h2 className="mt-1 text-xl font-black text-white">Five Core Roles</h2>
              </div>
              <span className="text-xs text-slate-400">
                {startersLineup.length}/5 assigned • 1 per role
              </span>
            </div>

            <div className={viewMode === 'compact' ? 'space-y-2' : 'space-y-3'}>
              {STARTER_SLOTS.filter((s) => {
                const entry = lineup.find((p) => p.slot === s.slot);
                return roleFilterMatch(s.role, entry?.professional_players);
              }).map((s, index) => {
                const entry = lineup.find((p) => p.slot === s.slot);
                const player = entry?.professional_players;

                return (
                  <SquadPlayerCard
                    key={s.slot}
                    slotName={s.slot}
                    roleLabel={s.label}
                    player={player}
                    isStarter={true}
                    isCaptain={entry?.is_captain}
                    isViceCaptain={entry?.is_vice_captain}
                    compact={viewMode === 'compact'}
                    onOpenDetails={openPlayerDetails}
                    dataGuide={index === 0 ? 'squad-first-player' : undefined}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Bench Substitutes Section */}
        {(activeTab === 'all' || activeTab === 'bench') && (
          <div data-guide="squad-bench" className="rounded-3xl border border-slate-700/70 bg-slate-900/40 p-5 shadow-xl sm:p-6 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <span className="squad-section-label text-xs font-bold uppercase tracking-widest text-slate-400">
                  Substitutes
                </span>
                <h2 className="mt-1 text-xl font-black text-white">Bench Players</h2>
              </div>
              <span className="text-xs text-slate-400">
                {benchLineup.length}/3 assigned • Priority order
              </span>
            </div>

            <div className={viewMode === 'compact' ? 'space-y-2' : 'grid gap-3 md:grid-cols-3'}>
              {BENCH_SLOTS.filter((s) => {
                const entry = lineup.find((p) => p.slot === s.slot);
                return roleFilterMatch(s.role, entry?.professional_players);
              }).map((s) => {
                const entry = lineup.find((p) => p.slot === s.slot);
                const player = entry?.professional_players;

                return (
                  <SquadPlayerCard
                    key={s.slot}
                    slotName={s.slot}
                    roleLabel={s.label}
                    player={player}
                    isStarter={false}
                    compact={viewMode === 'compact'}
                    onOpenDetails={openPlayerDetails}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* All Squad Members Directory */}
        {ownedPlayers.length > 0 && activeTab === 'all' && (
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/30 p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900/30">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Full Roster
                </span>
                <h2 className="mt-1 text-xl font-black text-white">
                  All Squad Members{' '}
                  <span className="text-base font-normal text-slate-400">
                    ({ownedPlayers.length})
                  </span>
                </h2>
              </div>
              <Link href="/transfers" className="text-xs font-medium text-teal-400 hover:text-teal-300 underline">
                Manage Transfers
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ownedPlayers
                .filter((p) => roleFilterMatch(p.primary_role || '', p))
                .map((player) => (
                  <div
                    key={player.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openPlayerDetails(player.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') openPlayerDetails(player.id);
                    }}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-700/80 bg-slate-800/60 px-4 py-3 transition hover:border-teal-500/50 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-700">
                        {player.profile_image_url ? (
                          <img
                            src={player.profile_image_url}
                            alt={player.in_game_name || player.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-slate-400">
                            {(player.in_game_name || player.name || 'P').substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">
                          {player.in_game_name || player.name}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {player.primary_role || 'Pro'} • {player.professional_teams?.name || 'FA'}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-black text-amber-400">
                      ${Number(player.current_price || 0).toFixed(1)}M
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal for Player Details */}
      <PlayerDetailModal
        player={selectedPlayer}
        loading={playerLoading}
        onClose={() => setSelectedPlayer(null)}
      />
    </div>
  );
}
