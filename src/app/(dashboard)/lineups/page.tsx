'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { UserCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useToast } from '@/components/Toast';

type ChipType = 'triple-captain' | 'bench-boost' | null;

type ChipStatus = {
  tripleCaptainUsed?: boolean;
  tripleCaptainGameweekId?: number | null;
  benchBoostUsed?: boolean;
  benchBoostGameweekId?: number | null;
};

type LineupPlayer = {
  id: number;
  name: string;
  in_game_name?: string | null;
  primary_role?: string | null;
  profile_image_url?: string | null;
  current_price?: number;
  last_gw_points?: number;
  recent_points?: number;
  form_trend?: 'up' | 'down' | 'flat';
  professional_teams?: { name?: string | null } | null;
};

type LineupEntry = {
  slot: string;
  player_id: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  professional_players?: LineupPlayer | null;
};

const SpinnerIcon = () => (
  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function LineupsPage() {
  const toast = useToast();
  const [tcStatus, setTcStatus] = useState<ChipStatus | null>(null);
  const [bbStatus, setBbStatus] = useState<ChipStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ChipType>(null);
  const [activating, setActivating] = useState(false);

  const [fantasySeasonId, setFantasySeasonId] = useState<number | null>(null);
  const [gameweekId, setGameweekId] = useState<number | null>(null);
  const [lineupLocked, setLineupLocked] = useState(false);
  const [hasUpcomingGw, setHasUpcomingGw] = useState(false);
  const [lineup, setLineup] = useState<LineupEntry[]>([]);
  const [ownedPlayers, setOwnedPlayers] = useState<LineupPlayer[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchFantasyContext() {
      try {
        setLoading(true);
        const res = await fetch('/api/fantasy/context');
        if (!res.ok) throw new Error('Failed to load fantasy context');

        const data = await res.json();
        setFantasySeasonId(data.fantasySeasonId);

        if (data.gameweek) {
          setGameweekId(data.gameweek.id);
          setLineupLocked(Boolean(data.gameweek.isLocked));
          setHasUpcomingGw(Boolean(data.gameweek.hasUpcoming));
        }

        setLineup(data.lineup || []);
        setOwnedPlayers(data.ownedPlayers || []);
        setTcStatus(data.chips ? {
          tripleCaptainUsed: data.chips.tripleCaptainUsed,
          tripleCaptainGameweekId: data.chips.tripleCaptainGameweekId,
        } : null);
        setBbStatus(data.chips ? {
          benchBoostUsed: data.chips.benchBoostUsed,
          benchBoostGameweekId: data.chips.benchBoostGameweekId,
        } : null);
      } catch (err) {
        console.error('Failed to fetch fantasy context', err);
        toast.error('Load Error', err instanceof Error ? err.message : 'Unable to load fantasy lineup');
      } finally {
        setLoading(false);
      }
    }
    fetchFantasyContext();
  }, []);

  const updateSlot = (slot: string, playerId: number) => {
    const existingSlot = lineup.find((entry) => entry.player_id === playerId && entry.slot !== slot)?.slot;
    if (existingSlot) {
      toast.error('Cannot Assign Player', `${ownedPlayers.find((player) => player.id === playerId)?.in_game_name || 'This player'} is already assigned to ${existingSlot.replace('_', ' ')}.`);
      return;
    }

    const player = ownedPlayers.find((entry) => entry.id === playerId);
    setLineup((current) => [
      ...current.filter((entry) => entry.slot !== slot),
      { slot, player_id: playerId, is_starter: !slot.startsWith('bench'), is_captain: false, is_vice_captain: false, professional_players: player },
    ]);
  };

  const setCaptain = (playerId: number, vice = false) => {
    setLineup((current) => {
      const selected = current.find((entry) => entry.player_id === playerId);
      if (!selected) return current;

      const currentCaptain = current.find((entry) => entry.is_captain);
      const currentViceCaptain = current.find((entry) => entry.is_vice_captain);

      return current.map((entry) => {
        if (entry.player_id === playerId) {
          return {
            ...entry,
            is_captain: !vice,
            is_vice_captain: vice,
          };
        }

        if (!vice && selected.is_vice_captain && entry.player_id === currentCaptain?.player_id) {
          return { ...entry, is_captain: false, is_vice_captain: true };
        }

        if (vice && selected.is_captain && entry.player_id === currentViceCaptain?.player_id) {
          return { ...entry, is_captain: true, is_vice_captain: false };
        }

        return {
          ...entry,
          is_captain: vice ? entry.is_captain : false,
          is_vice_captain: vice ? false : entry.is_vice_captain,
        };
      });
    });
  };

  const saveLineup = async () => {
    if (lineupLocked) {
      toast.error('Cannot Save Lineup', 'The gameweek deadline has passed. Lineup changes are locked.');
      return;
    }

    const starterSlots = ['carry', 'mid', 'offlane', 'support', 'hard_support'];
    const missingStarters = starterSlots.filter((slot) => !lineup.some((entry) => entry.slot === slot));
    const duplicatePlayers = new Set(lineup.map((entry) => entry.player_id)).size !== lineup.length;
    const captainCount = lineup.filter((entry) => entry.is_captain).length;
    const viceCaptainCount = lineup.filter((entry) => entry.is_vice_captain).length;

    if (!gameweekId || missingStarters.length > 0) {
      toast.error('Cannot Save Lineup', 'Fill all 5 starting slots (Carry, Mid, Offlane, Support, Hard Support) before saving.');
      return;
    }
    if (duplicatePlayers) {
      toast.error('Cannot Save Lineup', 'Each player can only be assigned to one lineup slot.');
      return;
    }
    if (captainCount !== 1 || viceCaptainCount !== 1) {
      toast.error('Cannot Save Lineup', 'Select exactly one captain and one vice-captain before saving.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/fantasy/lineup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameweekId, lineup: lineup.map((entry) => ({ playerId: entry.player_id, slot: entry.slot, isCaptain: entry.is_captain, isViceCaptain: entry.is_vice_captain })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save lineup');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fantasy:stats-updated'));
      }
      toast.success('Lineup Saved', 'Your starting 5 has been updated.');
    } catch (err) {
      toast.error('Lineup Not Saved', err instanceof Error ? err.message : 'Failed to save lineup');
    } finally {
      setSaving(false);
    }
  };

  const openModal = (chip: ChipType) => {
    setActiveModal(chip);
  };

  const handleActivate = async () => {
    if (!activeModal) return;
    if (!fantasySeasonId) {
      toast.error('Chip Activation Failed', 'Create a fantasy squad before activating a chip.');
      return;
    }
    setActivating(true);

    const isTripleCaptain = activeModal === 'triple-captain';
    const endpoint = isTripleCaptain ? '/api/fantasy/triple-captain' : '/api/fantasy/bench-boost';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fantasySeasonId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to activate ${isTripleCaptain ? 'Triple Captain' : 'Bench Boost'}`);
      }

      if (isTripleCaptain) {
        toast.success('Triple Captain Active', 'Your captain earns 3× points this gameweek.');
        setTcStatus({ ...tcStatus, tripleCaptainUsed: true, tripleCaptainGameweekId: data.gameweekId });
      } else {
        toast.success('Bench Boost Active', 'All bench players score full points this gameweek.');
        setBbStatus({ ...bbStatus, benchBoostUsed: true, benchBoostGameweekId: data.gameweekId });
      }
    } catch (err: unknown) {
      toast.error('Chip Activation Failed', err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setActivating(false);
      setActiveModal(null);
    }
  };

  const starterSlots = ['carry', 'mid', 'offlane', 'support', 'hard_support'];
  const hasAllStarters = starterSlots.every((slot) => lineup.some((entry) => entry.slot === slot));
  const startingPlayers = lineup.filter((entry) => starterSlots.includes(entry.slot) && entry.player_id);
  const startingPlayerDetails = startingPlayers.map((entry) => {
    return ownedPlayers.find((p) => p.id === entry.player_id) || entry.professional_players;
  }).filter(Boolean) as LineupPlayer[];
  const hasCaptainAndVice = lineup.filter((e) => e.is_captain).length === 1 && lineup.filter((e) => e.is_vice_captain).length === 1;
  const isLineupReady = hasAllStarters && hasCaptainAndVice;

  // Filter owned players matching a specific slot role
  // Support and Hard Support both accept Support & Hard Support players interchangeably
  const getEligiblePlayersForSlot = (slot: string) => {
    return ownedPlayers.filter((player) => {
      const role = player.primary_role;
      if (slot === 'carry') return role === 'Carry';
      if (slot === 'mid') return role === 'Mid';
      if (slot === 'offlane') return role === 'Offlane';
      if (slot === 'support' || slot === 'hard_support') return role === 'Support' || role === 'Hard Support';
      return true; // Bench accepts any role
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="mb-2 flex items-center gap-3 text-3xl font-bold text-white">
        <UserCheck className="h-7 w-7 text-cyan-400" aria-hidden="true" />
        Lineups
      </h1>
      <p className="max-w-3xl text-slate-400 mb-8">Choose one player for each starting role, assign your captain and vice-captain, arrange your bench priority, then save your lineup before the gameweek deadline.</p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main content */}
        <div className="lg:col-span-3">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Gameweek Lineup</h2>
                <p className="text-sm text-slate-400">
                  Gameweek {gameweekId ?? 'not available'} {lineupLocked ? '(Closed)' : ''}
                </p>
                {lineupLocked && <p className="mt-1 text-xs font-semibold text-red-400">Deadline passed · lineup locked</p>}
              </div>
              <button
                type="button"
                data-guide="lineup-save-btn"
                onClick={saveLineup}
                disabled={saving || !isLineupReady || lineupLocked}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving...' : lineupLocked ? 'Lineup Locked' : 'Save Lineup'}
              </button>
            </div>

            {loading ? (
              <div className="animate-pulse space-y-6">
                <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4 md:grid-cols-2">
                  <div className="h-10 rounded bg-slate-800" />
                  <div className="h-10 rounded bg-slate-800" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((slot) => (
                    <div key={slot} className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
                      <div className="mb-3 h-3 w-24 rounded bg-slate-700" />
                      <div className="h-10 rounded bg-slate-800" />
                      <div className="mt-3 h-10 w-40 rounded bg-slate-800" />
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-700/70 pt-6">
                  <div className="mb-3 h-3 w-36 rounded bg-slate-700" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[1, 2, 3].map((slot) => <div key={slot} className="h-24 rounded-lg border border-slate-700 bg-slate-900/40" />)}
                  </div>
                </div>
              </div>
            ) : ownedPlayers.length === 0 ? (
              <div data-guide="lineup-empty" className="py-16 text-center text-slate-400">
                Create a squad and add players before setting a lineup.
              </div>
            ) : (
              <div className="space-y-8">
                {/* Starting 5 */}
                <div data-guide="lineup-starters">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                      Starting Five (Active)
                    </h3>
                    <span className="text-xs text-slate-400">Active point scorers</span>
                  </div>

                  {/* Informational Guidance Notice */}
                  <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3.5 mb-4 text-xs text-amber-200/90 leading-relaxed">
                    <span className="text-amber-400 text-sm shrink-0">ℹ️</span>
                    <div>
                      <p className="font-semibold text-amber-300 mb-0.5">Lineup Selection Order</p>
                      <p className="text-slate-300">
                        Please assign your <span className="text-white font-medium">5 core starting players</span> in the slots below first. Once selected, you can appoint your <span className="text-amber-400 font-semibold">Captain</span> and <span className="text-cyan-400 font-semibold">Vice-Captain</span> from your starting lineup.
                      </p>
                    </div>
                  </div>

                  {/* Captain & Vice-Captain Controls */}
                  <div data-guide="lineup-captain-controls" className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4 md:grid-cols-2">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-amber-400">Captain · 2x points</label>
                        {startingPlayerDetails.length === 0 && (
                          <span className="text-[11px] text-amber-400/70 italic">Pick starting 5 first</span>
                        )}
                      </div>
                      <select
                        value={lineup.find((entry) => entry.is_captain)?.player_id ?? ''}
                        onChange={(event) => event.target.value && setCaptain(Number(event.target.value), false)}
                        disabled={lineupLocked || startingPlayerDetails.length === 0}
                        className="w-full rounded border border-amber-500/40 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none disabled:opacity-50"
                      >
                        <option value="">{startingPlayerDetails.length === 0 ? 'Assign starting players below first' : 'Select captain'}</option>
                        {startingPlayerDetails.map((player) => {
                          const trendSymbol = player.form_trend === 'up' ? '▲' : player.form_trend === 'down' ? '▼' : '▬';
                          const gwPtsStr = player.last_gw_points != null ? `${player.last_gw_points} pts ${trendSymbol}` : '';
                          const details = [player.primary_role, gwPtsStr].filter(Boolean).join(' · ');
                          return (
                            <option key={player.id} value={player.id}>
                              {player.in_game_name || player.name} {details ? `(${details})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">Vice-Captain · backup</label>
                        {startingPlayerDetails.length === 0 && (
                          <span className="text-[11px] text-slate-400 italic">Pick starting 5 first</span>
                        )}
                      </div>
                      <select
                        value={lineup.find((entry) => entry.is_vice_captain)?.player_id ?? ''}
                        onChange={(event) => event.target.value && setCaptain(Number(event.target.value), true)}
                        disabled={lineupLocked || startingPlayerDetails.length === 0}
                        className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-slate-400 focus:outline-none disabled:opacity-50"
                      >
                        <option value="">{startingPlayerDetails.length === 0 ? 'Assign starting players below first' : 'Select vice-captain'}</option>
                        {startingPlayerDetails.map((player) => {
                          const trendSymbol = player.form_trend === 'up' ? '▲' : player.form_trend === 'down' ? '▼' : '▬';
                          const gwPtsStr = player.last_gw_points != null ? `${player.last_gw_points} pts ${trendSymbol}` : '';
                          const details = [player.primary_role, gwPtsStr].filter(Boolean).join(' · ');
                          return (
                            <option key={player.id} value={player.id}>
                              {player.in_game_name || player.name} {details ? `(${details})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {['carry', 'mid', 'offlane', 'support', 'hard_support'].map((slot, index) => {
                      const selected = lineup.find((entry) => entry.slot === slot);
                      const eligiblePlayers = getEligiblePlayersForSlot(slot);
                      const displayRole = slot === 'support' ? 'Support (Pos 4)' : slot === 'hard_support' ? 'Hard Support (Pos 5)' : slot.replace('_', ' ');
                      return (
                        <div
                          key={slot}
                          data-guide={index === 0 ? 'lineup-first-slot' : undefined}
                          className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                              {displayRole}
                            </label>
                            {eligiblePlayers.length === 0 && (
                              <span className="text-[11px] text-amber-400/80">No {displayRole} in your squad</span>
                            )}
                          </div>
                          <select
                            value={selected?.player_id ?? ''}
                            onChange={(event) => {
                              if (!event.target.value) {
                                setLineup((current) => current.filter((entry) => entry.slot !== slot));
                              } else {
                                updateSlot(slot, Number(event.target.value));
                              }
                            }}
                            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                          >
                            <option value="">Select player ({displayRole})</option>
                            {eligiblePlayers.map((player) => {
                              const trendSymbol = player.form_trend === 'up' ? '▲' : player.form_trend === 'down' ? '▼' : '▬';
                              const priceStr = player.current_price != null ? `$${Number(player.current_price).toFixed(1)}M` : '';
                              const gwPtsStr = player.last_gw_points != null ? `${player.last_gw_points} pts` : '';
                              const extras = [player.primary_role, priceStr, gwPtsStr ? `GW: ${gwPtsStr} ${trendSymbol}` : ''].filter(Boolean).join(' · ');
                              return (
                                <option key={player.id} value={player.id}>
                                  {player.in_game_name || player.name} {extras ? `(${extras})` : ''}
                                </option>
                              );
                            })}
                          </select>
                          {selected?.professional_players && (
                            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/60 p-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-700">
                                  {selected.professional_players.profile_image_url ? (
                                    <Image src={selected.professional_players.profile_image_url} alt={selected.professional_players.in_game_name || selected.professional_players.name} width={40} height={40} unoptimized className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="player-avatar-initials text-xs font-bold">{(selected.professional_players.in_game_name || selected.professional_players.name || 'P').slice(0, 2).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-white">{selected.professional_players.in_game_name || selected.professional_players.name}</p>
                                  <p className="truncate text-xs text-slate-400">{selected.professional_players.professional_teams?.name || 'Free Agent'} · <span className="text-amber-400/90 font-medium">${Number(selected.professional_players.current_price || 0).toFixed(1)}M</span></p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 text-right">
                                <div className="text-right">
                                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Last GW</div>
                                  <div className="text-xs font-mono font-bold text-white flex items-center justify-end gap-1">
                                    {selected.professional_players.last_gw_points ?? 0} pts
                                    {selected.professional_players.form_trend === 'up' && (
                                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400 inline" />
                                    )}
                                    {selected.professional_players.form_trend === 'down' && (
                                      <TrendingDown className="w-3.5 h-3.5 text-red-400 inline" />
                                    )}
                                    {(!selected.professional_players.form_trend || selected.professional_players.form_trend === 'flat') && (
                                      <Minus className="w-3.5 h-3.5 text-slate-400 inline" />
                                    )}
                                  </div>
                                </div>
                                <div className="text-right border-l border-slate-700/80 pl-3">
                                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Avg</div>
                                  <div className="text-xs font-mono font-semibold text-slate-300">
                                    {selected.professional_players.recent_points ?? 0}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </div>

                {/* Bench Substitutes */}
                <div data-guide="lineup-bench" className="border-t border-slate-700/70 pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                      Bench Substitutes (Reserves)
                    </h3>
                    <span className="text-xs text-slate-400">Auto-sub in order if starters miss</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {['bench_1', 'bench_2', 'bench_3'].map((slot, index) => {
                      const selected = lineup.find((entry) => entry.slot === slot);
                      return (
                        <div
                          key={slot}
                          data-guide={index === 0 ? 'lineup-first-bench' : undefined}
                          className="rounded-lg border border-slate-700 bg-slate-900/40 p-4"
                        >
                          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                            {slot.replace('_', ' ')}
                          </label>
                          <select
                            value={selected?.player_id ?? ''}
                            onChange={(event) => {
                              if (!event.target.value) {
                                setLineup((current) => current.filter((entry) => entry.slot !== slot));
                              } else {
                                updateSlot(slot, Number(event.target.value));
                              }
                            }}
                            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                          >
                            <option value="">Select player</option>
                            {ownedPlayers.map((player) => {
                              const trendSymbol = player.form_trend === 'up' ? '▲' : player.form_trend === 'down' ? '▼' : '▬';
                              const priceStr = player.current_price != null ? `$${Number(player.current_price).toFixed(1)}M` : '';
                              const gwPtsStr = player.last_gw_points != null ? `${player.last_gw_points} pts` : '';
                              const extras = [player.primary_role, priceStr, gwPtsStr ? `GW: ${gwPtsStr} ${trendSymbol}` : ''].filter(Boolean).join(' · ');
                              return (
                                <option key={player.id} value={player.id}>
                                  {player.in_game_name || player.name} {extras ? `(${extras})` : ''}
                                </option>
                              );
                            })}
                          </select>
                          {selected?.professional_players && (
                            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-800/60 p-2.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-700">
                                  {selected.professional_players.profile_image_url ? (
                                    <Image src={selected.professional_players.profile_image_url} alt={selected.professional_players.in_game_name || selected.professional_players.name} width={32} height={32} unoptimized className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="player-avatar-initials text-xs font-bold">{(selected.professional_players.in_game_name || selected.professional_players.name || 'P').slice(0, 2).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-white">{selected.professional_players.in_game_name || selected.professional_players.name}</p>
                                  <p className="truncate text-[11px] text-slate-400">${Number(selected.professional_players.current_price || 0).toFixed(1)}M</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[9px] uppercase tracking-wider text-slate-400">Last GW</div>
                                <div className="text-xs font-mono font-bold text-white flex items-center justify-end gap-1">
                                  {selected.professional_players.last_gw_points ?? 0}
                                  {selected.professional_players.form_trend === 'up' && (
                                    <TrendingUp className="w-3 h-3 text-emerald-400 inline" />
                                  )}
                                  {selected.professional_players.form_trend === 'down' && (
                                    <TrendingDown className="w-3 h-3 text-red-400 inline" />
                                  )}
                                  {(!selected.professional_players.form_trend || selected.professional_players.form_trend === 'flat') && (
                                    <Minus className="w-3 h-3 text-slate-400 inline" />
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chips sidebar */}
        <div data-guide="lineup-chips" className="lg:col-span-1 space-y-4">
          {/* Triple Captain */}
          <div className="lineup-chip-card lineup-chip-purple bg-purple-900/20 border border-purple-700/50 rounded-xl p-5">
            <h3 className="font-semibold text-purple-400 mb-2 text-sm flex items-center justify-between">
              Triple Captain
              <span className="text-xl">🌟</span>
            </h3>
            {loading ? (
              <p className="text-xs text-slate-400">Loading...</p>
            ) : tcStatus?.tripleCaptainUsed ? (
              <div>
                <p className="text-xs text-slate-400 mb-2">Already played this season.</p>
                <div className="bg-purple-900/40 text-purple-300 text-xs text-center py-2 rounded border border-purple-700/30">
                  Used in GW {tcStatus.tripleCaptainGameweekId}
                </div>
              </div>
            ) : (
              <div>
                <p className="lineup-chip-description text-xs text-purple-200/70 mb-3">Triple your captain&apos;s points for one gameweek.</p>
                <button
                  onClick={() => openModal('triple-captain')}
                  disabled={!hasUpcomingGw}
                  className="w-full bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 text-purple-400 text-xs font-bold py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {hasUpcomingGw ? 'Play Triple Captain' : 'Chips Locked'}
                </button>
                {!hasUpcomingGw && (
                  <p className="text-[11px] text-slate-500 text-center mt-1.5">No open upcoming gameweek</p>
                )}
              </div>
            )}
          </div>

          {/* Bench Boost */}
          <div className="lineup-chip-card lineup-chip-emerald bg-emerald-900/20 border border-emerald-700/50 rounded-xl p-5">
            <h3 className="font-semibold text-emerald-400 mb-2 text-sm flex items-center justify-between">
              Bench Boost
              <span className="text-xl">⚡</span>
            </h3>
            {loading ? (
              <p className="text-xs text-slate-400">Loading...</p>
            ) : bbStatus?.benchBoostUsed ? (
              <div>
                <p className="text-xs text-slate-400 mb-2">Already played this season.</p>
                <div className="bg-emerald-900/40 text-emerald-300 text-xs text-center py-2 rounded border border-emerald-700/30">
                  Used in GW {bbStatus.benchBoostGameweekId}
                </div>
              </div>
            ) : (
              <div>
                <p className="lineup-chip-description text-xs text-emerald-200/70 mb-3">Your bench players also score points for one gameweek.</p>
                <button
                  onClick={() => openModal('bench-boost')}
                  disabled={!hasUpcomingGw}
                  className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/50 text-emerald-400 text-xs font-bold py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {hasUpcomingGw ? 'Play Bench Boost' : 'Chips Locked'}
                </button>
                {!hasUpcomingGw && (
                  <p className="text-[11px] text-slate-500 text-center mt-1.5">No open upcoming gameweek</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chip Activation Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className={`bg-slate-900 border rounded-xl shadow-2xl max-w-md w-full overflow-hidden ${
            activeModal === 'triple-captain'
              ? 'border-purple-500/30'
              : 'border-emerald-500/30'
          }`}>
            {/* Modal header */}
            <div className={`px-6 py-4 border-b ${
              activeModal === 'triple-captain'
                ? 'bg-purple-900/40 border-purple-500/20'
                : 'bg-emerald-900/40 border-emerald-500/20'
            }`}>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-2xl">{activeModal === 'triple-captain' ? '🌟' : '⚡'}</span>
                {activeModal === 'triple-captain' ? 'Activate Triple Captain' : 'Activate Bench Boost'}
              </h2>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4">
              {activeModal === 'triple-captain' ? (
                <p className="text-slate-300 text-sm leading-relaxed">
                  Your captain will earn <strong className="text-purple-400">3x points</strong> instead of the usual 2x for the upcoming gameweek.
                </p>
              ) : (
                <p className="text-slate-300 text-sm leading-relaxed">
                  All three of your bench players will <strong className="text-emerald-400">score their full points</strong> for the upcoming gameweek, in addition to your starting five.
                </p>
              )}

              <div className="bg-amber-900/20 border border-amber-700/30 rounded p-3 text-xs text-amber-200/80">
                <strong>Warning:</strong> You can only use this chip once per season. This action cannot be undone once the gameweek deadline passes.
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 bg-slate-800 flex justify-end gap-3 border-t border-slate-700">
              <button
                onClick={() => setActiveModal(null)}
                disabled={activating}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleActivate}
                disabled={activating}
                className={`text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${
                  activeModal === 'triple-captain'
                    ? 'bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20'
                }`}
              >
                {activating ? (
                  <><SpinnerIcon /> Activating...</>
                ) : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
