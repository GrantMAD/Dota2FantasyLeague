'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { canOptimizeImage } from '@/lib/optimized-image';
import { CircleAlert, UserCheck, TrendingUp, TrendingDown, Minus, Clock, ShieldCheck, Lock, Sparkles, ChevronDown } from 'lucide-react';
import { useToast } from '@/components/Toast';
import type { ChipType, ChipStatus, FantasyPlayer as LineupPlayer, LineupEntry } from '@/types/fantasy';

interface LineupGameweekOption {
  id: number;
  gameweekNumber: number;
  status: string;
  deadline: string | null;
  isLocked: boolean;
}

const SpinnerIcon = () => (
  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

function formatTimeUntilDeadline(value: string): string {
  const deadlineTime = new Date(value).getTime();
  if (!Number.isFinite(deadlineTime)) return 'soon';
  const minutesRemaining = Math.max(0, Math.ceil((deadlineTime - Date.now()) / 60_000));
  const hours = Math.floor(minutesRemaining / 60);
  const minutes = minutesRemaining % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatPoints(value: number): string {
  return Number(value.toFixed(2)).toString();
}

export default function LineupsPage() {
  const toast = useToast();
  const toastError = toast.error;
  const [tcStatus, setTcStatus] = useState<ChipStatus | null>(null);
  const [bbStatus, setBbStatus] = useState<ChipStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ChipType>(null);
  const [activating, setActivating] = useState(false);

  const [fantasySeasonId, setFantasySeasonId] = useState<number | null>(null);
  const [gameweekId, setGameweekId] = useState<number | null>(null);
  const [defaultGameweekId, setDefaultGameweekId] = useState<number | null>(null);
  const [availableGameweeks, setAvailableGameweeks] = useState<LineupGameweekOption[]>([]);
  const [lineupLocked, setLineupLocked] = useState(false);
  const [hasUpcomingGw, setHasUpcomingGw] = useState(false);
  const [lineup, setLineup] = useState<LineupEntry[]>([]);
  const [ownedPlayers, setOwnedPlayers] = useState<LineupPlayer[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDeadlineSave, setConfirmDeadlineSave] = useState(false);

  const loadFantasyContext = useCallback(async (requestedGameweekId?: number) => {
    try {
      const endpoint = requestedGameweekId
        ? `/api/fantasy/context?gameweekId=${requestedGameweekId}`
        : '/api/fantasy/context';
      const res = await fetchWithAuth(endpoint);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load fantasy context');

      setFantasySeasonId(data.fantasySeasonId);
      setGameweekId(data.gameweek?.id ?? null);
      setLineupLocked(Boolean(data.gameweek?.isLocked));
      setHasUpcomingGw(Boolean(data.gameweek?.hasUpcoming));
      setDefaultGameweekId(data.defaultGameweekId ?? null);
      setAvailableGameweeks(data.availableGameweeks ?? []);
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
      toastError('Load Error', err instanceof Error ? err.message : 'Unable to load fantasy lineup');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadFantasyContext();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadFantasyContext]);

  const handleGameweekChange = (value: string) => {
    const selectedGameweekId = Number(value);
    if (Number.isInteger(selectedGameweekId) && selectedGameweekId > 0 && selectedGameweekId !== gameweekId) {
      setLoading(true);
      void loadFantasyContext(selectedGameweekId);
    }
  };

  const updateSlot = (slot: string, playerId: number) => {
    if (lineupLocked) return;
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
    const playerName = player?.in_game_name || player?.name || 'Player';
    const slotLabel = slot.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    toast.info('Slot Updated', `${playerName} assigned to ${slotLabel}.`);
  };

  const setCaptain = (playerId: number, vice = false) => {
    if (lineupLocked) return;
    const playerObj = ownedPlayers.find((p) => p.id === playerId);
    const playerName = playerObj?.in_game_name || playerObj?.name || 'Player';
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
    toast.success(
      vice ? 'Vice-Captain Selected' : 'Captain Selected',
      `${playerName} is now your ${vice ? 'Vice-Captain' : 'Captain (2x points)'}.`
    );
  };

  const saveLineup = async (confirmedNearDeadline = false) => {
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

    const selectedDeadline = availableGameweeks.find((gameweek) => gameweek.id === gameweekId)?.deadline;
    if (selectedDeadline) {
      const timeUntilDeadline = new Date(selectedDeadline).getTime() - Date.now();
      if (timeUntilDeadline <= 0) {
        setConfirmDeadlineSave(false);
        setLineupLocked(true);
        toast.error('Cannot Save Lineup', 'The gameweek deadline has passed. Lineup changes are locked.');
        return;
      }
      if (timeUntilDeadline <= 2 * 60 * 60 * 1000 && !confirmedNearDeadline) {
        setConfirmDeadlineSave(true);
        return;
      }
    }

    setConfirmDeadlineSave(false);
    setSaving(true);
    try {
      const response = await fetchWithAuth('/api/fantasy/lineup', {
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
    if (!chipActivationAvailable) {
      toast.error('Chip Activation Unavailable', 'Switch to the default gameweek before activating a chip.');
      return;
    }
    if (!fantasySeasonId) {
      toast.error('Chip Activation Failed', 'Create a fantasy squad before activating a chip.');
      return;
    }
    setActivating(true);

    const isTripleCaptain = activeModal === 'triple-captain';
    const endpoint = isTripleCaptain ? '/api/fantasy/triple-captain' : '/api/fantasy/bench-boost';

    try {
      const res = await fetchWithAuth(endpoint, {
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
  const startingPlayerDetails = Array.from(new Map(
    startingPlayers
      .map((entry) => ownedPlayers.find((player) => player.id === entry.player_id) || entry.professional_players)
      .filter((player): player is LineupPlayer => Boolean(player))
      .map((player) => [player.id, player]),
  ).values());
  const hasCaptainAndVice = lineup.filter((e) => e.is_captain).length === 1 && lineup.filter((e) => e.is_vice_captain).length === 1;
  const isLineupReady = hasAllStarters && hasCaptainAndVice;
  const selectedGameweek = availableGameweeks.find((gameweek) => gameweek.id === gameweekId);
  const deadlineCountdown = selectedGameweek?.deadline
    ? formatTimeUntilDeadline(selectedGameweek.deadline)
    : null;
  const chipActivationAvailable = gameweekId !== null && gameweekId === defaultGameweekId;

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
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md" style={{ background: 'color-mix(in srgb, #06b6d4 15%, transparent)', color: '#06b6d4' }}>
              <UserCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            Lineups &amp; Tactics
          </h1>
          <p className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
            Set your 5 core starters, appoint your Captain (2×) &amp; Vice-Captain, and order your bench before the deadline.
          </p>
        </div>
      </div>

      {/* Gameweek Command Header Banner */}
      <div
        className="relative overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-sm transition-all"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-cyan-500 to-emerald-500" />
        
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* Gameweek selector dropdown */}
            <div className="relative inline-flex items-center">
              <label htmlFor="lineup-gameweek" className="sr-only">Choose gameweek</label>
              <select
                id="lineup-gameweek"
                value={gameweekId ?? ''}
                onChange={(event) => handleGameweekChange(event.target.value)}
                disabled={loading}
                className="appearance-none rounded-xl border py-2 pl-3.5 pr-9 text-sm font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                style={{
                  background: 'var(--surface-raised)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                {availableGameweeks.map((gameweek) => (
                  <option key={gameweek.id} value={gameweek.id}>
                    Gameweek {gameweek.gameweekNumber} {gameweek.status === 'active'
                      ? gameweek.isLocked ? '(Active · Locked)' : '(Active)'
                      : '(Upcoming)'}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
            </div>

            {/* Lock / Active Status Badge */}
            {lineupLocked ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30">
                <Lock className="h-3.5 w-3.5" />
                Lineup Locked
              </span>
            ) : selectedGameweek?.status === 'active' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Active Gameweek
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30">
                <Clock className="h-3.5 w-3.5" />
                Planning Ahead
              </span>
            )}

            {selectedGameweek?.status === 'upcoming' && !lineupLocked && (
              <p className="mt-2 text-xs font-semibold text-cyan-400" role="status">
                Planning ahead · this lineup is saved separately for Gameweek {selectedGameweek.gameweekNumber}.
              </p>
            )}

            {/* Deadline Countdown */}
            {selectedGameweek?.deadline && !lineupLocked && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                Deadline: <span className="font-mono text-amber-500 dark:text-amber-400 font-bold">{new Date(selectedGameweek.deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span> ({deadlineCountdown})
              </span>
            )}
          </div>

          {/* Action CTA Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-guide="lineup-save-btn"
              data-tour="lineup-save-btn"
              onClick={() => void saveLineup()}
              disabled={saving || !isLineupReady || lineupLocked}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:scale-102 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              }}
            >
              {saving ? (
                <><SpinnerIcon /> Saving...</>
              ) : lineupLocked ? (
                <><Lock className="h-4 w-4" /> Lineup Locked</>
              ) : (
                <><ShieldCheck className="h-4 w-4" /> Save Lineup</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Chip Readiness Horizontal Bar */}
      <div
        className="rounded-2xl border p-4 shadow-sm"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-500 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Special Chips Readiness
          </span>
          {defaultGameweekId !== null && !chipActivationAvailable && (
            <span className="text-[11px] text-amber-500 font-medium">Switch to default GW to activate chips</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Triple Captain Chip Card */}
          <div
            className="flex items-center justify-between rounded-xl border p-3.5 transition-all"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 text-lg">
                🌟
              </div>
              <div>
                <h3 className="text-xs font-bold text-purple-400">Triple Captain</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Captain scores 3× points instead of 2×</p>
              </div>
            </div>
            <div>
              {tcStatus?.tripleCaptainUsed ? (
                <span className="rounded-lg bg-purple-500/15 border border-purple-500/30 px-2.5 py-1 text-[11px] font-bold text-purple-300">
                  Used GW {tcStatus.tripleCaptainGameweekId}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => openModal('triple-captain')}
                  disabled={!hasUpcomingGw || !chipActivationAvailable}
                  className="rounded-xl border border-purple-500/40 bg-purple-500/20 px-3.5 py-1.5 text-xs font-bold text-purple-400 transition-colors hover:bg-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Play Chip
                </button>
              )}
            </div>
          </div>

          {/* Bench Boost Chip Card */}
          <div
            className="flex items-center justify-between rounded-xl border p-3.5 transition-all"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-lg">
                ⚡
              </div>
              <div>
                <h3 className="text-xs font-bold text-emerald-400">Bench Boost</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>All 3 bench players score full points</p>
              </div>
            </div>
            <div>
              {bbStatus?.benchBoostUsed ? (
                <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                  Used GW {bbStatus.benchBoostGameweekId}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => openModal('bench-boost')}
                  disabled={!hasUpcomingGw || !chipActivationAvailable}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Play Chip
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Roster Lineup Container */}
      <div className="w-full">
        <div className="rounded-2xl border p-4 sm:p-6 shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {lineupLocked && (
              <div
                className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"
                role="status"
              >
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
                <div>
                  <p className="font-bold">Lineup locked for Gameweek {selectedGameweek?.gameweekNumber ?? gameweekId}</p>
                  <p className="mt-0.5 text-xs leading-5 opacity-90">
                    The deadline has passed. Your saved lineup is read-only and can no longer be changed.
                  </p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="animate-pulse space-y-6">
                <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4 md:grid-cols-2">
                  <div className="h-10 rounded bg-slate-800" />
                  <div className="h-10 rounded bg-slate-800" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((slot) => (
                    <div key={slot} className="rounded-xl border p-4 transition-all hover:border-cyan-500/40" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}>
                      <div className="mb-3 h-3 w-24 rounded bg-slate-700" />
                      <div className="h-10 rounded bg-slate-800" />
                      <div className="mt-3 h-10 w-40 rounded bg-slate-800" />
                    </div>
                  ))}
                </div>
                <div className="border-t pt-6" style={{ borderColor: "var(--border)" }}>
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
                <div data-guide="lineup-starters" data-tour="lineup-starters">
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
                      <p className="mt-1 text-slate-400">
                        Player points and form are from the latest gameweek with recorded scores, not necessarily the selected lineup gameweek. Current-gameweek scores appear as matches are processed.
                      </p>
                    </div>
                  </div>

                  {/* Captain & Vice-Captain Controls */}
                  <div data-guide="lineup-captain-controls" data-tour="lineup-captain-controls" className="mb-4 grid grid-cols-1 gap-4 rounded-xl border p-4 md:grid-cols-2" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label htmlFor="lineup-captain" className="block text-xs font-bold uppercase tracking-wider text-amber-400">Captain · 2x points</label>
                        {startingPlayerDetails.length === 0 && (
                          <span className="text-[11px] text-amber-400/70 italic">Pick starting 5 first</span>
                        )}
                      </div>
                      <select
                        id="lineup-captain"
                        value={lineup.find((entry) => entry.is_captain)?.player_id ?? ''}
                        onChange={(event) => event.target.value && setCaptain(Number(event.target.value), false)}
                        disabled={lineupLocked || startingPlayerDetails.length === 0}
                        className="w-full rounded-xl border border-amber-500/40 px-3.5 py-2 text-sm font-medium focus:border-amber-500 focus:outline-none disabled:opacity-50" style={{ background: "var(--surface)", color: "var(--text-primary)" }}
                      >
                        <option value="">{startingPlayerDetails.length === 0 ? 'Assign starting players below first' : 'Select captain'}</option>
                        {startingPlayerDetails.map((player) => {
                          const trendSymbol = player.form_trend === 'up' ? '▲' : player.form_trend === 'down' ? '▼' : '▬';
                          const gwPtsStr = player.last_gw_points != null ? `${formatPoints(player.last_gw_points)} pts ${trendSymbol}` : '';
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
                        <label htmlFor="lineup-vice-captain" className="block text-xs font-bold uppercase tracking-wider text-slate-300">Vice-Captain · backup</label>
                        {startingPlayerDetails.length === 0 && (
                          <span className="text-[11px] text-slate-400 italic">Pick starting 5 first</span>
                        )}
                      </div>
                      <select
                        id="lineup-vice-captain"
                        value={lineup.find((entry) => entry.is_vice_captain)?.player_id ?? ''}
                        onChange={(event) => event.target.value && setCaptain(Number(event.target.value), true)}
                        disabled={lineupLocked || startingPlayerDetails.length === 0}
                        className="w-full rounded-xl border px-3.5 py-2 text-sm font-medium focus:border-cyan-500 focus:outline-none disabled:opacity-50" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                      >
                        <option value="">{startingPlayerDetails.length === 0 ? 'Assign starting players below first' : 'Select vice-captain'}</option>
                        {startingPlayerDetails.map((player) => {
                          const trendSymbol = player.form_trend === 'up' ? '▲' : player.form_trend === 'down' ? '▼' : '▬';
                          const gwPtsStr = player.last_gw_points != null ? `${formatPoints(player.last_gw_points)} pts ${trendSymbol}` : '';
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
                          className="rounded-xl border p-4 transition-all hover:border-cyan-500/40" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <label htmlFor={`lineup-${slot}`} className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                              {displayRole}
                            </label>
                            {eligiblePlayers.length === 0 && (
                              <span className="text-[11px] text-amber-400/80">No {displayRole} in your squad</span>
                            )}
                          </div>
                          <select
                            id={`lineup-${slot}`}
                            value={selected?.player_id ?? ''}
                            disabled={lineupLocked}
                            onChange={(event) => {
                              if (!event.target.value) {
                                setLineup((current) => current.filter((entry) => entry.slot !== slot));
                              } else {
                                updateSlot(slot, Number(event.target.value));
                              }
                            }}
                            className="w-full rounded-xl border px-3.5 py-2 text-sm font-medium focus:border-cyan-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                          >
                            <option value="">Select player ({displayRole})</option>
                            {eligiblePlayers.map((player) => {
                              const trendSymbol = player.form_trend === 'up' ? '▲' : player.form_trend === 'down' ? '▼' : '▬';
                              const priceStr = player.current_price != null ? `$${Number(player.current_price).toFixed(1)}M` : '';
                              const gwPtsStr = player.last_gw_points != null ? `${formatPoints(player.last_gw_points)} pts` : '';
                              const extras = [player.primary_role, priceStr, gwPtsStr ? `Latest GW: ${gwPtsStr} ${trendSymbol}` : ''].filter(Boolean).join(' · ');
                              return (
                                <option key={player.id} value={player.id}>
                                  {player.in_game_name || player.name} {extras ? `(${extras})` : ''}
                                </option>
                              );
                            })}
                          </select>
                          {selected?.professional_players && (
                            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border p-3.5 shadow-sm" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-700">
                                  {selected.professional_players.profile_image_url ? (
                                    <Image src={selected.professional_players.profile_image_url} alt={selected.professional_players.in_game_name || selected.professional_players.name} width={40} height={40} unoptimized={!canOptimizeImage(selected.professional_players.profile_image_url)} className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="player-avatar-initials text-xs font-bold">{(selected.professional_players.in_game_name || selected.professional_players.name || 'P').slice(0, 2).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <p className="truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>{selected.professional_players.in_game_name || selected.professional_players.name}</p>
                                    {selected.is_captain && (
                                      <span
                                        aria-label="Captain"
                                        title="Captain · earns 2× points"
                                        className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md"
                                        style={{
                                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.45)',
                                        }}
                                      >
                                        <span>C</span>
                                        <span className="text-[9px] font-bold opacity-90">2×</span>
                                      </span>
                                    )}
                                    {selected.is_vice_captain && !selected.is_captain && (
                                      <span
                                        aria-label="Vice-captain"
                                        title="Vice-captain · backup captain"
                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shadow-md"
                                        style={{
                                          background: 'linear-gradient(135deg, #06b6d4, #0284c7)',
                                          boxShadow: '0 2px 6px rgba(6, 182, 212, 0.35)',
                                        }}
                                      >
                                        V
                                      </span>
                                    )}
                                  </div>
                                  <p className="truncate text-xs text-slate-400">{selected.professional_players.professional_teams?.name || 'Free Agent'} · <span className="text-amber-400/90 font-medium">${Number(selected.professional_players.current_price || 0).toFixed(1)}M</span></p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 text-right">
                                <div className="text-right">
                                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Latest GW</div>
                                  <div className="text-xs font-mono font-bold text-white flex items-center justify-end gap-1">
                                    {formatPoints(selected.professional_players.last_gw_points ?? 0)} pts
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
                                    {formatPoints(selected.professional_players.recent_points ?? 0)}
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
                <div data-guide="lineup-bench" data-tour="lineup-bench" className="border-t border-slate-700/70 pt-6">
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
                          <label htmlFor={`lineup-${slot}`} className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                            {slot.replace('_', ' ')}
                          </label>
                          <select
                            id={`lineup-${slot}`}
                            value={selected?.player_id ?? ''}
                            disabled={lineupLocked}
                            onChange={(event) => {
                              if (!event.target.value) {
                                setLineup((current) => current.filter((entry) => entry.slot !== slot));
                              } else {
                                updateSlot(slot, Number(event.target.value));
                              }
                            }}
                            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">Select player</option>
                            {ownedPlayers.map((player) => {
                              const trendSymbol = player.form_trend === 'up' ? '▲' : player.form_trend === 'down' ? '▼' : '▬';
                              const priceStr = player.current_price != null ? `$${Number(player.current_price).toFixed(1)}M` : '';
                              const gwPtsStr = player.last_gw_points != null ? `${formatPoints(player.last_gw_points)} pts` : '';
                              const extras = [player.primary_role, priceStr, gwPtsStr ? `GW: ${gwPtsStr} ${trendSymbol}` : ''].filter(Boolean).join(' · ');
                              return (
                                <option key={player.id} value={player.id}>
                                  {player.in_game_name || player.name} {extras ? `(${extras})` : ''}
                                </option>
                              );
                            })}
                          </select>
                          {selected?.professional_players && (
                            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border p-2.5 shadow-sm" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-700">
                                  {selected.professional_players.profile_image_url ? (
                                    <Image src={selected.professional_players.profile_image_url} alt={selected.professional_players.in_game_name || selected.professional_players.name} width={32} height={32} unoptimized={!canOptimizeImage(selected.professional_players.profile_image_url)} className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="player-avatar-initials text-xs font-bold">{(selected.professional_players.in_game_name || selected.professional_players.name || 'P').slice(0, 2).toUpperCase()}</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold" style={{ color: "var(--text-primary)" }}>{selected.professional_players.in_game_name || selected.professional_players.name}</p>
                                  <p className="truncate text-[11px] text-slate-400">${Number(selected.professional_players.current_price || 0).toFixed(1)}M</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[9px] uppercase tracking-wider text-slate-400">Latest GW</div>
                                <div className="text-xs font-mono font-bold text-white flex items-center justify-end gap-1">
                                  {formatPoints(selected.professional_players.last_gw_points ?? 0)}
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

      {confirmDeadlineSave && selectedGameweek && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmDeadlineSave(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deadline-save-title"
            aria-describedby="deadline-save-description"
            className="w-full max-w-md rounded-2xl border shadow-2xl" style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-start gap-3 border-b border-slate-700 px-5 py-4">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
              <div>
                <h2 id="deadline-save-title" className="text-lg font-bold text-white">Deadline approaching</h2>
                <p className="mt-1 text-sm text-amber-100">
                  Deadline is in {deadlineCountdown ?? 'less than two hours'} for Gameweek {selectedGameweek.gameweekNumber}.
                </p>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <p id="deadline-save-description" className="text-sm leading-6 text-slate-300">
                Are you sure you want to save these lineup changes before the deadline locks your team?
                {selectedGameweek.deadline
                  ? ` Deadline: ${new Date(selectedGameweek.deadline).toLocaleString()}.`
                  : ''}
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmDeadlineSave(false)}
                  className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => void saveLineup(true)}
                  disabled={saving}
                  className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Lineup'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chip Activation Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div style={{ background: "var(--surface)", borderColor: "var(--border)" }} className={`border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden ${
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
            <div className="px-6 py-4 flex justify-end gap-3 border-t" style={{ background: "var(--surface-raised)", borderColor: "var(--border)" }}>
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
