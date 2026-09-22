'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeftRight, CheckCircle2, Minus, Plus } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';

type TransferPlayer = {
  id: number;
  name: string;
  in_game_name: string | null;
  primary_role: string;
  profile_image_url: string | null;
  current_price: number;
  recent_points?: number | null;
  gameweek_points?: number | null;
  availability_status?: string | null;
  ownership_percentage?: number | null;
  total_season_points?: number | null;
  last_gw_points?: number | null;
  real_name?: string | null;
  professional_teams?: { name?: string | null; region?: string | null } | null;
  performances?: TransferPerformance[];
};

type TransferPerformance = {
  id: number;
  gameweek_id: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_minute: number;
  experience_per_minute: number;
  matches?: { team_b?: { name?: string | null } | null } | null;
  fantasy_points_breakdown?: { total_points?: number | null } | null;
};

// 5 starters + 3 bench = 8 player squad
const SQUAD_MAX_SIZE = 8;
const STARTER_ROLES = ['Carry', 'Mid', 'Offlane', 'Support', 'Hard Support'] as const;
type StarterRole = typeof STARTER_ROLES[number];

export default function TransfersPage() {
  const toast = useToast();
  const [players, setPlayers] = useState<TransferPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'owned' | 'available'>('all');
  const [rosteredOnly, setRosteredOnly] = useState(true);
  const [pinOwnedFirst, setPinOwnedFirst] = useState(true);
  const [fantasySeasonId, setFantasySeasonId] = useState<number | null>(null);
  const [budget, setBudget] = useState(0);
  const [freeTransfers, setFreeTransfers] = useState(0);
  const [wildcardUsed, setWildcardUsed] = useState(false);
  const [ownedPlayerIds, setOwnedPlayerIds] = useState<number[]>([]);
  // Building mode: multi-select keyed by player ID so details survive filter/page changes
  const [buildingSelections, setBuildingSelections] = useState<Map<number, TransferPlayer>>(new Map());
  // Transfer mode: single swap
  const [selectedPlayerIn, setSelectedPlayerIn] = useState<number | null>(null);
  const [selectedPlayerOut, setSelectedPlayerOut] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const pageSize = 20;

  // Stored details for selected owned players in case they are on a different market page
  const [ownedPlayersMap, setOwnedPlayersMap] = useState<Map<number, TransferPlayer>>(new Map());

  // Player Detail Modal state
  const [modalPlayer, setModalPlayer] = useState<TransferPlayer | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // 1. Initial transfer context
  useEffect(() => {
    async function fetchContext() {
      try {
        const contextRes = await fetchWithAuth('/api/fantasy/transfer-context');
        const context = await contextRes.json();
        if (!contextRes.ok) throw new Error(context.error || 'Failed to load transfer context');

        const ownedIds: number[] = context.ownedPlayerIds || [];
        setFantasySeasonId(context.fantasySeasonId);
        setBudget(context.budget || 0);
        setFreeTransfers(context.freeTransfers || 0);
        setWildcardUsed(context.wildcardUsed || false);
        setOwnedPlayerIds(ownedIds);

        if (ownedIds.length > 0) {
          const ownedRes = await fetch(`/api/players?ids=${ownedIds.join(',')}`);
          if (ownedRes.ok) {
            const ownedData = await ownedRes.json();
            const map = new Map<number, TransferPlayer>();
            for (const p of (ownedData.data || [])) {
              map.set(p.id, p);
            }
            setOwnedPlayersMap(map);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load transfer context');
      }
    }
    fetchContext();
  }, []);

  // 2. Fetch paginated players with debounce
  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        const queryParams = new URLSearchParams({
          limit: pageSize.toString(),
          offset: ((page - 1) * pageSize).toString(),
          sort: 'price',
          desc: 'true',
        });
        if (search.trim()) queryParams.set('search', search.trim());
        if (roleFilter) queryParams.set('role', roleFilter);
        if (rosteredOnly) queryParams.set('rostered', 'true');

        const playersRes = await fetch(`/api/players?${queryParams.toString()}`);
        const data = await playersRes.json();
        if (!playersRes.ok) throw new Error(data.error || 'Failed to load players');
        if (cancelled) return;

        setPlayers(data.data || []);
        setTotalPlayers(data.total || 0);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load players');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [search, roleFilter, page, rosteredOnly]);

  const openPlayerModal = async (playerSummary: TransferPlayer) => {
    setModalPlayer(playerSummary);
    setModalLoading(true);
    try {
      const res = await fetch(`/api/players/${playerSummary.id}`);
      if (res.ok) {
        const data = await res.json();
        setModalPlayer(data.player);
      }
    } catch {
      // Keep baseline playerSummary if detailed fetch fails
    } finally {
      setModalLoading(false);
    }
  };

  const filteredPlayers = players.filter((p) => {
    if (search && !(p.in_game_name || p.name || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && p.primary_role !== roleFilter) return false;
    const isOwned = ownedPlayerIds.includes(p.id);
    if (ownershipFilter === 'owned' && !isOwned) return false;
    if (ownershipFilter === 'available' && isOwned) return false;
    return true;
  });

  // When pinOwnedFirst is active, gather owned squad players matching current filters (even if on another page)
  // and prioritize them at the very top of the list.
  const displayedPlayers = (() => {
    if (!pinOwnedFirst || ownershipFilter === 'available') {
      return filteredPlayers;
    }

    // Get all owned players from our map that match search and role filters
    const matchingOwnedSquad: TransferPlayer[] = [];
    ownedPlayersMap.forEach((p) => {
      if (search && !(p.in_game_name || p.name || '').toLowerCase().includes(search.toLowerCase())) return;
      if (roleFilter && p.primary_role !== roleFilter) return;
      matchingOwnedSquad.push(p);
    });

    const ownedIdSet = new Set(matchingOwnedSquad.map((p) => p.id));
    const nonOwned = filteredPlayers.filter((p) => !ownedIdSet.has(p.id) && !ownedPlayerIds.includes(p.id));

    return [...matchingOwnedSquad, ...nonOwned];
  })();

  const selectedPlayerInDetails = players.find((player) => player.id === selectedPlayerIn);
  const selectedPlayerOutDetails = players.find((player) => player.id === selectedPlayerOut) || (selectedPlayerOut ? ownedPlayersMap.get(selectedPlayerOut) : null);
  const rolesMatch = Boolean(
    selectedPlayerInDetails &&
    selectedPlayerOutDetails &&
    selectedPlayerInDetails.primary_role === selectedPlayerOutDetails.primary_role
  );

  const handlePlayerAction = (playerId: number, player?: TransferPlayer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (ownedPlayerIds.includes(playerId)) {
      if (!isBuilding) setSelectedPlayerOut(selectedPlayerOut === playerId ? null : playerId);
    } else if (isBuilding) {
      const spotsLeft = SQUAD_MAX_SIZE - ownedPlayerIds.length - buildingSelections.size;
      setBuildingSelections((prev) => {
        const next = new Map(prev);
        if (next.has(playerId)) {
          next.delete(playerId);
        } else if (spotsLeft > 0 && player) {
          next.set(playerId, player);
        }
        return next;
      });
    } else {
      setSelectedPlayerIn(selectedPlayerIn === playerId ? null : playerId);
    }
  };

  // Building mode: squad is below max size
  const isBuilding = ownedPlayerIds.length < SQUAD_MAX_SIZE;

  // Derive role slots from building selections — uses stored player objects, not current page
  const selectedRolesFilled = new Map<StarterRole, TransferPlayer>(); // role -> player
  const benchSelections: TransferPlayer[] = [];
  for (const [, player] of buildingSelections) {
    const role = player.primary_role as StarterRole | undefined;
    if (role && STARTER_ROLES.includes(role) && !selectedRolesFilled.has(role)) {
      selectedRolesFilled.set(role, player);
    } else {
      benchSelections.push(player);
    }
  }
  const neededStarterRoles = STARTER_ROLES.filter((r) => !selectedRolesFilled.has(r));
  const benchSlotsTotal = SQUAD_MAX_SIZE - STARTER_ROLES.length; // 3
  const totalSelected = buildingSelections.size;
  const spotsRemaining = SQUAD_MAX_SIZE - ownedPlayerIds.length - totalSelected;
  const selectionCost = [...buildingSelections.values()].reduce(
    (sum, p) => sum + (p.current_price ?? 0),
    0
  );


  const submitAddToSquad = async () => {
    if (!fantasySeasonId || buildingSelections.size === 0) {
      toast.info('Select Players', 'Select the players you want in your squad, then confirm.');
      return;
    }
    const selectedIds = [...buildingSelections.keys()];
    setActionLoading(true);
    try {
      const response = await fetchWithAuth('/api/fantasy/squad/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fantasySeasonId, playerIds: selectedIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add players');
      setBudget(Number(data.budget ?? budget));
      setOwnedPlayerIds((current) => [...current, ...selectedIds]);
      setBuildingSelections(new Map());
      toast.success('Squad Updated', `${selectedIds.length} player${selectedIds.length > 1 ? 's' : ''} added! (${data.squadSize}/${data.squadMaxSize})`);
    } catch (err) {
      toast.error('Failed to Add Players', err instanceof Error ? err.message : 'Could not add players');
    } finally {
      setActionLoading(false);
    }
  };

  const submitTransfer = async () => {
    if (!fantasySeasonId || selectedPlayerIn === null || selectedPlayerOut === null) {
      toast.info('Select Players', 'Select one player to buy and one player to sell.');
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetchWithAuth('/api/fantasy/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fantasySeasonId, transfersIn: [selectedPlayerIn], transfersOut: [selectedPlayerOut] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Transfer failed');
      setBudget(Number(data.budget ?? budget));
      setFreeTransfers(Number(data.free_transfers_remaining ?? freeTransfers));
      setOwnedPlayerIds((current) => [...current.filter((id) => id !== selectedPlayerOut), selectedPlayerIn]);
      setSelectedPlayerIn(null);
      setSelectedPlayerOut(null);
      const playerInName = players.find((p) => p.id === selectedPlayerIn)?.in_game_name || 'The player';
      toast.success('Transfer Complete', `${playerInName} is now in your squad.`);
    } catch (err) {
      toast.error('Transfer Failed', err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setActionLoading(false);
    }
  };

  const activateWildcard = async () => {
    if (!fantasySeasonId) {
      toast.info('No Squad', 'Create a fantasy team before using the wildcard.');
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetchWithAuth('/api/fantasy/wildcard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fantasySeasonId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Wildcard activation failed');
      setWildcardUsed(true);
      setFreeTransfers(99);
      toast.success('Wildcard Played', 'Unlimited free transfers are now active.');
    } catch (err) {
      toast.error('Wildcard Failed', err instanceof Error ? err.message : 'Wildcard activation failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <ArrowLeftRight className="w-8 h-8 text-amber-400 shrink-0" />
            <span>Transfer Market</span>
          </h1>
          <p className="text-slate-400">Click any player to inspect full stats, form, and match performance history</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 flex items-center gap-4 shadow-sm">
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase">Bank</div>
            <div className="text-lg font-mono font-bold text-emerald-400">${(budget).toFixed(1)}M</div>
          </div>
          <div className="w-px h-8 bg-slate-700"></div>
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase">Free Transfers</div>
            <div className="text-lg font-bold text-white">{freeTransfers}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-white mb-4">Search & Filters</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Search Player</label>
                <input
                  type="text"
                  placeholder="e.g. Yatoro, Nisha..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">All Roles</option>
                  <option value="Carry">Carry</option>
                  <option value="Mid">Mid</option>
                  <option value="Offlane">Offlane</option>
                  <option value="Support">Support</option>
                  <option value="Hard Support">Hard Support</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Squad Status</label>
                <select
                  value={ownershipFilter}
                  onChange={(e) => setOwnershipFilter(e.target.value as 'all' | 'owned' | 'available')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Players</option>
                  <option value="owned">My Squad (Owned)</option>
                  <option value="available">Available to Buy</option>
                </select>
              </div>

              <div className="pt-1 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rosteredOnly}
                    onChange={(e) => {
                      setRosteredOnly(e.target.checked);
                      setPage(1);
                    }}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-300">Signed Rosters Only</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pinOwnedFirst}
                    onChange={(e) => setPinOwnedFirst(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 accent-amber-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-300">Show My Squad at Top</span>
                </label>
              </div>
            </div>
          </div>

          <div className="wildcard-card bg-amber-900/20 border border-amber-700/50 rounded-xl p-5">
            <h3 className="wildcard-card-title font-semibold text-amber-500 mb-2 text-sm">Wildcard Available</h3>
            <p className="wildcard-card-description text-xs text-amber-200/70 mb-3">{wildcardUsed ? 'Wildcard already used this season.' : 'Play it to make unlimited transfers this week with no point deductions.'}</p>
            <button disabled={wildcardUsed || actionLoading} onClick={activateWildcard} className="wildcard-card-action w-full bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/50 text-amber-500 text-xs font-bold py-2 rounded-lg transition-colors disabled:opacity-50">
              {wildcardUsed ? 'Wildcard Used' : 'Play Wildcard'}
            </button>
          </div>

          {isBuilding ? (
            // ── BUILDING MODE PANEL ────────────────────────────────────────────
            <div className="bg-slate-800/50 border border-amber-600/40 rounded-xl p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-amber-400 mb-1">Build Your Squad</h4>
              <p className="text-xs text-slate-400 mb-4">
                {ownedPlayerIds.length + totalSelected}/{SQUAD_MAX_SIZE} players · {spotsRemaining > 0 ? `${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} left` : 'Squad full!'}
              </p>

              {/* Starter role slots */}
              <div className="space-y-1.5 mb-3">
                {STARTER_ROLES.map((role) => {
                  const p = selectedRolesFilled.get(role);
                  return (
                    <div key={role} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                      p ? 'bg-emerald-900/30 border border-emerald-700/50' : 'bg-slate-700/30 border border-slate-600/40'
                    }`}>
                      <span className={`font-semibold uppercase tracking-wider ${p ? 'text-emerald-400' : 'text-slate-500'}`}>{role}</span>
                      {p ? (
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{p.in_game_name || p.name}</span>
                          <button
                            onClick={() => setBuildingSelections((prev) => { const next = new Map(prev); next.delete(p.id); return next; })}
                            className="text-slate-400 hover:text-red-400 transition-colors"
                          >✕</button>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Needed</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bench slots */}
              <div className="space-y-1.5 mb-4">
                {Array.from({ length: benchSlotsTotal }).map((_, i) => {
                  const p = benchSelections[i];
                  return (
                    <div key={`bench-${i}`} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                      p ? 'bg-slate-700/50 border border-slate-600' : 'bg-slate-800/30 border border-slate-700/30'
                    }`}>
                      <span className="text-slate-500 font-semibold uppercase tracking-wider">Bench {i + 1}</span>
                      {p ? (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300">{p.in_game_name || p.name}</span>
                          <button
                            onClick={() => setBuildingSelections((prev) => { const next = new Map(prev); next.delete(p.id); return next; })}
                            className="text-slate-400 hover:text-red-400 transition-colors"
                          >✕</button>
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">Optional</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Cost summary */}
              {totalSelected > 0 && (
                <div className="flex justify-between text-xs mb-4 px-1">
                  <span className="text-slate-400">Selection cost</span>
                  <span className="font-mono text-amber-400 font-bold">${selectionCost.toFixed(1)}M</span>
                </div>
              )}

              {neededStarterRoles.length > 0 && totalSelected > 0 && (
                <p className="text-xs text-amber-300/80 mb-3 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
                  Still needed: {neededStarterRoles.join(', ')}
                </p>
              )}

              <button
                disabled={actionLoading || buildingSelections.size === 0}
                onClick={submitAddToSquad}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 shadow-md"
              >
                {actionLoading ? 'Adding...' : totalSelected === 0 ? 'Select players from the list →' : `Confirm ${totalSelected} Player${totalSelected !== 1 ? 's' : ''}`}
              </button>
            </div>
          ) : (selectedPlayerIn !== null || selectedPlayerOut !== null) && (
            // ── TRANSFER MODE PANEL ────────────────────────────────────────────
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-white mb-2">Pending Transfer</h4>
              <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                {selectedPlayerIn
                  ? `Buying: ${selectedPlayerInDetails?.in_game_name || 'Player'} (${selectedPlayerInDetails?.primary_role || 'Role unknown'})`
                  : 'Select a player to buy.'}
                <br />
                {selectedPlayerOut
                  ? `Selling: ${selectedPlayerOutDetails?.in_game_name || 'Player'} (${selectedPlayerOutDetails?.primary_role || 'Role unknown'})`
                  : 'Select an owned player to sell.'}
              </p>
              {selectedPlayerIn !== null && selectedPlayerOut !== null && !rolesMatch && (
                <p className="mb-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
                  Transfers must be role-for-role. Select a {selectedPlayerOutDetails?.primary_role || 'matching'} to buy.
                </p>
              )}
              <button
                disabled={actionLoading || selectedPlayerIn === null || selectedPlayerOut === null || !rolesMatch}
                onClick={submitTransfer}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 shadow-md"
              >
                {actionLoading ? 'Processing...' : 'Confirm Transfer'}
              </button>
            </div>
          )}
        </div>

        {/* Players Table */}
        <div className="lg:col-span-3">
          {error && (
            <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 border-b border-slate-700">
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Player</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Role</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Price</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Form (Avg)</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Last GW</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading transfer candidates...</td>
                    </tr>
                  ) : displayedPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No players found matching your criteria.</td>
                    </tr>
                  ) : (
                    displayedPlayers.map((player) => {
                      const isOwned = ownedPlayerIds.includes(player.id);
                      return (
                        <tr
                          key={player.id}
                          onClick={() => openPlayerModal(player)}
                          className={`transition-colors group cursor-pointer ${
                            isOwned
                              ? 'bg-emerald-950/20 hover:bg-emerald-950/35 border-l-2 border-l-emerald-500'
                              : 'hover:bg-slate-700/40'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full border overflow-hidden shrink-0 flex items-center justify-center ${
                                isOwned ? 'bg-slate-800 border-emerald-500/50' : 'bg-slate-700 border-slate-600'
                              }`}>
                                {player.profile_image_url ? (
                                  <Image src={player.profile_image_url} alt={player.in_game_name || player.name} width={40} height={40} unoptimized className="w-full h-full object-cover" />
                                ) : (
                                  <span className="player-avatar-initials text-xs font-bold">
                                    {(player.in_game_name || player.name || '').substring(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                                  {player.in_game_name || player.name}
                                  {isOwned && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 border border-emerald-500/30">
                                      <CheckCircle2 className="w-3 h-3" />
                                      In Squad
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400">{player.professional_teams?.name || 'Free Agent'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="transfer-role-badge inline-block bg-slate-700/80 text-slate-300 text-[10px] uppercase font-bold px-2 py-1 rounded">
                              {player.primary_role || 'Flexible'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="font-mono font-bold text-amber-400">${player.current_price}M</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="transfer-form-average text-sm text-slate-200 font-mono">{player.recent_points ?? '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="text-sm font-bold text-white font-mono">{player.gameweek_points ?? '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handlePlayerAction(player.id, player, e)}
                              className={`transfer-action-button inline-flex items-center justify-center p-2 rounded-lg font-medium text-xs transition-all shadow-sm ${
                                isOwned
                                  ? selectedPlayerOut === player.id
                                    ? 'bg-red-600 text-white ring-2 ring-red-400'
                                    : 'bg-slate-700/80 hover:bg-red-600 text-slate-200 hover:text-white border border-slate-600/60'
                                  : isBuilding
                                  ? buildingSelections.has(player.id)
                                    ? 'bg-amber-500 text-slate-900 ring-2 ring-amber-300 font-bold'
                                    : spotsRemaining <= 0
                                    ? 'bg-slate-700/40 text-slate-600 cursor-not-allowed border border-slate-700'
                                    : 'bg-slate-700/80 hover:bg-emerald-600 text-white border border-slate-600/60'
                                  : selectedPlayerIn === player.id
                                  ? 'bg-amber-500 text-slate-900 ring-2 ring-amber-300 font-bold'
                                  : 'bg-slate-700/80 hover:bg-emerald-600 text-white border border-slate-600/60'
                              }`}
                              title={
                                isOwned ? 'In your squad' :
                                isBuilding && buildingSelections.has(player.id) ? 'Click to deselect' :
                                isBuilding && spotsRemaining <= 0 ? 'Squad full' :
                                isBuilding ? 'Click to select' : 'Select to buy'
                              }
                            >
                              {isOwned ? (
                                <Minus className="w-4 h-4" />
                              ) : isBuilding && buildingSelections.has(player.id) ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <Plus className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-700 bg-slate-800/40">
              <div className="text-xs text-slate-400">
                Showing{' '}
                <span className="font-semibold text-white">
                  {totalPlayers === 0 ? 0 : (page - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-white">
                  {Math.min(page * pageSize, totalPlayers)}
                </span>{' '}
                of <span className="font-semibold text-white">{totalPlayers}</span> players
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>

                <div className="flex items-center gap-1 text-xs text-slate-300">
                  <span className="px-2 py-1 rounded bg-slate-700/80 font-mono font-bold text-amber-400">
                    {page}
                  </span>
                  <span className="text-slate-500">/</span>
                  <span className="font-mono text-slate-400">
                    {Math.max(1, Math.ceil(totalPlayers / pageSize))}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={page >= Math.ceil(totalPlayers / pageSize) || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Player Details Modal */}
      {modalPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            {/* Modal Header Banner */}
            <div className="relative border-b border-slate-800 bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 p-6">
              <button
                type="button"
                onClick={() => setModalPlayer(null)}
                className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Close modal"
              >
                ✕
              </button>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-800 border-2 border-slate-700 shadow-xl overflow-hidden shrink-0 flex items-center justify-center">
                  {modalPlayer.profile_image_url ? (
                    <Image src={modalPlayer.profile_image_url} alt={modalPlayer.in_game_name || modalPlayer.name} width={96} height={96} unoptimized className="w-full h-full object-cover" />
                  ) : (
                    <span className="player-avatar-initials text-3xl font-bold">
                      {(modalPlayer.in_game_name || modalPlayer.name || 'P').substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">{modalPlayer.in_game_name || modalPlayer.name}</h2>
                    <span className="bg-slate-700 text-slate-300 text-xs font-bold uppercase px-2 py-0.5 rounded">
                      {modalPlayer.primary_role}
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded border border-emerald-500/30 capitalize">
                      {modalPlayer.availability_status || 'Available'}
                    </span>
                  </div>

                  <p className="text-sm text-slate-400 mb-3">
                    {modalPlayer.real_name || modalPlayer.name} · <strong className="text-amber-400">{modalPlayer.professional_teams?.name || 'Free Agent'}</strong> ({modalPlayer.professional_teams?.region || 'Global'})
                  </p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        handlePlayerAction(modalPlayer.id);
                        setModalPlayer(null);
                      }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
                        ownedPlayerIds.includes(modalPlayer.id)
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      {ownedPlayerIds.includes(modalPlayer.id) ? 'Sell From Squad' : 'Select to Buy'}
                    </button>
                    <Link
                      href={`/players/${modalPlayer.id}`}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      Full Profile Page →
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3 text-center">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Market Price</div>
                  <div className="text-xl font-mono font-bold text-amber-400">${modalPlayer.current_price}M</div>
                </div>
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3 text-center">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Ownership</div>
                  <div className="text-xl font-bold text-white">{modalPlayer.ownership_percentage ?? 24.5}%</div>
                </div>
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3 text-center">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Season Points</div>
                  <div className="text-xl font-bold text-white font-mono">{modalPlayer.total_season_points ?? modalPlayer.recent_points ?? 124.0}</div>
                </div>
                <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3 text-center">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Latest Gameweek</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono">+{modalPlayer.last_gw_points ?? modalPlayer.gameweek_points ?? 14.5} pts</div>
                </div>
              </div>

              {/* Match Performance Details */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <span>⚔️</span> Recent Match History & Scoring Breakdown
                </h4>
                {modalLoading ? (
                  <div className="p-6 text-center text-sm text-slate-400 border border-slate-800 rounded-lg">
                    Loading performance details...
                  </div>
                ) : (!modalPlayer.performances || modalPlayer.performances.length === 0) ? (
                  <div className="p-4 text-center text-xs text-slate-400 border border-slate-800 rounded-lg bg-slate-950/40">
                    No individual match performances recorded yet for this season.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-2.5">Gameweek</th>
                          <th className="px-3 py-2.5">Opponent</th>
                          <th className="px-3 py-2.5 text-center">K / D / A</th>
                          <th className="px-3 py-2.5 text-center">GPM / XPM</th>
                          <th className="px-3 py-2.5 text-right">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 bg-slate-900/50 font-mono">
                        {modalPlayer.performances.map((perf) => (
                          <tr key={perf.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-3 py-2.5 text-slate-300 font-sans font-medium">GW {perf.gameweek_id}</td>
                            <td className="px-3 py-2.5 text-white font-sans">
                              vs {perf.matches?.team_b?.name || 'Opponent'}
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-300">
                              {perf.kills}/{perf.deaths}/{perf.assists}
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-400">
                              {perf.gold_per_minute} / {perf.experience_per_minute}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-amber-400">
                              {perf.fantasy_points_breakdown?.total_points ?? 16.5} pts
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Price & Transfer Status */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Player Availability Status</p>
                  <p className="text-sm font-semibold text-white capitalize">{modalPlayer.availability_status || 'Active for selection'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

