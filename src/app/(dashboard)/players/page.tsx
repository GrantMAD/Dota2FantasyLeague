'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
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
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';

interface ProfessionalTeam {
  id: number;
  name: string;
  logo_url: string | null;
}

interface Player {
  id: number;
  name: string;
  in_game_name: string | null;
  primary_role: string;
  current_price: number;
  professional_teams?: { name: string; logo_url: string | null };
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
        className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-lg border text-sm font-medium transition-all focus:outline-none focus:ring-1 focus:ring-amber-500/50 ${
          selectedId
            ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
            : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white'
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
                unoptimized
                className="h-4 w-4 rounded-sm object-contain shrink-0"
                onError={() => onTeamLogoError(selected.id)}
              />
            ) : (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-slate-700 text-[7px] font-bold text-slate-300">
                {selected.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="truncate max-w-32.5">{selected.name}</span>
          </>
        ) : (
          <>
            <Shield className="w-4 h-4 shrink-0 text-slate-400" />
            <span>All Teams</span>
          </>
        )}
        <ChevronDown className={`ml-auto w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 max-h-72 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
          {/* All option */}
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm transition-colors hover:bg-slate-800 ${
              !selectedId ? 'text-amber-400 font-semibold' : 'text-slate-300'
            }`}
          >
            <Shield className="w-4 h-4 text-slate-500" />
            All Teams
          </button>
          <div className="border-t border-slate-800 my-0.5" />
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => { onChange(team.id); setOpen(false); }}
              className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm transition-colors hover:bg-slate-800 ${
                selectedId === team.id ? 'text-amber-400 font-semibold' : 'text-slate-300 hover:text-white'
              }`}
            >
              {team.logo_url && !brokenTeamLogos.has(team.id) ? (
                <Image
                  src={team.logo_url}
                  alt={team.name}
                  width={16}
                  height={16}
                  unoptimized
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
export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Team list for the dropdown
  const [teams, setTeams] = useState<ProfessionalTeam[]>([]);
  const [brokenTeamLogos, setBrokenTeamLogos] = useState<Set<number>>(new Set());

  // Player logo broken tracking
  const [brokenLogos, setBrokenLogos] = useState<Set<number>>(new Set());
  const handleLogoError = useCallback((playerId: number) => {
    setBrokenLogos((prev) => new Set(prev).add(playerId));
  }, []);
  const handleTeamLogoError = useCallback((teamId: number) => {
    setBrokenTeamLogos((prev) => new Set(prev).add(teamId));
  }, []);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [teamIdFilter, setTeamIdFilter] = useState<number | null>(null);
  const [pinOwnedFirst, setPinOwnedFirst] = useState(true);

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

  // ── Load teams for dropdown ─────────────────────────────────────────────────
  useEffect(() => {
    async function loadTeams() {
      try {
        const res = await fetch('/api/teams?limit=200');
        if (res.ok) {
          const json = await res.json();
          const sorted = ((json.data as ProfessionalTeam[]) || []).sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          setTeams(sorted);
        }
      } catch {
        // non-critical
      }
    }
    void loadTeams();
  }, []);

  // ── Load squad context ──────────────────────────────────────────────────────
  useEffect(() => {
    async function loadOwnedSquad() {
      try {
        const res = await fetchWithAuth('/api/fantasy/transfer-context');
        if (!res.ok) return;
        const data = await res.json();
        const ownedIds: number[] = Array.isArray(data.ownedPlayerIds) ? data.ownedPlayerIds : [];
        setOwnedPlayerIds(ownedIds);

        if (ownedIds.length > 0) {
          const ownedRes = await fetch(`/api/players?ids=${ownedIds.join(',')}`);
          if (ownedRes.ok) {
            const ownedData = await ownedRes.json();
            const map = new Map<number, Player>();
            for (const p of (ownedData.data || [])) map.set(p.id, p);
            setOwnedPlayersMap(map);
          }
        }
      } catch {
        // non-blocking
      }
    }
    void loadOwnedSquad();
  }, []);

  // ── Fetch players ───────────────────────────────────────────────────────────
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPlayers() {
      setLoading(true);
      setError(null);
      try {
        const offset = (page - 1) * limit;
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: offset.toString(),
          sort: 'price',
          desc: 'true',
        });
        if (debouncedSearch) params.append('search', debouncedSearch);
        if (roleFilter)      params.append('role', roleFilter);
        if (teamIdFilter)    params.append('team_id', teamIdFilter.toString());

        const res = await fetch(`/api/players?${params.toString()}`);
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
  }, [page, limit, debouncedSearch, roleFilter, teamIdFilter, toast]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
        <Users className="w-8 h-8 text-amber-400 shrink-0" />
        <span>Professional Players</span>
      </h1>
      <p className="text-slate-400 mb-8">Browse and scout all professional Dota 2 players to build your squad.</p>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">

        {/* ── Filter Panel ──────────────────────────────────────────────────── */}
        <div className="p-5 border-b border-slate-700 bg-slate-800/80 space-y-4">

          {/* Row 1: Search + Team dropdown */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative grow">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                data-tour="players-search"
                type="text"
                placeholder="Search players by name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
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
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1 shrink-0">Role:</span>

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
                      ? `${color} ${bg} ${border}`
                      : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <Icon className={`w-3 h-3 ${active ? color : 'text-slate-500'}`} />
                  {label}
                </button>
              );
            })}

            {/* Divider */}
            <div className="h-5 w-px bg-slate-700 mx-1 shrink-0" />

            {/* My Squad toggle — only shown when user has a squad */}
            {ownedPlayerIds.length > 0 && (
              <button
                data-tour="players-squad-pin"
                type="button"
                onClick={() => setPinOwnedFirst((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                  pinOwnedFirst
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                    : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:text-white hover:border-slate-500'
                }`}
              >
                <ShieldCheck className={`w-3 h-3 ${pinOwnedFirst ? 'text-emerald-400' : 'text-slate-500'}`} />
                My Squad at Top
              </button>
            )}

            {/* Clear all — shown when any filter active */}
            {(activeFilterCount > 0 || search) && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-600 bg-slate-900/70 text-xs font-semibold text-slate-400 hover:border-red-500/50 hover:text-red-400 transition-all ml-auto"
              >
                <X className="w-3 h-3" />
                Clear filters
                {activeFilterCount > 0 && (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
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
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
                    {t.logo_url && !brokenTeamLogos.has(t.id) ? (
                      <Image src={t.logo_url} alt={t.name} width={12} height={12} unoptimized className="h-3 w-3 rounded-sm object-contain" onError={() => handleTeamLogoError(t.id)} />
                    ) : null}
                    {t.name}
                    <button type="button" onClick={() => { setTeamIdFilter(null); setPage(1); }} className="hover:text-white transition-colors">
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
                    <button type="button" onClick={() => { setRoleFilter(''); setPage(1); }} className="hover:text-white transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              })()}
            </div>
          )}
        </div>

        {/* ── Data Table ────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-700 text-slate-400 text-sm">
                <th className="px-6 py-4 font-medium whitespace-nowrap">Player</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Team</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Role</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap text-right">Price</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap text-center">Status</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading && displayedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-24 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-rose-400">
                      <p className="font-semibold text-sm">{error}</p>
                      <button
                        type="button"
                        onClick={() => setPage(1)}
                        className="text-xs text-amber-400 hover:text-amber-300 underline transition-colors"
                      >
                        Try refreshing
                      </button>
                    </div>
                  </td>
                </tr>
              ) : displayedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Users className="w-8 h-8 text-slate-600" />
                      <p className="text-sm">No players found matching your filters.</p>
                      {(activeFilterCount > 0 || search) && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="text-xs text-amber-400 hover:text-amber-300 underline transition-colors"
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
                          ? 'bg-emerald-950/20 hover:bg-emerald-950/35 border-l-2 border-l-emerald-500'
                          : 'hover:bg-slate-700/30'
                      }`}
                    >
                      {/* Player name */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/players/${player.id}`} className="flex flex-col group">
                          <span className="text-white font-medium group-hover:text-amber-500 transition-colors flex items-center gap-2">
                            <span>{player.in_game_name || player.name}</span>
                            {isOwned && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                In Squad
                              </span>
                            )}
                          </span>
                          {player.in_game_name && player.name !== player.in_game_name && (
                            <span className="text-xs text-slate-500">{player.name}</span>
                          )}
                        </Link>
                      </td>

                      {/* Team */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {player.professional_teams?.name ? (
                          <div className="flex items-center text-slate-300">
                            {player.professional_teams.logo_url && !brokenLogos.has(player.id) ? (
                              <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-sm">
                                <Image
                                  src={player.professional_teams.logo_url}
                                  alt={`${player.professional_teams.name} logo`}
                                  width={20}
                                  height={20}
                                  unoptimized
                                  className="h-full w-full rounded-sm object-contain"
                                  onError={() => handleLogoError(player.id)}
                                />
                              </span>
                            ) : (
                              <span
                                className="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-slate-700 text-[8px] font-bold tracking-wider text-slate-300"
                                title={player.professional_teams.name}
                              >
                                {player.professional_teams.name.slice(0, 3).toUpperCase()}
                              </span>
                            )}
                            <span className="font-medium text-slate-200">{player.professional_teams.name}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-slate-700/80 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-400">
                            Free Agent
                          </span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getRoleBadgeClass(player.primary_role)}`}>
                          {player.primary_role || 'Unassigned'}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-white">
                        {formatPrice(player.current_price)}
                      </td>

                      {/* Status dot */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${player.availability_status === 'available' ? 'bg-green-500' : 'bg-red-500'}`}
                          title={player.availability_status}
                        />
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/players/${player.id}`}
                          className="text-xs px-3 py-1.5 border border-slate-600 rounded text-slate-300 hover:bg-slate-700 transition-colors"
                        >
                          Profile
                        </Link>
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
          <div className="p-4 border-t border-slate-700 bg-slate-800/80 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} players
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-slate-600 rounded bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors text-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-slate-600 rounded bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors text-sm"
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
