'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { TournamentCard, TournamentData } from './components/TournamentCard';
import { TournamentFilters } from './components/TournamentFilters';
import { TournamentHero } from './components/TournamentHero';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';

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
        const res = await fetchWithAuth('/api/tournaments');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load tournaments');
        setTournaments(Array.isArray(data.tournaments) ? data.tournaments : []);
        setError(null);
      } catch (error: unknown) {
        setError(error instanceof Error ? error.message : 'Failed to load tournaments');
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

  // Feature the most relevant non-archived event first.
  const featuredTournament = useMemo(() => {
    return (
      tournaments.find(
        (t) =>
          (t.status === 'active' || t.tier?.toLowerCase().includes('tier 1') || t.status === 'eligible') &&
          t.status !== 'archived'
      ) || tournaments.find((t) => t.status !== 'archived') || tournaments[0]
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:mb-7 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
              <Trophy className="h-5 w-5" />
            </span>
            <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">Tournaments Circuit</h1>
            <DataFreshnessBadge page="tournaments" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Official Dota 2 pro circuits, Majors, and eligible fantasy esports championships
          </p>
        </div>

        <Link
          href="/matches"
          className="tournaments-match-center-link group inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] shadow-sm transition-all hover:border-amber-500/50 hover:text-[var(--text-primary)]"
        >
          <span>Live Pro Match Center</span>
          <span className="text-amber-600 transition-transform group-hover:translate-x-0.5 dark:text-amber-300">→</span>
        </Link>
      </div>

      {!loading && featuredTournament && (
        <TournamentHero tournament={featuredTournament} />
      )}

      <TournamentFilters
        activeStatus={activeStatus}
        onStatusChange={setActiveStatus}
        selectedTier={selectedTier}
        onTierChange={setSelectedTier}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        counts={counts}
      />

      {error && (
        <div role="alert" className="mb-6 flex items-center gap-2 rounded-xl border border-rose-600/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <div className="flex justify-between items-center">
                <div className="h-5 bg-[var(--surface-raised)] rounded-full w-20" />
                <div className="h-4 bg-[var(--surface-raised)] rounded w-16" />
              </div>
              <div>
                <div className="h-6 bg-[var(--surface-raised)] rounded w-3/4 mb-3 mt-6" />
                <div className="h-4 bg-[var(--surface-raised)] rounded w-1/2" />
              </div>
              <div className="h-4 bg-[var(--surface-raised)] rounded w-full mt-8" />
            </div>
          ))}
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300">
            <Trophy className="h-7 w-7" />
          </div>
          <h3 className="mb-1 text-lg font-bold text-[var(--text-primary)]">No tournaments found</h3>
          <p className="mb-6 max-w-sm text-sm text-[var(--text-secondary)]">
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
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-amber-500/20 transition-colors hover:bg-amber-400"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      )}
    </div>
  );
}

