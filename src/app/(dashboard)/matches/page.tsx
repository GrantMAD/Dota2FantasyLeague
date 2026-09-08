'use client';

import { useState, useEffect, useMemo } from 'react';
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

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Fantasy user squad state
  const [userSquadPlayers, setUserSquadPlayers] = useState<UserSquadPlayer[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // 1. Fetch matches
        const res = await fetch('/api/matches?limit=100');
        const data = await res.json();
        setMatches(data.matches || []);

        // 2. Fetch active gameweek lineup to detect user's owned players
        try {
          const gwRes = await fetch('/api/gameweeks?status=active');
          const gwData = await gwRes.json();
          const activeGw = gwData.gameweeks?.[0];

          if (activeGw) {
            const lineupRes = await fetch(`/api/fantasy/lineup?gameweekId=${activeGw.id}`);
            if (lineupRes.ok) {
              const lineupData = await lineupRes.json();
              const lineup: LineupEntry[] = Array.isArray(lineupData.lineup) ? lineupData.lineup : [];
              const players: UserSquadPlayer[] = lineup
                .map((slot) => slot.professional_players)
                .filter((player): player is UserSquadPlayer => Boolean(player))
                .map((p) => ({
                  id: p.id,
                  name: p.in_game_name || p.name,
                  team_id: p.team_id,
                }));
              setUserSquadPlayers(players);
            }
          }
        } catch {
          // Squad enrichment is non-blocking
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load matches');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Compute available tournaments from actual loaded matches
  const tournaments = useMemo(() => {
    const map = new Map<number, string>();
    matches.forEach((m) => {
      if (m.tournaments?.id && m.tournaments?.name) {
        map.set(m.tournaments.id, m.tournaments.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [matches]);

  // Tab counts
  const counts = useMemo(() => {
    return {
      all: matches.length,
      live: matches.filter((m) => m.status === 'live').length,
      upcoming: matches.filter((m) => m.status === 'scheduled' || m.status === 'upcoming').length,
      completed: matches.filter((m) => m.status === 'completed').length,
    };
  }, [matches]);

  // Filtered matches
  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      // 1. Tab filter
      if (activeTab === 'live' && match.status !== 'live') return false;
      if (activeTab === 'upcoming' && match.status !== 'scheduled' && match.status !== 'upcoming') return false;
      if (activeTab === 'completed' && match.status !== 'completed') return false;

      // 2. Tournament filter
      if (selectedTournamentId && match.tournaments?.id?.toString() !== selectedTournamentId) {
        return false;
      }

      // 3. Search query filter (matches team names or tournament)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const radName = match.radiant_team?.name?.toLowerCase() || '';
        const direName = match.dire_team?.name?.toLowerCase() || '';
        const tournName = match.tournaments?.name?.toLowerCase() || '';
        if (!radName.includes(q) && !direName.includes(q) && !tournName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [matches, activeTab, selectedTournamentId, searchQuery]);

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
        onTabChange={setActiveTab}
        counts={counts}
        tournaments={tournaments}
        selectedTournamentId={selectedTournamentId}
        onTournamentChange={setSelectedTournamentId}
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
      ) : filteredMatches.length === 0 ? (
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
          {filteredMatches.map((match) => (
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
          {filteredMatches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              userSquadPlayerNames={getSquadPlayerNamesForMatch(match)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
