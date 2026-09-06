'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { TournamentCard, TournamentData } from './components/TournamentCard';
import { TournamentFilters } from './components/TournamentFilters';
import { TournamentHero } from './components/TournamentHero';

export default function TournamentsHubPage() {
  const [tournaments, setTournaments] = useState<TournamentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [activeStatus, setActiveStatus] = useState<'all' | 'eligible' | 'archived'>('all');
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    async function loadTournaments() {
      try {
        setLoading(true);
        const res = await fetch('/api/tournaments');
        const data = await res.json();
        setTournaments(data.tournaments || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load tournaments');
      } finally {
        setLoading(false);
      }
    }
    loadTournaments();
  }, []);

  // Compute status counts
  const counts = useMemo(() => {
    return {
      all: tournaments.length,
      eligible: tournaments.filter((t) => t.status === 'eligible' || t.status === 'active').length,
      archived: tournaments.filter((t) => t.status === 'archived').length,
    };
  }, [tournaments]);

  // Featured tournament (e.g. first Tier 1 or eligible event)
  const featuredTournament = useMemo(() => {
    return (
      tournaments.find(
        (t) =>
          (t.tier?.toLowerCase().includes('tier 1') || t.status === 'eligible') &&
          t.status !== 'archived'
      ) || tournaments[0]
    );
  }, [tournaments]);

  // Filtered tournament list
  const filteredTournaments = useMemo(() => {
    return tournaments.filter((tournament) => {
      // 1. Status Tab
      if (activeStatus === 'eligible' && tournament.status !== 'eligible' && tournament.status !== 'active') {
        return false;
      }
      if (activeStatus === 'archived' && tournament.status !== 'archived') {
        return false;
      }

      // 2. Tier Chip
      if (selectedTier) {
        const tierStr = (tournament.tier || '').toLowerCase();
        if (selectedTier === 'Tier 1' && !tierStr.includes('tier 1') && !tierStr.includes('major')) {
          return false;
        }
        if (selectedTier === 'Tier 2' && !tierStr.includes('tier 2') && !tierStr.includes('minor')) {
          return false;
        }
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = tournament.name.toLowerCase().includes(q);
        const tierMatch = (tournament.tier || '').toLowerCase().includes(q);
        if (!nameMatch && !tierMatch) return false;
      }

      return true;
    });
  }, [tournaments, activeStatus, selectedTier, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-flex items-center justify-center p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </span>
            <h1 className="text-3xl font-black text-white tracking-tight">Tournaments Circuit</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Official Dota 2 pro circuits, Majors, and eligible fantasy esports championships
          </p>
        </div>

        <Link
          href="/matches"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700/80 text-slate-200 hover:text-white hover:border-amber-500/50 transition-all shadow-sm group"
        >
          <span>⚔️ Live Pro Match Center</span>
          <span className="text-amber-400 group-hover:translate-x-0.5 transition-transform">→</span>
        </Link>
      </div>

      {/* Featured Tournament Spotlight Banner */}
      {!loading && featuredTournament && (
        <TournamentHero tournament={featuredTournament} />
      )}

      {/* Filter Bar */}
      <TournamentFilters
        activeStatus={activeStatus}
        onStatusChange={setActiveStatus}
        selectedTier={selectedTier}
        onTierChange={setSelectedTier}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        counts={counts}
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
              className="animate-pulse bg-slate-900/60 rounded-2xl h-64 border border-slate-800 p-6 flex flex-col justify-between"
            >
              <div className="flex justify-between items-center">
                <div className="h-5 bg-slate-800 rounded-full w-20" />
                <div className="h-4 bg-slate-800 rounded w-16" />
              </div>
              <div>
                <div className="h-6 bg-slate-800 rounded w-3/4 mb-3" />
                <div className="h-4 bg-slate-800 rounded w-1/2" />
              </div>
              <div className="h-4 bg-slate-800 rounded w-full pt-4 border-t border-slate-800" />
            </div>
          ))}
        </div>
      ) : filteredTournaments.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-slate-800 bg-slate-900/40">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-2xl mb-4 text-slate-500">
            🏆
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No tournaments found</h3>
          <p className="text-sm text-slate-400 max-w-sm mb-6">
            {searchQuery || selectedTier || activeStatus !== 'all'
              ? 'Try adjusting your search criteria or filters.'
              : 'There are currently no tournaments on the schedule.'}
          </p>
          {(searchQuery || selectedTier || activeStatus !== 'all') && (
            <button
              onClick={() => {
                setActiveStatus('all');
                setSelectedTier('');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-md shadow-amber-500/20"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        /* Tournament Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      )}
    </div>
  );
}
