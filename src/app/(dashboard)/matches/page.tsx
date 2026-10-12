'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MatchCard, MatchData } from './components/MatchCard';
import { MatchRow } from './components/MatchRow';
import { MatchFilters } from './components/MatchFilters';

interface UserSquadPlayer {
  id: number;
  name: string;
  in_game_name?: string | null;
  team_id?: number | null;
}

interface LineupEntry {
  professional_players?: UserSquadPlayer | null;
}

interface TournamentOption {
  id: number;
  name: string;
}

const PAGE_SIZE = 24;

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [counts, setCounts] = useState({ all: 0, live: 0, upcoming: 0, completed: 0 });

  // Filters state
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Fantasy user squad state
  const [userSquadPlayers, setUserSquadPlayers] = useState<UserSquadPlayer[]>([]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    async function loadMatches() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          status: activeTab,
        });
        if (selectedTournamentId) params.set('tournamentId', selectedTournamentId);
        if (debouncedSearch) params.set('search', debouncedSearch);
        const res = await fetchWithAuth(`/api/matches?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            typeof data.details === 'string'
              ? data.details
              : typeof data.error === 'string' ? data.error : 'Failed to load matches.'
          );
        }
        if (cancelled) return;
        setMatches(Array.isArray(data.matches) ? data.matches : []);
        setTournaments(Array.isArray(data.tournaments) ? data.tournaments : []);
        setTotal(Number.isFinite(data.pagination?.total) ? data.pagination.total : 0);
        setTotalPages(Number.isFinite(data.pagination?.totalPages) ? data.pagination.totalPages : 0);
        setCounts({
          all: Number.isFinite(data.counts?.all) ? data.counts.all : 0,
          live: Number.isFinite(data.counts?.live) ? data.counts.live : 0,
          upcoming: Number.isFinite(data.counts?.upcoming) ? data.counts.upcoming : 0,
          completed: Number.isFinite(data.counts?.completed) ? data.counts.completed : 0,
        });
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load matches');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadMatches();
    return () => {
      cancelled = true;
    };
  }, [activeTab, debouncedSearch, page, selectedTournamentId]);

  useEffect(() => {
    async function loadSquadPlayers() {
      try {
        const gwRes = await fetchWithAuth('/api/gameweeks?status=active');
        if (!gwRes.ok) return;
        const gwData = await gwRes.json();
        const activeGw = gwData.gameweeks?.[0];
        if (!activeGw) return;

        const lineupRes = await fetchWithAuth(`/api/fantasy/lineup?gameweekId=${activeGw.id}`);
        if (!lineupRes.ok) return;
        const lineupData = await lineupRes.json();
        const lineup: LineupEntry[] = Array.isArray(lineupData.lineup) ? lineupData.lineup : [];
        const players: UserSquadPlayer[] = lineup
          .map((slot) => slot.professional_players)
          .filter((player): player is UserSquadPlayer => Boolean(player))
          .map((player) => ({
            id: player.id,
            name: player.in_game_name || player.name,
            team_id: player.team_id,
          }));
        setUserSquadPlayers(players);
      } catch {
        // Squad enrichment is non-blocking.
      }
    }
    void loadSquadPlayers();
  }, []);

  // Helper to map squad players to a match
  const getSquadPlayerNamesForMatch = (match: MatchData) => {
    if (!userSquadPlayers.length) return [];
    const radId = match.radiant_team_id;
    const direId = match.dire_team_id;
    return userSquadPlayers
      .filter((p) => p.team_id === radId || p.team_id === direId)
      .map((p) => p.name);
  };

  return (
    <div className="matches-page max-w-7xl mx-auto px-4 py-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-flex items-center justify-center p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <h1 className="text-3xl font-black text-white tracking-tight">Match Center</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Live pro circuit scores, upcoming series schedule, and your fantasy squad tracking
          </p>
        </div>

        {/* Quick link to user's lineup */}
        <Link
          href="/lineups"
          className="matches-active-lineup-link inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700/80 text-slate-200 hover:text-white hover:border-amber-500/50 transition-all shadow-sm group"
        >
          <span>⭐ Check My Active Lineup</span>
          <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform">→</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <MatchFilters
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setPage(1);
        }}
        counts={counts}
        tournaments={tournaments}
        selectedTournamentId={selectedTournamentId}
        onTournamentChange={(id) => {
          setSelectedTournamentId(id);
          setPage(1);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Error state */}
      {error && (
        <div className="bg-rose-950/40 border border-rose-600/50 text-rose-300 px-4 py-3 rounded-xl mb-8 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-slate-900/60 rounded-2xl h-56 border border-slate-800 p-5 flex flex-col justify-between"
            >
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="flex justify-between items-center px-4">
                <div className="w-12 h-12 rounded-xl bg-slate-800" />
                <div className="w-12 h-6 rounded bg-slate-800" />
                <div className="w-12 h-12 rounded-xl bg-slate-800" />
              </div>
              <div className="h-3 bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : matches.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-slate-800 bg-slate-900/40">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-2xl mb-4 text-slate-500">
            ⚔️
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No matches found</h3>
          <p className="text-sm text-slate-400 max-w-sm mb-6">
            {searchQuery || selectedTournamentId || activeTab !== 'all'
              ? 'Try resetting your filters or search terms to see more matches.'
              : 'There are currently no matches scheduled or completed.'}
          </p>
          {(searchQuery || selectedTournamentId || activeTab !== 'all') && (
            <button
              onClick={() => {
                setActiveTab('all');
                setSelectedTournamentId('');
                setSearchQuery('');
                setDebouncedSearch('');
                setPage(1);
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-md shadow-amber-500/20"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Mode */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              userSquadPlayerNames={getSquadPlayerNamesForMatch(match)}
            />
          ))}
        </div>
      ) : (
        /* List Mode */
        <div className="flex flex-col gap-3">
          {matches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              userSquadPlayerNames={getSquadPlayerNamesForMatch(match)}
            />
          ))}
        </div>
      )}
      {!loading && total > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-400">
          <p>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} matches
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2">Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
