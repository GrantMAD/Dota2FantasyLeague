'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  ArrowDown,
  ArrowUp,
  Users,
  CheckCircle2,
  ShieldCheck,
  Search,
  ChevronDown,
  X,
  Shield,
  Swords,
  Crosshair,
  Star,
  HelpCircle,
  Plus,
} from 'lucide-react';
import { fetchWithAuth, getAuthSession } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';
import { canOptimizeImage } from '@/lib/optimized-image';
import type { PlayersCatalogResponse } from '@/lib/players-catalog';

interface ProfessionalTeam {
  id: number;
  name: string;
  logo_url: string | null;
}

interface Player {
  id: number;
  name: string;
  in_game_name: string | null;
  profile_image_url?: string | null;
  primary_role: string;
  current_price: number;
  price_change?: number | null;
  ownership_percentage?: number | null;
  professional_teams?: { name: string; logo_url: string | null } | null;
  availability_status: string;
}

const ROLES = [
  { value: 'Carry',        label: 'Carry',        icon: Swords,    color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30'    },
  { value: 'Mid',          label: 'Mid',           icon: Crosshair, color: 'text-amber-400',  bg: 'bg-amber-400/10',  border: 'border-amber-400/30'  },
  { value: 'Offlane',      label: 'Offlane',       icon: Shield,    color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30'  },
  { value: 'Support',      label: 'Support',       icon: Star,      color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/30'   },
  { value: 'Hard Support', label: 'Hard Support',  icon: HelpCircle,color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' },
];

const getRoleBadgeClass = (role: string) => {
  switch (role) {
    case 'Carry':        return 'text-red-400 bg-red-400/10 border-red-400/20';
    case 'Mid':          return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    case 'Offlane':      return 'text-green-400 bg-green-400/10 border-green-400/20';
    case 'Support':      return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    case 'Hard Support': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
    default:             return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
  }
};

const formatPrice = (price: number) => `$${Number(price ?? 0).toFixed(1)}M`;

const getOwnershipClassification = (ownership: number | null | undefined) => {
  if (ownership == null) return { label: 'Unranked', color: 'text-slate-400', bg: 'bg-slate-800/80', border: 'border-slate-700/60' };
  const val = Number(ownership);
  if (val >= 35) return { label: 'Meta Pick', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  if (val >= 15) return { label: 'Popular', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' };
  return { label: 'Differential', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
};

const getAvailabilityBadgeStyle = (status: string | null | undefined): React.CSSProperties => {
  const normalizedStatus = status?.toLowerCase();
  const color = !normalizedStatus
    ? 'var(--text-muted)'
    : normalizedStatus === 'available' || normalizedStatus === 'active'
      ? 'var(--success)'
      : 'var(--danger)';

  return {
    color,
    borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Team dropdown component
// ──────────────────────────────────────────────────────────────────────────────
interface TeamDropdownProps {
  teams: ProfessionalTeam[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
  brokenTeamLogos: Set<number>;
  onTeamLogoError: (id: number) => void;
}

function TeamDropdown({ teams, selectedId, onChange, brokenTeamLogos, onTeamLogoError }: TeamDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const selected = teams.find((t) => t.id === selectedId);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all focus:outline-hidden focus:ring-1 focus:ring-amber-500/50 ${
          selectedId
            ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300'
            : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-amber-500/40 hover:text-[var(--text-primary)]'
        }`}
      >
        {selected ? (
          <>
            {selected.logo_url && !brokenTeamLogos.has(selected.id) ? (
              <Image
                src={selected.logo_url}
                alt={selected.name}
                width={16}
                height={16}
                className="h-4 w-4 rounded-sm object-contain shrink-0"
                onError={() => onTeamLogoError(selected.id)}
              />
            ) : (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[var(--surface-muted)] text-[7px] font-bold text-[var(--text-secondary)]">
                {selected.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="truncate max-w-32.5">{selected.name}</span>
          </>
        ) : (
          <>
            <Shield className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
            <span>All Teams</span>
          </>
        )}
        <ChevronDown className={`ml-auto w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 max-h-72 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl backdrop-blur-md">
          {/* All option */}
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm transition-colors hover:bg-[var(--surface-raised)] ${
              !selectedId ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-[var(--text-secondary)]'
            }`}
          >
            <Shield className="w-4 h-4 text-[var(--text-muted)]" />
            All Teams
          </button>
          <div className="border-t border-[var(--border)] my-0.5" />
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => { onChange(team.id); setOpen(false); }}
              className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm transition-colors hover:bg-[var(--surface-raised)] ${
                selectedId === team.id ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {team.logo_url && !brokenTeamLogos.has(team.id) ? (
                <Image
                  src={team.logo_url}
                  alt={team.name}
                  width={16}
                  height={16}
                  className="h-4 w-4 rounded-sm object-contain shrink-0"
                  onError={() => onTeamLogoError(team.id)}
                />
              ) : (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-slate-700 text-[7px] font-bold text-slate-300">
                  {team.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="truncate">{team.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────────────
export default function PlayersPageClient({
  initialData,
}: {
  initialData: PlayersCatalogResponse | null;
}) {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>(initialData?.data ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [loading, setLoading] = useState(initialData === null);
  const initialDataPending = useRef(initialData !== null);

  // Team list for the dropdown
  const [teams, setTeams] = useState<ProfessionalTeam[]>([]);
  const [brokenTeamLogos, setBrokenTeamLogos] = useState<Set<number>>(new Set());

  // Player logo broken tracking
  const [brokenLogos, setBrokenLogos] = useState<Set<number>>(new Set());
  const [brokenPlayerAvatars, setBrokenPlayerAvatars] = useState<Set<number>>(new Set());
  const handleLogoError = useCallback((playerId: number) => {
    setBrokenLogos((prev) => new Set(prev).add(playerId));
  }, []);
  const handleTeamLogoError = useCallback((teamId: number) => {
    setBrokenTeamLogos((prev) => new Set(prev).add(teamId));
  }, []);
  const handlePlayerAvatarError = useCallback((playerId: number) => {
    setBrokenPlayerAvatars((prev) => new Set(prev).add(playerId));
  }, []);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [teamIdFilter, setTeamIdFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'price' | 'ownership' | 'name'>('price');
  const [sortDesc, setSortDesc] = useState(true);
  const [pinOwnedFirst, setPinOwnedFirst] = useState(true);
  const [comparePlayerIds, setComparePlayerIds] = useState<number[]>([]);
  const [compareMode, setCompareMode] = useState(false);

  // Squad context
  const [ownedPlayerIds, setOwnedPlayerIds] = useState<number[]>([]);
  const [ownedPlayersMap, setOwnedPlayersMap] = useState<Map<number, Player>>(new Map());

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 20;

  // Active filter count (for the clear-all badge)
  const activeFilterCount = [roleFilter, teamIdFilter].filter(Boolean).length;

  // ── Debounce search ─────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Load teams and squad context in parallel ────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadTeamsAndSquadContext() {
      try {
        const session = await getAuthSession();
        const [teamsResult, squadResult] = await Promise.allSettled([
          fetchWithAuth('/api/teams?limit=200', {}, session),
          fetchWithAuth('/api/fantasy/transfer-context', {}, session),
        ]);
        if (cancelled) return;

        if (teamsResult.status === 'fulfilled' && teamsResult.value.ok) {
          const json = await teamsResult.value.json();
          const sorted = ((json.data as ProfessionalTeam[]) || []).sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          setTeams(sorted);
        } else {
          console.warn(
            'Unable to load player directory teams:',
            teamsResult.status === 'rejected' ? teamsResult.reason : teamsResult.value.status,
          );
        }

        if (squadResult.status === 'rejected') {
          console.warn('Unable to load player squad context:', squadResult.reason);
          return;
        }
        if (!squadResult.value.ok) {
          console.warn('Unable to load player squad context:', squadResult.value.status);
          return;
        }

        const data = await squadResult.value.json();
        const ownedIds: number[] = Array.isArray(data.ownedPlayerIds) ? data.ownedPlayerIds : [];
        setOwnedPlayerIds(ownedIds);

        if (ownedIds.length > 0) {
          const ownedRes = await fetchWithAuth(`/api/players?ids=${ownedIds.join(',')}`);
          if (!ownedRes.ok) {
            console.warn('Unable to load owned players for the directory:', ownedRes.status);
            return;
          }
          const ownedData = await ownedRes.json();
          const map = new Map<number, Player>();
          for (const player of (ownedData.data || [])) map.set(player.id, player);
          if (!cancelled) setOwnedPlayersMap(map);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Unable to load player directory team and squad context:', error);
        }
      }
    }
    void loadTeamsAndSquadContext();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Fetch players ───────────────────────────────────────────────────────────
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const isInitialDirectoryQuery = page === 1
      && debouncedSearch === ''
      && roleFilter === ''
      && teamIdFilter === null
      && sortBy === 'price'
      && sortDesc;
    if (initialDataPending.current && isInitialDirectoryQuery) {
      return () => { cancelled = true; };
    }
    if (initialDataPending.current) {
      initialDataPending.current = false;
    }

    async function loadPlayers() {
      setLoading(true);
      setError(null);
      try {
        const offset = (page - 1) * limit;
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: offset.toString(),
          sort: sortBy,
          desc: sortDesc ? 'true' : 'false',
        });
        if (debouncedSearch) params.append('search', debouncedSearch);
        if (roleFilter)      params.append('role', roleFilter);
        if (teamIdFilter)    params.append('team_id', teamIdFilter.toString());

        const res = await fetchWithAuth(`/api/players?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to fetch players (${res.status})`);
        }
        if (cancelled) return;
        const data = (await res.json()) as { data?: Player[]; total?: number };
        setPlayers(data.data || []);
        setTotal(data.total || 0);
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to fetch players';
          setError(msg);
          toast.error('Load Error', msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPlayers();
    return () => { cancelled = true; };
  }, [page, limit, debouncedSearch, roleFilter, teamIdFilter, sortBy, sortDesc, toast]);

  const totalPages = Math.ceil(total / limit);

  // ── Support grouping helper ─────────────────────────────────────────────────
  const roleMatches = (playerRole: string, filter: string): boolean => {
    if (!filter) return true;
    const supportGroup = ['Support', 'Hard Support'];
    if (supportGroup.includes(filter)) return supportGroup.includes(playerRole);
    return playerRole === filter;
  };

  // ── Pin owned squad players to top ─────────────────────────────────────────
  const displayedPlayers = (() => {
    if (!pinOwnedFirst || ownedPlayerIds.length === 0) return players;

    const matchingOwnedSquad: Player[] = [];
    ownedPlayersMap.forEach((p) => {
      if (debouncedSearch && !(p.in_game_name || p.name || '').toLowerCase().includes(debouncedSearch.toLowerCase())) return;
      if (roleFilter && !roleMatches(p.primary_role, roleFilter)) return;
      if (teamIdFilter && p.professional_teams?.name) {
        const t = teams.find((t) => t.id === teamIdFilter);
        if (t && p.professional_teams.name !== t.name) return;
      }
      matchingOwnedSquad.push(p);
    });

    const ownedIdSet = new Set(matchingOwnedSquad.map((p) => p.id));
    const nonOwned = players.filter((p) => !ownedIdSet.has(p.id) && !ownedPlayerIds.includes(p.id));
    return [...matchingOwnedSquad, ...nonOwned];
  })();

  const clearAllFilters = () => {
    setRoleFilter('');
    setTeamIdFilter(null);
    setSearch('');
    setPage(1);
  };

  const toggleComparePlayer = (playerId: number) => {
    if (comparePlayerIds.includes(playerId)) {
      setComparePlayerIds(comparePlayerIds.filter((id) => id !== playerId));
      return;
    }
    if (comparePlayerIds.length >= 4) {
      toast.info('Comparison limit', 'Choose up to four players to compare.');
      return;
    }
    setComparePlayerIds([...comparePlayerIds, playerId]);
  };

  const openComparison = () => {
    if (comparePlayerIds.length < 2) return;
    router.push(`/players/compare?ids=${comparePlayerIds.join(',')}`);
  };

  return (
    <div className={`max-w-7xl mx-auto px-4 pt-10 ${comparePlayerIds.length > 0 ? 'pb-36' : 'pb-12'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <h1 className="text-3xl font-extrabold text-[var(--text-primary)] flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500 shadow-xs">
            <Users className="w-6 h-6 shrink-0" />
          </div>
          <span>Professional Players</span>
        </h1>
        <DataFreshnessBadge page="players" />
      </div>
      <p className="text-[var(--text-secondary)] mb-8 text-sm sm:text-base">
        Browse, scout, and compare all professional Dota 2 athletes across global teams to build your ultimate fantasy squad.
      </p>

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (compareMode) setComparePlayerIds([]);
            setCompareMode(!compareMode);
          }}
          aria-pressed={compareMode}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
            compareMode
              ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
              : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-cyan-500/40 hover:text-[var(--text-primary)]'
          }`}
        >
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          {compareMode ? 'Exit Compare' : 'Compare Players'}
        </button>
      </div>

      {comparePlayerIds.length > 0 && (
        <section
          aria-label="Player comparison selection"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-7xl flex-col gap-3 rounded-2xl border border-cyan-500/40 bg-[var(--surface)] p-4.5 shadow-2xl shadow-cyan-500/10 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {comparePlayerIds.length} of 4 players selected
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Select at least two players to compare form, market valuation, availability, and upcoming fixtures.
              </p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setComparePlayerIds([])}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={openComparison}
              disabled={comparePlayerIds.length < 2}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Compare {comparePlayerIds.length} players
            </button>
          </div>
        </section>
      )}

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">

        {/* ── Filter Panel ──────────────────────────────────────────────────── */}
        <div className="p-5 border-b border-[var(--border)] bg-[var(--surface-raised)]/60 space-y-4">

          {/* Row 1: Search + Team dropdown */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative grow">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
              <input
                data-tour="players-search"
                type="text"
                placeholder="Search players by name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Team filter */}
            <div className="sm:w-56 shrink-0">
              <TeamDropdown
                teams={teams}
                selectedId={teamIdFilter}
                onChange={(id) => { setTeamIdFilter(id); setPage(1); }}
                brokenTeamLogos={brokenTeamLogos}
                onTeamLogoError={handleTeamLogoError}
              />
            </div>
          </div>

          {/* Row 2: Role pills + Squad toggle + Clear */}
          <div data-tour="players-filters" className="flex flex-wrap items-center gap-2">
            {/* Role label */}
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mr-1 shrink-0">Role:</span>

            {/* Role pill buttons */}
            {ROLES.map(({ value, label, icon: Icon, color, bg, border }) => {
              const active = roleFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setRoleFilter(active ? '' : value); setPage(1); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                    active
                      ? `${color} ${bg} ${border} shadow-xs`
                      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-slate-500'
                  }`}
                >
                  <Icon className={`w-3 h-3 ${active ? color : 'text-[var(--text-muted)]'}`} />
                  {label}
                </button>
              );
            })}

            {/* Divider */}
            <div className="h-5 w-px bg-[var(--border)] mx-1 shrink-0" />

            {/* My Squad toggle — only shown when user has a squad */}
            {ownedPlayerIds.length > 0 && (
              <button
                data-tour="players-squad-pin"
                type="button"
                onClick={() => setPinOwnedFirst((v) => !v)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all ${
                  pinOwnedFirst
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-emerald-500/30'
                }`}
              >
                <ShieldCheck className={`w-3 h-3 ${pinOwnedFirst ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-muted)]'}`} />
                My Squad at Top
              </button>
            )}

            {/* Clear all — shown when any filter active */}
            {(activeFilterCount > 0 || search) && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-secondary)] hover:border-red-500/50 hover:text-red-500 transition-all ml-auto"
              >
                <X className="w-3 h-3" />
                Clear filters
                {activeFilterCount > 0 && (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Active filter summary chips */}
          {(teamIdFilter || roleFilter) && (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {teamIdFilter && (() => {
                const t = teams.find((t) => t.id === teamIdFilter);
                return t ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs font-medium">
                    {t.logo_url && !brokenTeamLogos.has(t.id) ? (
                      <Image src={t.logo_url} alt={t.name} width={12} height={12} className="h-3 w-3 rounded-sm object-contain" onError={() => handleTeamLogoError(t.id)} />
                    ) : null}
                    {t.name}
                    <button type="button" onClick={() => { setTeamIdFilter(null); setPage(1); }} className="hover:text-[var(--text-primary)] transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              })()}
              {roleFilter && (() => {
                const r = ROLES.find((r) => r.value === roleFilter);
                return r ? (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${r.color} ${r.bg} ${r.border}`}>
                    <r.icon className={`w-3 h-3 ${r.color}`} />
                    {r.label}
                    <button type="button" onClick={() => { setRoleFilter(''); setPage(1); }} className="hover:text-[var(--text-primary)] transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              })()}
            </div>
          )}
          {/* Row 3: Sort Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Sort by:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'price', label: 'Price' },
                    { id: 'ownership', label: 'Ownership' },
                    { id: 'name', label: 'Name' },
                  ] as const
                ).map((option) => {
                  const isActive = sortBy === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          setSortDesc((prev) => !prev);
                        } else {
                          setSortBy(option.id);
                          setSortDesc(true);
                        }
                        setPage(1);
                      }}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 shadow-xs'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                      }`}
                      aria-pressed={isActive}
                    >
                      <span>{option.label}</span>
                      {isActive && (
                        sortDesc ? (
                          <ArrowDown className="h-3 w-3 text-amber-500" />
                        ) : (
                          <ArrowUp className="h-3 w-3 text-amber-500" />
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-xs text-[var(--text-muted)]">
              Sorted by <strong className="text-[var(--text-primary)] capitalize">{sortBy}</strong> ({sortDesc ? 'Descending' : 'Ascending'})
            </div>
          </div>
        </div>

        {/* ── Data Table ────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--surface-raised)] border-b border-[var(--border)] text-[var(--text-muted)] text-xs uppercase tracking-wider">
                {compareMode && <th className="px-4 py-3.5 font-bold whitespace-nowrap">Compare</th>}
                <th className="px-6 py-3.5 font-bold whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortBy === 'name') setSortDesc((prev) => !prev);
                      else { setSortBy('name'); setSortDesc(false); }
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors"
                  >
                    <span>Player</span>
                    {sortBy === 'name' && (
                      sortDesc ? <ArrowDown className="h-3.5 w-3.5 text-amber-500" /> : <ArrowUp className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3.5 font-bold whitespace-nowrap">Team</th>
                <th className="px-6 py-3.5 font-bold whitespace-nowrap">Role</th>
                <th className="px-6 py-3.5 font-bold whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortBy === 'price') setSortDesc((prev) => !prev);
                      else { setSortBy('price'); setSortDesc(true); }
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors ml-auto"
                  >
                    <span>Price</span>
                    {sortBy === 'price' && (
                      sortDesc ? <ArrowDown className="h-3.5 w-3.5 text-amber-500" /> : <ArrowUp className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3.5 font-bold whitespace-nowrap text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (sortBy === 'ownership') setSortDesc((prev) => !prev);
                      else { setSortBy('ownership'); setSortDesc(true); }
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 hover:text-amber-500 transition-colors ml-auto"
                  >
                    <span>Ownership</span>
                    {sortBy === 'ownership' && (
                      sortDesc ? <ArrowDown className="h-3.5 w-3.5 text-amber-500" /> : <ArrowUp className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3.5 font-bold whitespace-nowrap text-center">Status</th>
                <th className="px-6 py-3.5 font-bold whitespace-nowrap text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading && displayedPlayers.length === 0 ? (
                [1, 2, 3, 4, 5, 6].map((row) => (
                  <tr key={`player-skeleton-${row}`} className="animate-pulse">
                    {compareMode && <td className="px-4 py-4 text-center"><div className="mx-auto h-4 w-4 rounded bg-[var(--surface-raised)]" /></td>}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--surface-raised)]" />
                        <div className="space-y-2">
                          <div className="h-4 w-32 max-w-[30vw] rounded bg-[var(--surface-raised)]" />
                          <div className="h-3 w-20 rounded bg-[var(--surface-muted)]" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="h-4 w-24 max-w-[20vw] rounded bg-[var(--surface-raised)]" /></td>
                    <td className="px-6 py-4"><div className="h-6 w-16 rounded-full bg-[var(--surface-raised)]" /></td>
                    <td className="px-6 py-4"><div className="ml-auto h-4 w-14 rounded bg-[var(--surface-raised)]" /></td>
                    <td className="px-6 py-4"><div className="ml-auto h-5 w-20 rounded bg-[var(--surface-raised)]" /></td>
                    <td className="px-6 py-4 text-center"><div className="mx-auto h-6 w-16 rounded-full bg-[var(--surface-raised)]" /></td>
                    <td className="px-6 py-4"><div className="ml-auto h-8 w-20 rounded-lg bg-[var(--surface-raised)]" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={compareMode ? 8 : 7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-rose-500">
                      <p className="font-semibold text-sm">{error}</p>
                      <button
                        type="button"
                        onClick={() => setPage(1)}
                        className="text-xs text-amber-500 hover:text-amber-400 underline transition-colors"
                      >
                        Try refreshing
                      </button>
                    </div>
                  </td>
                </tr>
              ) : displayedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={compareMode ? 8 : 7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
                      <Users className="w-8 h-8 text-[var(--text-muted)] opacity-60" />
                      <p className="text-sm">No players found matching your filters.</p>
                      {(activeFilterCount > 0 || search) && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="text-xs text-amber-500 hover:text-amber-400 underline transition-colors"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedPlayers.map((player, index) => {
                  const isOwned = ownedPlayerIds.includes(player.id);
                  return (
                    <tr
                      key={player.id}
                      data-tour={index === 0 ? 'players-table-row' : undefined}
                      className={`transition-colors ${
                        isOwned
                          ? 'bg-emerald-500/10 hover:bg-emerald-500/15 border-l-3 border-l-emerald-500'
                          : 'hover:bg-[var(--surface-raised)]/60'
                      }`}
                    >
                      {compareMode && <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={comparePlayerIds.includes(player.id)}
                          onChange={() => toggleComparePlayer(player.id)}
                          aria-label={`${comparePlayerIds.includes(player.id) ? 'Remove' : 'Add'} ${player.in_game_name || player.name} ${comparePlayerIds.includes(player.id) ? 'from' : 'to'} player comparison`}
                          className="h-4 w-4 cursor-pointer rounded border-[var(--border)] bg-[var(--surface)] text-cyan-600 accent-cyan-600 focus:ring-cyan-500"
                        />
                      </td>}
                      {/* Player name */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/players/${player.id}`} className="group flex min-w-48 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-raised)]">
                            {player.profile_image_url && !brokenPlayerAvatars.has(player.id) ? (
                              <Image
                                src={player.profile_image_url}
                                alt=""
                                width={40}
                                height={40}
                                unoptimized={!canOptimizeImage(player.profile_image_url)}
                                className="h-full w-full object-cover"
                                onError={() => handlePlayerAvatarError(player.id)}
                              />
                            ) : (
                              <span
                                aria-hidden="true"
                                className="text-xs font-bold text-[var(--text-secondary)]"
                              >
                                {(player.in_game_name || player.name || 'P').slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="flex items-center gap-2 text-[var(--text-primary)] font-bold transition-colors group-hover:text-amber-500">
                              <span className="truncate">{player.in_game_name || player.name}</span>
                              {isOwned && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3" />
                                  In Squad
                                </span>
                              )}
                            </span>
                            {player.in_game_name && player.name !== player.in_game_name && (
                              <span className="truncate text-xs text-[var(--text-muted)]">{player.name}</span>
                            )}
                          </span>
                        </Link>
                      </td>

                      {/* Team */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {player.professional_teams?.name ? (
                          <div className="flex items-center text-[var(--text-secondary)]">
                            {player.professional_teams.logo_url && !brokenLogos.has(player.id) ? (
                              <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-sm">
                                <Image
                                  src={player.professional_teams.logo_url}
                                  alt={`${player.professional_teams.name} logo`}
                                  width={20}
                                  height={20}
                                  className="h-full w-full rounded-sm object-contain"
                                  onError={() => handleLogoError(player.id)}
                                />
                              </span>
                            ) : (
                              <span
                                className="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-[var(--surface-muted)] text-[8px] font-bold tracking-wider text-[var(--text-secondary)]"
                                title={player.professional_teams.name}
                              >
                                {player.professional_teams.name.slice(0, 3).toUpperCase()}
                              </span>
                            )}
                            <span className="font-semibold text-[var(--text-primary)]">{player.professional_teams.name}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)]">
                            Free Agent
                          </span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getRoleBadgeClass(player.primary_role)}`}>
                          {player.primary_role || 'Unassigned'}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-6 py-4 whitespace-nowrap text-right font-black text-[var(--text-primary)] font-mono">
                        {formatPrice(player.current_price)}
                      </td>

                      {/* Ownership */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {player.ownership_percentage != null ? (
                          <div className="inline-flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-[var(--text-primary)]">
                              <span>{Number(player.ownership_percentage).toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {/* Visual gauge bar */}
                              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    Number(player.ownership_percentage) >= 35
                                      ? 'bg-emerald-500'
                                      : Number(player.ownership_percentage) >= 15
                                        ? 'bg-cyan-500'
                                        : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(4, Number(player.ownership_percentage)))}%` }}
                                />
                              </div>
                              {(() => {
                                const classification = getOwnershipClassification(player.ownership_percentage);
                                return (
                                  <span className={`inline-flex rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider border ${classification.color} ${classification.bg} ${classification.border}`}>
                                    {classification.label}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        ) : (
                          <span className="font-mono text-sm text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* Availability */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          aria-label={`Availability: ${player.availability_status || 'Available'}`}
                          title={player.availability_status || 'Available'}
                          style={getAvailabilityBadgeStyle(player.availability_status)}
                          className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold capitalize shadow-2xs"
                        >
                          {player.availability_status || 'Available'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2">
                          {!isOwned && player.availability_status?.toLowerCase() === 'available' && (
                            <Link
                              href={`/transfers?playerId=${player.id}`}
                              aria-label={`Start a transfer with ${player.in_game_name || player.name}`}
                              title="Select this player in the Transfer Market"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-500/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-400"
                            >
                              <Plus className="h-4 w-4" />
                            </Link>
                          )}
                          <Link
                            href={`/players/${player.id}`}
                            className="text-xs font-semibold px-3 py-1.5 border border-[var(--border)] rounded-lg bg-[var(--surface-raised)] text-[var(--text-primary)] hover:border-amber-500/40 transition-colors shadow-2xs"
                          >
                            Profile
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ────────────────────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-raised)]/60 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} players
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3.5 py-1.5 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-raised)] transition-colors text-xs"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3.5 py-1.5 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-raised)] transition-colors text-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
