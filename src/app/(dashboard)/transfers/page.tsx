'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  CheckCircle2,
  Minus,
  Plus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';
import { PriceSparkline } from '@/components/PriceSparkline';
import { DifferentialScoutPanel } from '@/components/DifferentialScoutPanel';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';
import { canOptimizeImage } from '@/lib/optimized-image';
import type { FantasyPlayer as TransferPlayer } from '@/types/fantasy';
import { TransferMarketFilters } from './components/TransferMarketFilters';
import { TransferSuggestionsPanel } from './components/TransferSuggestionsPanel';
import { TransferPlayerDetailsModal } from './components/TransferPlayerDetailsModal';
import {
  ROLE_ACCENTS,
  STARTER_ROLES,
  SQUAD_MAX_SIZE,
  type StarterRole,
  type TransferOwnershipFilter,
  type TransferSortBy,
  type TransferSuggestion,
  type TransferSuggestionSummary,
} from './transfer-types';

function TransfersPageContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const quickAddPlayerIdParam = searchParams.get('playerId');
  const quickAddPlayerId = quickAddPlayerIdParam ? Number(quickAddPlayerIdParam) : null;
  const lastHandledQuickAddPlayerId = useRef<number | null>(null);
  const currentQuickAddPlayerId = useRef<number | null>(quickAddPlayerId);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [players, setPlayers] = useState<TransferPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState<TransferOwnershipFilter>('all');
  const [pinOwnedFirst, setPinOwnedFirst] = useState(true);
  const [sortBy, setSortBy] = useState<TransferSortBy>('price');
  const [sortDesc, setSortDesc] = useState(true);
  const [fantasySeasonId, setFantasySeasonId] = useState<number | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [freeTransfers, setFreeTransfers] = useState(2);
  const [wildcardUsed, setWildcardUsed] = useState(false);
  const [wildcardUsedGameweekNumber, setWildcardUsedGameweekNumber] = useState<number | null>(null);
  const [ownedPlayerIds, setOwnedPlayerIds] = useState<number[]>([]);
  const [ownedPlayerCosts, setOwnedPlayerCosts] = useState<Map<number, number>>(new Map());
  const [transferContextReady, setTransferContextReady] = useState(false);
  const [transferSuggestions, setTransferSuggestions] = useState<TransferSuggestion[]>([]);
  const [transferSuggestionsSummary, setTransferSuggestionsSummary] = useState<TransferSuggestionSummary | null>(null);
  const [transferSuggestionsLoading, setTransferSuggestionsLoading] = useState(false);
  const [transferSuggestionsError, setTransferSuggestionsError] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [quickAddPlayer, setQuickAddPlayer] = useState<TransferPlayer | null>(null);
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
        setWildcardUsedGameweekNumber(context.wildcardUsedGameweekNumber ?? null);
        setOwnedPlayerIds(ownedIds);
        setOwnedPlayerCosts(new Map<number, number>(
          (context.ownedPlayerCosts || [])
            .filter((entry: { playerId: number; cost: number | null }) => Number.isFinite(entry.cost))
            .map((entry: { playerId: number; cost: number }) => [entry.playerId, entry.cost])
        ));

        if (ownedIds.length > 0) {
          const ownedRes = await fetchWithAuth(`/api/players?ids=${ownedIds.join(',')}&show_all=true`);
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
      } finally {
        setTransferContextReady(true);
      }
    }
    fetchContext();
  }, []);

  useEffect(() => {
    currentQuickAddPlayerId.current = quickAddPlayerId;
  }, [quickAddPlayerId]);

  const ownedPlayerIdsKey = ownedPlayerIds.join(',');

  useEffect(() => {
    if (!transferContextReady || !fantasySeasonId || ownedPlayerIds.length < SQUAD_MAX_SIZE) {
      return;
    }

    let cancelled = false;
    async function fetchSuggestions() {
      setTransferSuggestionsLoading(true);
      setTransferSuggestionsError(null);
      try {
        const response = await fetchWithAuth('/api/fantasy/transfer-suggestions');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load transfer suggestions.');
        if (
          !Array.isArray(data.recommendations) ||
          typeof data.status !== 'string' ||
          !Number.isInteger(data.completed_gameweeks) ||
          !Number.isInteger(data.required_gameweeks) ||
          !Number.isInteger(data.priced_role_matched_candidates)
        ) {
          throw new Error('Transfer suggestions were returned in an unexpected format.');
        }
        if (!cancelled) {
          setTransferSuggestions(data.recommendations as TransferSuggestion[]);
          setTransferSuggestionsSummary({
            status: data.status,
            completed_gameweeks: data.completed_gameweeks,
            required_gameweeks: data.required_gameweeks,
            priced_role_matched_candidates: data.priced_role_matched_candidates,
          });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setTransferSuggestionsError(err instanceof Error ? err.message : 'Failed to load transfer suggestions.');
          setSuggestionsOpen(true);
        }
      } finally {
        if (!cancelled) setTransferSuggestionsLoading(false);
      }
    }
    void fetchSuggestions();

    return () => {
      cancelled = true;
    };
  }, [fantasySeasonId, ownedPlayerIds.length, ownedPlayerIdsKey, transferContextReady]);

  useEffect(() => {
    if (!Number.isInteger(quickAddPlayerId) || !quickAddPlayerId || quickAddPlayerId <= 0) {
      lastHandledQuickAddPlayerId.current = null;
      return;
    }
    if (!transferContextReady || lastHandledQuickAddPlayerId.current === quickAddPlayerId) return;

    const playerId = quickAddPlayerId;
    lastHandledQuickAddPlayerId.current = playerId;

    async function selectQuickAddPlayer() {
      try {
        if (!fantasySeasonId) {
          throw new Error('Create a fantasy team before selecting players for your squad.');
        }
        if (ownedPlayerIds.includes(playerId)) {
          toast.info('Already in squad', 'This player is already part of your squad.');
          return;
        }

        const response = await fetchWithAuth(`/api/players?ids=${playerId}&show_all=true`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load the selected player.');
        const player = (data.data as TransferPlayer[] | undefined)?.find((item) => item.id === playerId);
        if (!player) throw new Error('This player could not be found in the transfer market.');
        if (player.availability_status?.toLowerCase() !== 'available') {
          throw new Error('This player is currently unavailable for selection.');
        }
        if (currentQuickAddPlayerId.current !== playerId) return;

        setQuickAddPlayer(player);

        if (ownedPlayerIds.length < SQUAD_MAX_SIZE) {
          if (ownedPlayerIds.length + buildingSelections.size >= SQUAD_MAX_SIZE) {
            toast.info('Squad full', 'Remove a selected player before adding another.');
            return;
          }
          setBuildingSelections((current) => new Map(current).set(player.id, player));
          toast.success('Player selected', `${player.in_game_name || player.name} is ready to add to your squad.`);
        } else {
          setSelectedPlayerIn(player.id);
          toast.info('Player selected', 'Choose a player from your squad to sell, then confirm the transfer.');
        }
      } catch (err: unknown) {
        if (currentQuickAddPlayerId.current === playerId) {
          toast.error('Unable to select player', err instanceof Error ? err.message : 'Please try again.');
        }
      }
    }

    void selectQuickAddPlayer();
  }, [buildingSelections.size, fantasySeasonId, ownedPlayerIds, quickAddPlayerId, toast, transferContextReady]);

  // 2. Fetch paginated players with debounce
  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        const queryParams = new URLSearchParams({
          limit: pageSize.toString(),
          offset: ((page - 1) * pageSize).toString(),
          sort: sortBy,
          desc: sortDesc ? 'true' : 'false',
        });
        if (search.trim()) queryParams.set('search', search.trim());
        if (roleFilter) queryParams.set('role', roleFilter);

        const playersRes = await fetchWithAuth(`/api/players?${queryParams.toString()}`);
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
  }, [search, roleFilter, page, sortBy, sortDesc]);

  const openPlayerModal = async (playerSummary: TransferPlayer) => {
    setModalPlayer(playerSummary);
    setModalLoading(true);
    try {
      const res = await fetchWithAuth(`/api/players/${playerSummary.id}`);
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

  // Support and Hard Support are grouped together since pro data doesn't always
  // distinguish Pos 4 from Pos 5 — matches the API's .in() filter behaviour.
  const roleMatches = (playerRole: string | null | undefined, filter: string): boolean => {
    if (!filter) return true;
    if (!playerRole) return false;
    const supportGroup = ['Support', 'Hard Support'];
    if (supportGroup.includes(filter)) return supportGroup.includes(playerRole);
    return playerRole === filter;
  };

  const filteredPlayers = players.filter((p) => {
    if (search && !(p.in_game_name || p.name || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && !roleMatches(p.primary_role, roleFilter)) return false;
    const isOwned = ownedPlayerIds.includes(p.id);
    if (ownershipFilter === 'owned' && !isOwned) return false;
    if (ownershipFilter === 'available' && isOwned) return false;
    return true;
  });

  // Keep a quick-added selection visible above the owned-squad pin and paginated market results.
  const displayedPlayers = (() => {
    const pinnedSelection = quickAddPlayer && (
      buildingSelections.has(quickAddPlayer.id) || selectedPlayerIn === quickAddPlayer.id
    ) ? quickAddPlayer : null;
    const availablePlayers = filteredPlayers.filter((player) => player.id !== pinnedSelection?.id);

    // Get all owned players from our map that match search and role filters
    const matchingOwnedSquad: TransferPlayer[] = [];
    if (pinOwnedFirst && ownershipFilter !== 'available') {
      ownedPlayersMap.forEach((p) => {
        if (search && !(p.in_game_name || p.name || '').toLowerCase().includes(search.toLowerCase())) return;
        if (roleFilter && !roleMatches(p.primary_role, roleFilter)) return;
        matchingOwnedSquad.push(p);
      });
    }

    const ownedIdSet = new Set(matchingOwnedSquad.map((p) => p.id));
    const marketPlayers = pinOwnedFirst && ownershipFilter !== 'available'
      ? availablePlayers.filter((p) => !ownedIdSet.has(p.id) && !ownedPlayerIds.includes(p.id))
      : availablePlayers;

    return [...(pinnedSelection ? [pinnedSelection] : []), ...matchingOwnedSquad, ...marketPlayers];
  })();

  // Normalise player role for squad slot purposes:
  // 'Hard Support' and 'Support' both map to the 'Support' slot since the DB
  // stores support players under either label interchangeably.
  const normaliseSlotRole = (role?: string | null): StarterRole | '' => {
    if (!role) return '';
    if (role === 'Hard Support') return 'Support';
    return role as StarterRole;
  };

  const selectedPlayerInDetails = players.find((player) => player.id === selectedPlayerIn) ||
    (quickAddPlayer?.id === selectedPlayerIn ? quickAddPlayer : undefined);
  const selectedPlayerOutDetails = players.find((player) => player.id === selectedPlayerOut) || (selectedPlayerOut ? ownedPlayersMap.get(selectedPlayerOut) : null);
  const rolesMatch = Boolean(
    selectedPlayerInDetails &&
    selectedPlayerOutDetails &&
    normaliseSlotRole(selectedPlayerInDetails.primary_role) === normaliseSlotRole(selectedPlayerOutDetails.primary_role)
  );
  const outgoingPlayerCost = selectedPlayerOut !== null ? ownedPlayerCosts.get(selectedPlayerOut) : undefined;
  const incomingPlayerPrice = selectedPlayerInDetails?.current_price;
  const selectedTransferBudgetAfter =
    budget !== null &&
    outgoingPlayerCost !== undefined &&
    incomingPlayerPrice !== null &&
    incomingPlayerPrice !== undefined &&
    Number.isFinite(incomingPlayerPrice)
      ? budget + outgoingPlayerCost - incomingPlayerPrice
      : null;
  const outgoingRecentForm = selectedPlayerOutDetails?.recent_points;
  const incomingRecentForm = selectedPlayerInDetails?.recent_points;
  const selectedRecentFormDelta =
    typeof outgoingRecentForm === 'number' &&
    Number.isFinite(outgoingRecentForm) &&
    typeof incomingRecentForm === 'number' &&
    Number.isFinite(incomingRecentForm)
      ? incomingRecentForm - outgoingRecentForm
      : null;

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

  // Derive role slots from both already-owned squad players AND building selections.
  // Owned players take precedence in starter slots.
  // Support-type players ('Support' or 'Hard Support') can fill EITHER the Support OR
  // Hard Support starter slot — first selected fills Support, second fills Hard Support.
  type SlotEntry = { player: TransferPlayer; isOwned: boolean };
  const selectedRolesFilled = new Map<StarterRole, SlotEntry>(); // slot -> player
  const benchSelections: SlotEntry[] = [];
  const SUPPORT_GROUP: StarterRole[] = ['Support', 'Hard Support'];

  // 1. First assign already owned players from the squad
  const allSquadCandidates: SlotEntry[] = [
    ...ownedPlayerIds.map((id) => {
      const p = ownedPlayersMap.get(id) || players.find((x) => x.id === id);
      return p ? { player: p, isOwned: true } : null;
    }).filter((x): x is SlotEntry => x !== null),
    ...[...buildingSelections.values()].map((p) => ({ player: p, isOwned: false })),
  ];

  for (const entry of allSquadCandidates) {
    const rawRole = entry.player.primary_role as StarterRole | undefined;
    const isSupportType = rawRole && SUPPORT_GROUP.includes(rawRole);

    if (isSupportType) {
      if (!selectedRolesFilled.has('Support')) {
        selectedRolesFilled.set('Support', entry);
      } else if (!selectedRolesFilled.has('Hard Support')) {
        selectedRolesFilled.set('Hard Support', entry);
      } else {
        benchSelections.push(entry);
      }
    } else if (rawRole && STARTER_ROLES.includes(rawRole) && !selectedRolesFilled.has(rawRole)) {
      selectedRolesFilled.set(rawRole, entry);
    } else {
      benchSelections.push(entry);
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fantasy:stats-updated'));
      }
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
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fantasy:stats-updated'));
      }
      const playerInName = players.find((p) => p.id === selectedPlayerIn)?.in_game_name || 'The player';
      toast.success('Transfer Complete', `${playerInName} is now in your squad.`);
    } catch (err) {
      toast.error('Transfer Failed', err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setActionLoading(false);
    }
  };

  const selectSuggestedTransfer = async (suggestion: TransferSuggestion) => {
    setActionLoading(true);
    try {
      const response = await fetchWithAuth(
        `/api/players?ids=${suggestion.player_out_id},${suggestion.player_in_id}&show_all=true`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load the suggested players.');
      const matchingPlayers = (data.data as TransferPlayer[] | undefined) ?? [];
      const outgoing = matchingPlayers.find((player) => player.id === suggestion.player_out_id);
      const incoming = matchingPlayers.find((player) => player.id === suggestion.player_in_id);
      if (!outgoing || !incoming) throw new Error('A suggested player is no longer available.');
      if (incoming.availability_status?.toLowerCase() !== 'available') {
        throw new Error('The suggested replacement is no longer available.');
      }

      setOwnedPlayersMap((current) => new Map(current).set(outgoing.id, outgoing));
      setQuickAddPlayer(incoming);
      setPlayers((current) => [
        ...current.filter((player) => player.id !== incoming.id),
        incoming,
      ]);
      setSelectedPlayerOut(outgoing.id);
      setSelectedPlayerIn(incoming.id);
      setSearch('');
      setRoleFilter('');
      setOwnershipFilter('all');
      setPage(1);
      toast.info('Suggested swap selected', 'Review the transfer details before confirming.');
    } catch (err: unknown) {
      toast.error('Unable to select suggestion', err instanceof Error ? err.message : 'Please try again.');
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
      setWildcardUsedGameweekNumber(
        Number.isInteger(data.gameweekNumber) ? data.gameweekNumber : null,
      );
      setFreeTransfers(99);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fantasy:stats-updated'));
      }
      toast.success('Wildcard Played', 'Unlimited free transfers are now active.');
    } catch (err) {
      toast.error('Wildcard Failed', err instanceof Error ? err.message : 'Wildcard activation failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ArrowLeftRight className="w-8 h-8 text-amber-400 shrink-0" />
              <span>Transfer Market</span>
            </h1>
            <DataFreshnessBadge page="transfers" />
          </div>
          <p className="text-slate-400">Click any player to inspect full stats, form, and match performance history</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 flex items-center gap-4 shadow-sm">
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase">Bank</div>
            {budget === null
              ? <div className="h-6 w-16 animate-pulse rounded bg-slate-700 mt-0.5" />
              : <div className="text-lg font-mono font-bold text-emerald-400">${(budget).toFixed(1)}M</div>
            }
          </div>
          <div className="w-px h-8 bg-slate-700"></div>
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase">Free Transfers</div>
            <div className="text-lg font-bold text-white">{freeTransfers}</div>
          </div>
        </div>
      </div>

      {/* Wildcard Alert Banner */}
      {!wildcardUsed ? (
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-amber-500/40 bg-linear-to-r from-amber-500/15 via-amber-500/10 to-transparent p-4 shadow-sm backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-400">Wildcard Chip Available</h3>
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300 border border-amber-500/30">
                  Ready
                </span>
              </div>
              <p className="text-xs text-slate-300">
                You can play your season Wildcard this gameweek to make unlimited free transfers with zero point deductions.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={actionLoading}
            onClick={activateWildcard}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors shadow-md disabled:opacity-50"
          >
            <Zap className="h-3.5 w-3.5 fill-current" />
            Play Wildcard
          </button>
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <p className="font-semibold text-slate-200">
                {wildcardUsedGameweekNumber !== null
                  ? `Wildcard used in Gameweek ${wildcardUsedGameweekNumber}.`
                  : 'Wildcard has been used this season.'}
              </p>
              <p className="mt-1 text-slate-400">
                Wildcard is available once per season. You will have a new Wildcard when you join the next season.
                Standard transfer allowances apply now.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Used</span>
        </div>
      )}

      <TransferMarketFilters
        search={search}
        roleFilter={roleFilter}
        ownershipFilter={ownershipFilter}
        sortBy={sortBy}
        sortDesc={sortDesc}
        pinOwnedFirst={pinOwnedFirst}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onRoleChange={(value) => {
          setRoleFilter(value);
          setPage(1);
        }}
        onOwnershipChange={(value) => {
          setOwnershipFilter(value);
          setPage(1);
        }}
        onSortChange={(value) => {
          if (sortBy === value) setSortDesc((previous) => !previous);
          else {
            setSortBy(value);
            setSortDesc(value !== 'name');
          }
          setPage(1);
        }}
        onTogglePinOwnedFirst={() => setPinOwnedFirst((previous) => !previous)}
        onClear={() => {
          setSearch('');
          setRoleFilter('');
          setOwnershipFilter('all');
          setPage(1);
        }}
      />

      <DifferentialScoutPanel selectedPlayerInId={selectedPlayerIn} onSelectPlayerIn={(id) => setSelectedPlayerIn(id)} />

      {ownedPlayerIds.length >= SQUAD_MAX_SIZE && fantasySeasonId ? (
        <TransferSuggestionsPanel
          suggestions={transferSuggestions}
          summary={transferSuggestionsSummary}
          loading={transferSuggestionsLoading}
          error={transferSuggestionsError}
          actionLoading={actionLoading}
          isOpen={suggestionsOpen}
          onToggle={() => setSuggestionsOpen((open) => !open)}
          onSelect={(suggestion) => void selectSuggestedTransfer(suggestion)}
        />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Squad actions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="wildcard-card bg-amber-900/20 border border-amber-700/50 rounded-xl p-5">
            <h3 className="wildcard-card-title font-semibold text-amber-500 mb-2 text-sm">Wildcard Available</h3>
            <p className="wildcard-card-description text-xs text-amber-200/70 mb-3">{wildcardUsed ? 'Wildcard already used this season.' : 'Play it to make unlimited transfers this week with no point deductions.'}</p>
            <button disabled={wildcardUsed || actionLoading} onClick={activateWildcard} className="wildcard-card-action w-full bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/50 text-amber-500 text-xs font-bold py-2 rounded-lg transition-colors disabled:opacity-50">
              {wildcardUsed ? 'Wildcard Used' : 'Play Wildcard'}
            </button>
          </div>

          {!isBuilding && ownedPlayerIds.length > 0 && (
            <section className="rounded-xl border border-emerald-500/35 bg-[var(--surface)] p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Your Squad</h3>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">Select a player to choose them for a transfer out.</p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {ownedPlayerIds.length}/{SQUAD_MAX_SIZE}
                </span>
              </div>
              <ul className="space-y-1.5">
                {ownedPlayerIds.map((playerId) => {
                  const player = ownedPlayersMap.get(playerId) || players.find((entry) => entry.id === playerId);
                  const selected = selectedPlayerOut === playerId;
                  return (
                    <li key={playerId}>
                      <button
                        type="button"
                        disabled={!player || actionLoading}
                        onClick={() => setSelectedPlayerOut(selected ? null : playerId)}
                        aria-pressed={selected}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${
                          selected
                            ? 'border-rose-500/50 bg-rose-500/10'
                            : 'border-[var(--border)] bg-[var(--surface-raised)] hover:border-emerald-500/40'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-[var(--text-primary)]">
                            {player ? player.in_game_name || player.name : 'Loading player…'}
                          </span>
                          <span className="block truncate text-[10px] text-[var(--text-muted)]">
                            {player?.primary_role || 'Role unavailable'}
                          </span>
                        </span>
                        <span className={`shrink-0 text-[10px] font-bold ${selected ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                          {selected ? 'Selected out' : 'Owned'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

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
                  const entry = selectedRolesFilled.get(role);
                  const p = entry?.player;
                  const isOwned = entry?.isOwned;
                  // Label the Support slot to hint it accepts Pos 4 & 5 players
                  const label = role === 'Support' ? 'Support (Pos 4)' : role === 'Hard Support' ? 'Hard Support (Pos 5)' : role;
                  return (
                    <div key={role} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                      p ? 'bg-emerald-900/30 border border-emerald-700/50' : 'bg-slate-700/30 border border-slate-600/40'
                    }`}>
                      <span className={`font-semibold uppercase tracking-wider ${p ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {label}
                      </span>
                      {p ? (
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{p.in_game_name || p.name}</span>
                          {isOwned ? (
                            <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                              Owned
                            </span>
                          ) : (
                            <button
                              onClick={() => setBuildingSelections((prev) => { const next = new Map(prev); next.delete(p.id); return next; })}
                              className="text-slate-400 hover:text-red-400 transition-colors"
                            >✕</button>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Needed</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Support slot explainer */}
              <div className="flex items-start gap-1.5 bg-slate-700/20 border border-slate-600/30 rounded-lg px-3 py-2 mb-3">
                <span className="text-amber-400/70 text-xs mt-0.5 shrink-0">ℹ️</span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <span className="text-slate-300 font-medium">Support slots:</span> Pick any support-type player for both Pos 4 &amp; Pos 5 — your 1st pick fills <span className="text-slate-200">Support (Pos 4)</span>, your 2nd fills <span className="text-slate-200">Hard Support (Pos 5)</span>.
                </p>
              </div>

              {/* Bench slots */}
              <div className="space-y-1.5 mb-4">
                {Array.from({ length: benchSlotsTotal }).map((_, i) => {
                  const entry = benchSelections[i];
                  const p = entry?.player;
                  const isOwned = entry?.isOwned;
                  return (
                    <div key={`bench-${i}`} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                      p ? 'bg-slate-700/50 border border-slate-600' : 'bg-slate-800/30 border border-slate-700/30'
                    }`}>
                      <span className="text-slate-500 font-semibold uppercase tracking-wider">Bench {i + 1}</span>
                      {p ? (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300">{p.in_game_name || p.name}</span>
                          {isOwned ? (
                            <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                              Owned
                            </span>
                          ) : (
                            <button
                              onClick={() => setBuildingSelections((prev) => { const next = new Map(prev); next.delete(p.id); return next; })}
                              className="text-slate-400 hover:text-red-400 transition-colors"
                            >✕</button>
                          )}
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
            <div id="trade-review-section" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg lg:sticky lg:top-24">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">Trade review</h4>
                {selectedPlayerInDetails && selectedPlayerOutDetails && (
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    rolesMatch
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                  }`}>
                    {rolesMatch ? 'Role match' : 'Role mismatch'}
                  </span>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-rose-500/35 bg-rose-500/5 p-3 shadow-[inset_0_1px_0_rgba(244,63,94,0.12)]">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-rose-700 dark:text-rose-300">Player out</p>
                  {selectedPlayerOutDetails ? (
                    <>
                      <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                        {selectedPlayerOutDetails.in_game_name || selectedPlayerOutDetails.name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {selectedPlayerOutDetails.primary_role || 'Role unknown'}
                      </p>
                      <div className="mt-3 flex justify-between gap-2 text-xs">
                        <span className="text-[var(--text-muted)]">Acquisition cost</span>
                        <span className="font-mono font-semibold text-[var(--text-primary)]">
                          {outgoingPlayerCost !== undefined ? `$${outgoingPlayerCost.toFixed(1)}M` : 'Unavailable'}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between gap-2 text-xs">
                        <span className="text-[var(--text-muted)]">Recent form avg.</span>
                        <span className="font-mono text-[var(--text-primary)]">
                          {typeof outgoingRecentForm === 'number' ? `${outgoingRecentForm.toFixed(2)} pts` : '—'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="py-3 text-xs text-[var(--text-muted)]">Choose a squad player to sell.</p>
                  )}
                </div>
                <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/5 p-3 shadow-[inset_0_1px_0_rgba(16,185,129,0.12)]">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Player in</p>
                  {selectedPlayerInDetails ? (
                    <>
                      <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                        {selectedPlayerInDetails.in_game_name || selectedPlayerInDetails.name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {selectedPlayerInDetails.primary_role || 'Role unknown'}
                      </p>
                      <div className="mt-3 flex justify-between gap-2 text-xs">
                        <span className="text-[var(--text-muted)]">Market price</span>
                        <span className="font-mono font-semibold text-[var(--text-primary)]">
                          {typeof incomingPlayerPrice === 'number' ? `$${incomingPlayerPrice.toFixed(1)}M` : 'Unavailable'}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between gap-2 text-xs">
                        <span className="text-[var(--text-muted)]">Recent form avg.</span>
                        <span className="font-mono text-[var(--text-primary)]">
                          {typeof incomingRecentForm === 'number' ? `${incomingRecentForm.toFixed(2)} pts` : '—'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="py-3 text-xs text-[var(--text-muted)]">Choose a player to buy.</p>
                  )}
                </div>
              </div>
              <div className="mt-3 grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Estimated bank after</p>
                  <p className="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]">
                    {selectedTransferBudgetAfter !== null ? `$${selectedTransferBudgetAfter.toFixed(1)}M` : '—'}
                  </p>
                  <p className="text-[10px] leading-4 text-[var(--text-muted)]">
                    Uses the recorded outgoing cost and incoming market price; the server confirms the final balance.
                  </p>
                </div>
                <div className="sm:border-l sm:border-[var(--border)] sm:pl-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Recent-form difference</p>
                  <p className={`mt-1 font-mono text-lg font-bold ${
                    selectedRecentFormDelta === null
                      ? 'text-[var(--text-primary)]'
                      : selectedRecentFormDelta >= 0
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                  }`}>
                    {selectedRecentFormDelta === null
                      ? '—'
                      : `${selectedRecentFormDelta > 0 ? '+' : ''}${selectedRecentFormDelta.toFixed(2)} pts`}
                  </p>
                  <p className="text-[10px] leading-4 text-[var(--text-muted)]">
                    Difference between recent scoring averages, not a projected gameweek score.
                  </p>
                </div>
              </div>
              {selectedPlayerIn !== null && selectedPlayerOut !== null && !rolesMatch && (
                <p className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
                  Transfers must be role-for-role. Select a {selectedPlayerOutDetails?.primary_role || 'matching'} to buy.
                </p>
              )}
              <button
                data-tour="transfers-action"
                disabled={actionLoading || selectedPlayerIn === null || selectedPlayerOut === null || !rolesMatch}
                onClick={submitTransfer}
                className="mt-4 w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-emerald-500 disabled:opacity-50"
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

          {/* Market table */}
          <div ref={tableContainerRef} data-tour="transfers-table" className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left border-collapse xl:table-auto">
                <thead>
                  <tr className="bg-slate-800/90 border-b border-slate-700">
                    <th
                      scope="col"
                      onClick={() => {
                        if (sortBy === 'name') setSortDesc((prev) => !prev);
                        else { setSortBy('name'); setSortDesc(false); }
                        setPage(1);
                      }}
                      className="w-[46%] px-3 py-3 text-xs font-semibold text-slate-100 uppercase tracking-wider cursor-pointer hover:text-amber-400 transition-colors select-none xl:w-auto xl:px-4"
                    >
                      <div className="flex items-center gap-1">
                        <span>Player</span>
                        {sortBy === 'name' && (
                          sortDesc ? <ArrowDown className="h-3 w-3 text-amber-400" /> : <ArrowUp className="h-3 w-3 text-amber-400" />
                        )}
                      </div>
                    </th>
                    <th scope="col" className="hidden px-4 py-3 text-xs font-semibold text-slate-100 uppercase tracking-wider text-center xl:table-cell">Role</th>
                    <th
                      scope="col"
                      onClick={() => {
                        if (sortBy === 'price') setSortDesc((prev) => !prev);
                        else { setSortBy('price'); setSortDesc(true); }
                        setPage(1);
                      }}
                      className="w-[28%] px-3 py-3 text-xs font-semibold text-slate-100 uppercase tracking-wider text-right cursor-pointer hover:text-amber-400 transition-colors select-none xl:w-auto xl:px-4"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Price</span>
                        {sortBy === 'price' && (
                          sortDesc ? <ArrowDown className="h-3 w-3 text-amber-400" /> : <ArrowUp className="h-3 w-3 text-amber-400" />
                        )}
                      </div>
                    </th>
                    <th
                      scope="col"
                      onClick={() => {
                        if (sortBy === 'points') setSortDesc((prev) => !prev);
                        else { setSortBy('points'); setSortDesc(true); }
                        setPage(1);
                      }}
                      className="hidden px-4 py-3 text-xs font-semibold text-slate-100 uppercase tracking-wider text-right cursor-pointer hover:text-amber-400 transition-colors select-none xl:table-cell"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Form (Avg)</span>
                        {sortBy === 'points' && (
                          sortDesc ? <ArrowDown className="h-3 w-3 text-amber-400" /> : <ArrowUp className="h-3 w-3 text-amber-400" />
                        )}
                      </div>
                    </th>
                    <th
                      scope="col"
                      onClick={() => {
                        if (sortBy === 'ownership') setSortDesc((prev) => !prev);
                        else { setSortBy('ownership'); setSortDesc(true); }
                        setPage(1);
                      }}
                      className="hidden px-4 py-3 text-xs font-semibold text-slate-100 uppercase tracking-wider text-right cursor-pointer hover:text-amber-400 transition-colors select-none xl:table-cell"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Own %</span>
                        {sortBy === 'ownership' && (
                          sortDesc ? <ArrowDown className="h-3 w-3 text-amber-400" /> : <ArrowUp className="h-3 w-3 text-amber-400" />
                        )}
                      </div>
                    </th>
                    <th scope="col" className="hidden px-4 py-3 text-xs font-semibold text-slate-100 uppercase tracking-wider text-right xl:table-cell">Last GW</th>
                    <th scope="col" className="w-[26%] px-3 py-3 text-xs font-semibold text-slate-100 uppercase tracking-wider text-center xl:w-auto xl:px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {loading ? (
                    [1, 2, 3, 4, 5, 6].map((row) => (
                      <tr key={`transfer-skeleton-${row}`} className="animate-pulse">
                        <td className="px-3 py-3 xl:px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 shrink-0 rounded-full bg-slate-700 xl:h-10 xl:w-10" />
                            <div className="space-y-2">
                              <div className="h-4 w-32 max-w-[30vw] rounded bg-slate-700" />
                              <div className="h-3 w-20 rounded bg-slate-800" />
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 xl:table-cell"><div className="mx-auto h-6 w-16 rounded-full bg-slate-700" /></td>
                        <td className="px-3 py-3 xl:px-4"><div className="ml-auto h-4 w-16 rounded bg-slate-700" /></td>
                        <td className="hidden px-4 py-3 xl:table-cell"><div className="ml-auto h-4 w-12 rounded bg-slate-700" /></td>
                        <td className="hidden px-4 py-3 xl:table-cell"><div className="ml-auto h-4 w-12 rounded bg-slate-700" /></td>
                        <td className="hidden px-4 py-3 xl:table-cell"><div className="ml-auto h-4 w-12 rounded bg-slate-700" /></td>
                        <td className="px-3 py-3 xl:px-4"><div className="mx-auto h-8 w-8 rounded-lg bg-slate-700 xl:h-8 xl:w-20" /></td>
                      </tr>
                    ))
                  ) : displayedPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No players found matching your criteria.</td>
                    </tr>
                  ) : (
                    displayedPlayers.map((player, index) => {
                      const isOwned = ownedPlayerIds.includes(player.id);
                      const isSelected = buildingSelections.has(player.id) || selectedPlayerIn === player.id;
                      const priceChange = typeof player.price_change === 'number' ? player.price_change : null;
                      const roleAccent = ROLE_ACCENTS[player.primary_role || ''] || 'var(--border)';
                      return (
                        <tr
                          key={player.id}
                          onClick={() => openPlayerModal(player)}
                          style={{
                            borderLeftColor: roleAccent,
                            boxShadow: `inset 3px 0 8px -4px color-mix(in srgb, ${roleAccent} 75%, transparent)`,
                            animationDelay: `${Math.min(index, 12) * 65}ms`,
                          }}
                          className={`animate-stagger-item group cursor-pointer border-l-[3px] transition-colors ${
                            isSelected
                              ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-400/60'
                              : isOwned
                                ? 'bg-emerald-950/20 hover:bg-emerald-950/35'
                                : 'hover:bg-slate-800/60'
                          }`}
                        >
                          <td className="px-3 py-3 xl:px-4">
                            <div className="flex items-center gap-2 xl:gap-3">
                              <div className={`h-9 w-9 xl:h-10 xl:w-10 rounded-full border overflow-hidden shrink-0 flex items-center justify-center ${
                                isOwned ? 'bg-slate-800 border-emerald-500/50' : 'bg-slate-700 border-slate-600'
                              }`}>
                                {player.profile_image_url ? (
                                  <Image src={player.profile_image_url} alt={player.in_game_name || player.name} width={40} height={40} unoptimized={!canOptimizeImage(player.profile_image_url)} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="player-avatar-initials text-xs font-bold">
                                    {(player.in_game_name || player.name || '').substring(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-1.5 font-bold text-slate-900 transition-colors group-hover:text-amber-600 dark:text-slate-100 dark:group-hover:text-amber-400">
                                  <span className="min-w-0 truncate" title={player.in_game_name || player.name}>
                                    {player.in_game_name || player.name}
                                  </span>
                                  {isOwned && (
                                    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                                      In Squad
                                    </span>
                                  )}
                                  {isSelected && (
                                    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                                      Selected
                                    </span>
                                  )}
                                </div>
                                <div className="truncate text-xs text-slate-500 dark:text-slate-400">{player.professional_teams?.name || 'Free Agent'}</div>
                                <span
                                  className="transfer-role-badge mt-1 inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase xl:hidden"
                                  style={{
                                    color: roleAccent,
                                    borderColor: roleAccent,
                                    backgroundColor: `color-mix(in srgb, ${roleAccent} 12%, transparent)`,
                                  }}
                                >
                                  {player.primary_role || 'Flexible'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-center xl:table-cell">
                            <span
                              className="transfer-role-badge inline-block rounded border px-2 py-1 text-[10px] font-bold uppercase"
                              style={{
                                color: roleAccent,
                                borderColor: roleAccent,
                                backgroundColor: `color-mix(in srgb, ${roleAccent} 12%, transparent)`,
                              }}
                            >
                              {player.primary_role || 'Flexible'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right xl:px-4">
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs font-mono font-bold text-amber-400 xl:text-base">${player.current_price}M</span>
                              <div className="hidden items-center gap-1.5 xl:flex">
                                <PriceSparkline data={player.price_history} width={48} height={14} themeAware />
                                {priceChange !== null && priceChange !== 0 ? (
                                  <span
                                    title={`Price ${priceChange > 0 ? 'increased' : 'decreased'} by $${Math.abs(priceChange).toFixed(1)}M`}
                                    className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                                    priceChange > 0
                                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                      : 'border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300'
                                  }`}>
                                    {priceChange > 0 ? (
                                      <>
                                        <TrendingUp className="h-2.5 w-2.5 shrink-0" />
                                        +${Math.abs(priceChange).toFixed(1)}M
                                      </>
                                    ) : (
                                      <>
                                        <TrendingDown className="h-2.5 w-2.5 shrink-0" />
                                        -${Math.abs(priceChange).toFixed(1)}M
                                      </>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono text-slate-500">—</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-right xl:table-cell">
                            <div className="transfer-form-average text-sm text-slate-800 dark:text-slate-200 font-mono">{player.recent_points ?? '-'}</div>
                          </td>
                          <td className="hidden px-4 py-3 text-right xl:table-cell">
                            <div className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                              {player.ownership_percentage != null ? `${Number(player.ownership_percentage).toFixed(1)}%` : '—'}
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-right xl:table-cell">
                            <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">{player.gameweek_points ?? '-'}</div>
                          </td>
                          <td className="px-3 py-3 text-center xl:px-4" onClick={(e) => e.stopPropagation()}>
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
                                isSelected ? 'Click to deselect' :
                                isBuilding && spotsRemaining <= 0 ? 'Squad full' :
                                isBuilding ? 'Click to select' : 'Select to buy'
                              }
                            >
                              {isOwned ? (
                                <Minus className="w-4 h-4" />
                              ) : isSelected ? (
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
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    tableContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
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
                  onClick={() => {
                    setPage((p) => p + 1);
                    tableContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalPlayer && (
        <TransferPlayerDetailsModal
          player={modalPlayer}
          loading={modalLoading}
          owned={ownedPlayerIds.includes(modalPlayer.id)}
          onClose={() => setModalPlayer(null)}
          onSelect={() => {
            handlePlayerAction(modalPlayer.id);
            setModalPlayer(null);
          }}
        />
      )}
    </div>
  );
}

export default function TransfersPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12 text-center text-sm text-slate-400" role="status">
          Loading Transfer Market…
        </div>
      }
    >
      <TransfersPageContent />
    </Suspense>
  );
}
