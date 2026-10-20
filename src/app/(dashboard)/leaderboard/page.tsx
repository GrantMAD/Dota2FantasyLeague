'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Crown, Medal, RefreshCw, Star } from 'lucide-react';
import { DataFreshnessBadge } from '@/components/DataFreshnessBadge';

type LeaderboardEntry = {
   id: number;
   rank: number;
   previous_rank: number | null;
   total_points: number;
   gameweek_points: number;
   is_pinned?: boolean;
   fantasy_teams?: {
      id?: string;
      name?: string;
      user_id?: string;
      profiles?: {
         username?: string;
         display_name?: string | null;
         avatar_url?: string | null;
         country?: string | null;
         country_code?: string | null;
         bio?: string | null;
      } | null;
   } | null;
};

type SelectedManager = {
   manager: string;
   username?: string;
   displayName?: string | null;
   avatarUrl?: string | null;
   bio?: string | null;
   points: number;
   gwPoints?: number;
   rank: number | null;
   teamName?: string;
   country?: string | null;
};

function getCountryFlag(countryCode?: string | null) {
   if (!countryCode || !/^[a-z]{2}$/i.test(countryCode)) return null;
   return String.fromCodePoint(
      ...countryCode.toUpperCase().split('').map((character) => 127397 + character.charCodeAt(0))
   );
}

export default function LeaderboardPage() {
   const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRecalculatedAt, setLastRecalculatedAt] = useState<string | null>(null);
  const [topGameweekScorer, setTopGameweekScorer] = useState<{ id: number; manager: string; points: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [countryFilter, setCountryFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<SelectedManager | null>(null);

  const [countries, setCountries] = useState<{ code: string; name: string }[]>([
    { code: '', name: 'Global (All)' }
  ]);

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const res = await fetchWithAuth('/api/user/profile');
        if (!res.ok) return;
        const data = (await res.json()) as { profile?: { id?: string } | null };
        if (data.profile?.id) {
          setCurrentUserId(data.profile.id);
        }
      } catch {
        // Fallback gracefully if not logged in or fetch fails
      }
    }
    void fetchCurrentUser();
  }, []);

  useEffect(() => {
    async function fetchCountries() {
      try {
        const res = await fetchWithAuth('/api/leaderboard/countries');
        const data = await res.json() as { countries?: { code: string; name: string }[] };
        if (data.countries && data.countries.length > 0) {
          setCountries([
            { code: '', name: 'Global (All)' },
            ...data.countries
          ]);
        }
      } catch {
        // Countries list is optional (used only for filter dropdown); silently ignore failures
      }
    }
    fetchCountries();
  }, []);

  const fetchLeaderboard = useCallback(async (isBackgroundRefresh = false) => {
    if (isBackgroundRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      let url = `/api/leaderboard?page=${page}&limit=50`;
      if (countryFilter) url += `&country=${countryFilter}`;

      const res = await fetchWithAuth(url);
      const data = await res.json() as {
        leaderboard?: LeaderboardEntry[];
        error?: string;
        lastRecalculatedAt?: string | null;
        topGameweekScorer?: { id: number; manager: string; points: number } | null;
      };
      if (!res.ok) throw new Error(data.error || 'Failed to load leaderboard');
      setEntries(data.leaderboard || []);
      setLastRecalculatedAt(data.lastRecalculatedAt ?? null);
      setTopGameweekScorer(data.topGameweekScorer ?? null);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load leaderboard';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, countryFilter]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void fetchLeaderboard(), 0);
    const interval = window.setInterval(() => void fetchLeaderboard(true), 60_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [fetchLeaderboard]);

  const renderRankChange = (current: number, previous: number | null) => {
    if (!previous || current === previous) {
       const label = previous === current ? 'No rank change' : 'No previous rank available';
       return <span role="img" aria-label={label} title={label} className="text-slate-500 font-bold text-lg">-</span>;
    }
    const diff = previous - current;
    if (diff > 0) {
       return (
          <div role="img" className="flex flex-col items-center justify-center" aria-label={`Up ${diff} places`} title={`Up ${diff} places`}>
             <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd"></path></svg>
             <span className="text-emerald-500 text-[10px] font-bold">{diff}</span>
          </div>
       );
    }
    return (
       <div role="img" className="flex flex-col items-center justify-center" aria-label={`Down ${Math.abs(diff)} places`} title={`Down ${Math.abs(diff)} places`}>
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
          <span className="text-red-500 text-[10px] font-bold">{Math.abs(diff)}</span>
       </div>
    );
  };

  const currentUserEntry = entries.find((entry) => entry.fantasy_teams?.user_id === currentUserId);
  const previousRank = currentUserEntry?.previous_rank;
  const rankChange = currentUserEntry && previousRank ? previousRank - currentUserEntry.rank : null;
  const nextRankEntry = currentUserEntry
    ? entries
        .filter((entry) => !entry.is_pinned && entry.rank < currentUserEntry.rank)
        .sort((left, right) => right.rank - left.rank)[0]
    : null;
  const pointsToNextRank = currentUserEntry && nextRankEntry
    ? Math.max(0, nextRankEntry.total_points - currentUserEntry.total_points)
    : null;
  const podiumEntries = page === 1
    ? entries.filter((entry) => !entry.is_pinned).slice(0, 3)
    : [];
  const podiumOrder = [podiumEntries[1], podiumEntries[0], podiumEntries[2]]
    .filter((entry): entry is LeaderboardEntry => entry !== undefined);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-[var(--text-primary)] flex items-center gap-3">
              <Medal className="w-8 h-8 text-amber-400 shrink-0" />
              <span>Global Leaderboard</span>
            </h1>
            <DataFreshnessBadge page="leaderboard" />
          </div>
          <p className="text-[var(--text-secondary)]">See how your squad ranks against the world</p>
        </div>
        
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="relative rounded-lg border border-[var(--border)] bg-[var(--surface)]">
           <select 
              data-tour="leaderboard-filter"
              value={countryFilter}
              onChange={(e) => { setCountryFilter(e.target.value); setPage(1); }}
              className="w-full cursor-pointer appearance-none bg-transparent py-3 pl-4 pr-10 text-sm text-[var(--text-primary)] focus:outline-none"
           >
              {countries.map(c => (
                 <option key={c.code} value={c.code} className="bg-[var(--surface)] text-[var(--text-primary)]">
                    {c.name}
                 </option>
              ))}
           </select>
           <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-muted)]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
           </div>
          </div>
           <button
             type="button"
             onClick={() => void fetchLeaderboard(true)}
             disabled={refreshing}
             className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
           >
             <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
             Refresh
           </button>
        </div>
      </div>
      <p className="-mt-5 mb-6 text-xs text-[var(--text-muted)]" aria-live="polite">
        Rankings last recalculated:{' '}
        {lastRecalculatedAt
          ? new Date(lastRecalculatedAt).toLocaleString()
          : 'No completed recalculation recorded'}
        {' · '}Auto-refreshes every minute
      </p>

      {topGameweekScorer && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-[var(--text-primary)]">
          <Star className="h-5 w-5 shrink-0 fill-amber-400 text-amber-400" aria-hidden="true" />
          <p>
            <span className="font-semibold text-amber-700 dark:text-amber-300">Top gameweek scorer:</span>{' '}
            {topGameweekScorer.manager} with {topGameweekScorer.points} points
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-8 text-sm">
          {error}
        </div>
      )}

      {!loading && podiumOrder.length > 0 && (
        <section aria-labelledby="leaderboard-podium-title" className="mb-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl sm:p-7">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-primary)]">Season standings</p>
              <h2 id="leaderboard-podium-title" className="mt-1 text-xl font-bold text-[var(--text-primary)]">Top Managers</h2>
            </div>
            <Medal className="h-6 w-6 text-amber-500" aria-hidden="true" />
          </div>
          <div className="grid items-end gap-3 md:grid-cols-3">
            {podiumOrder.map((entry) => {
              const profile = entry.fantasy_teams?.profiles;
              const managerName = profile?.display_name || profile?.username || 'Anonymous Manager';
              const teamName = entry.fantasy_teams?.name || 'Unknown Team';
              const podiumPlace = podiumEntries.indexOf(entry) + 1;
              const isFirst = podiumPlace === 1;
              const accent = isFirst ? '#f59e0b' : podiumPlace === 2 ? '#94a3b8' : '#b45309';
              const flag = getCountryFlag(profile?.country_code);
              return (
                <article
                  key={`podium-${entry.id}`}
                  className={`relative flex min-h-48 flex-col items-center justify-center rounded-2xl border p-5 text-center ${
                    isFirst ? 'md:min-h-56 md:-translate-y-2' : ''
                  }`}
                  style={{
                    borderColor: `color-mix(in srgb, ${accent} 45%, var(--border))`,
                    background: `linear-gradient(160deg, color-mix(in srgb, ${accent} 15%, var(--surface-raised)), var(--surface))`,
                    boxShadow: isFirst ? `0 12px 36px color-mix(in srgb, ${accent} 15%, transparent)` : undefined,
                  }}
                >
                  <div
                    className="mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-black"
                    style={{ color: isFirst ? '#451a03' : 'var(--text-primary)', backgroundColor: accent }}
                    aria-label={`Leaderboard podium place ${podiumPlace}; global rank ${entry.rank}`}
                  >
                    {isFirst ? <Crown className="h-4 w-4" aria-hidden="true" /> : podiumPlace}
                  </div>
                  <div className="mb-3 h-14 w-14 overflow-hidden rounded-full border-2 bg-[var(--surface-raised)]"
                    style={{ borderColor: accent }}>
                    {profile?.avatar_url ? (
                      <Image src={profile.avatar_url} alt={`${managerName} avatar`} width={56} height={56} unoptimized className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-lg font-bold text-[var(--text-secondary)]">
                        {teamName.substring(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="max-w-full truncate text-sm font-bold text-[var(--text-primary)]">{teamName}</p>
                  <p className="mt-1 max-w-full truncate text-xs text-[var(--text-secondary)]">
                    {flag && <span className="mr-1.5" role="img" aria-label={profile?.country || 'Country'}>{flag}</span>}
                    {managerName}
                  </p>
                  <p className="mt-3 font-mono text-xl font-black" style={{ color: accent }}>
                    {entry.total_points.toLocaleString()} <span className="text-xs font-semibold">pts</span>
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!loading && currentUserEntry && (
        <section aria-label="Your leaderboard position" className="mb-6 rounded-2xl border border-teal-500/40 bg-[var(--surface)] p-4 shadow-lg sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-sm font-black text-teal-700 ring-1 ring-teal-500/30 dark:text-teal-300">
                #{currentUserEntry.rank}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">Your global position</p>
                <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
                  {currentUserEntry.fantasy_teams?.name || 'Your squad'}
                  {currentUserEntry.is_pinned && <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">Pinned from another page</span>}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Rank change</p>
                <div className="mt-1 flex items-center gap-1.5">
                  {renderRankChange(currentUserEntry.rank, previousRank ?? null)}
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    {rankChange === null ? 'No previous rank' : rankChange > 0 ? `Up ${rankChange}` : rankChange < 0 ? `Down ${Math.abs(rankChange)}` : 'No change'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Total points</p>
                <p className="mt-1 font-mono text-lg font-bold text-amber-600 dark:text-amber-400">{currentUserEntry.total_points.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Gap to next rank</p>
                <p className="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]">
                  {pointsToNextRank === null ? currentUserEntry.rank === 1 ? 'Top rank' : '—' : `${pointsToNextRank.toLocaleString()} pts`}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <div data-tour="leaderboard-table" className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-150">
               <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)] text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                     <th className="px-6 py-4 w-20 text-center">Rank</th>
                     <th className="px-2 py-4 w-16 text-center">Change</th>
                     <th className="px-6 py-4">Manager & Team</th>
                     <th className="px-6 py-4 text-right">GW Pts</th>
                     <th className="px-6 py-4 text-right text-amber-500">Total Pts</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-[var(--border)]">
                  {loading ? (
                     [1, 2, 3, 4, 5, 6].map((row) => (
                        <tr key={`ranking-skeleton-${row}`} className="animate-pulse">
                           <td className="px-6 py-4 text-center"><div className="mx-auto h-8 w-8 rounded-full bg-slate-700" /></td>
                           <td className="px-2 py-4"><div className="mx-auto h-4 w-8 rounded bg-slate-700" /></td>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="h-10 w-10 shrink-0 rounded-full border border-slate-700 bg-slate-700" />
                                 <div className="space-y-2">
                                    <div className="h-4 w-36 max-w-[35vw] rounded bg-slate-700" />
                                    <div className="h-3 w-24 rounded bg-slate-800" />
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-4"><div className="ml-auto h-4 w-12 rounded bg-slate-700" /></td>
                           <td className="px-6 py-4"><div className="ml-auto h-5 w-16 rounded bg-slate-700" /></td>
                        </tr>
                     ))
                  ) : entries.length === 0 ? (
                     <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                           No rankings found for the selected criteria.
                        </td>
                     </tr>
                  ) : (
                     entries.map((entry) => {
                        const team = entry.fantasy_teams;
                        const profile = team?.profiles;
                        const isTop3 = entry.rank <= 3;
                        const isTopGameweekScorer = entry.id === topGameweekScorer?.id;
                        const managerName = profile?.display_name || profile?.username || 'Anonymous Manager';
                        const isCurrentUser = Boolean(currentUserId && team?.user_id === currentUserId);
                        const countryFlag = getCountryFlag(profile?.country_code);
                        
                        return (
                           <tr
                              key={entry.id}
                              data-tour={isCurrentUser ? 'leaderboard-you-row' : undefined}
                              onClick={() => setSelectedUser({
                                 manager: managerName,
                                 username: profile?.username || managerName.toLowerCase().replace(/\s+/g, '_'),
                                 displayName: profile?.display_name || null,
                                 avatarUrl: profile?.avatar_url || null,
                                 bio: profile?.bio || null,
                                 points: entry.total_points || 0,
                                 gwPoints: entry.gameweek_points || 0,
                                 rank: entry.rank,
                                 teamName: team?.name || 'Unknown Team',
                                 country: profile?.country || null,
                              })}
                              style={isCurrentUser ? {
                                 backgroundColor: 'color-mix(in srgb, var(--accent-primary) 12%, var(--surface))',
                                 borderLeftColor: 'var(--accent-primary)',
                              } : isTopGameweekScorer ? {
                                 backgroundColor: 'color-mix(in srgb, #f59e0b 10%, var(--surface))',
                                 borderLeftColor: '#f59e0b',
                              } : undefined}
                              className={`transition-colors group cursor-pointer ${
                                 isTopGameweekScorer
                                    ? 'border-l-4 hover:bg-[var(--surface-raised)]'
                                    : isCurrentUser
                                    ? 'border-l-4 hover:bg-[var(--surface-raised)]'
                                    : 'border-l-4 border-l-transparent odd:bg-[var(--surface)] even:bg-[var(--surface-raised)] hover:bg-[var(--surface-muted)]'
                              }`}
                              title="Click to view manager profile"
                           >
                              <td className="px-6 py-4 text-center">
                                 <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                    entry.rank === 1 ? 'bg-yellow-500 text-yellow-950 shadow-[0_0_15px_rgba(234,179,8,0.5)]' :
                                    entry.rank === 2 ? 'bg-slate-300 text-slate-800 shadow-[0_0_10px_rgba(203,213,225,0.4)]' :
                                    entry.rank === 3 ? 'bg-amber-700 text-amber-100 shadow-[0_0_10px_rgba(180,83,9,0.4)]' :
                                    isCurrentUser ? 'text-teal-300 bg-teal-900/60 ring-1 ring-teal-500/40' :
                                    'text-slate-400 bg-slate-800'
                                 }`}>
                                    {entry.rank}
                                 </span>
                              </td>
                              <td className="px-2 py-4">
                                 <div className="flex justify-center">
                                    {renderRankChange(entry.rank, entry.previous_rank)}
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full bg-[var(--surface-raised)] overflow-hidden shrink-0 border ${isCurrentUser ? 'border-teal-500/70 ring-2 ring-teal-500/20' : isTop3 ? 'border-amber-500/50' : 'border-[var(--border)]'}`}>
                                       {profile?.avatar_url ? (
                                          <Image src={profile.avatar_url} alt={`${managerName} avatar`} width={40} height={40} unoptimized className="w-full h-full object-cover" />
                                       ) : (
                                          <div className={`w-full h-full flex items-center justify-center font-bold ${isCurrentUser ? 'text-teal-700 dark:text-teal-300' : 'text-[var(--text-secondary)]'}`}>
                                             {team?.name?.substring(0, 1).toUpperCase() || '?'}
                                          </div>
                                       )}
                                    </div>
                                    <div>
                                       <div className="flex items-center gap-2">
                                          <span className={`font-bold transition-colors ${isCurrentUser ? 'text-teal-700 group-hover:text-teal-600 dark:text-teal-300 dark:group-hover:text-teal-200' : 'text-[var(--text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-400'}`}>{team?.name || 'Unknown Team'}</span>
                                          {isCurrentUser && (
                                             <span className="inline-flex items-center rounded-full border border-teal-500/30 bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
                                                You
                                             </span>
                                          )}
                                       </div>
                                       <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                                          {profile?.country && (
                                             <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                                                {countryFlag && <span role="img" aria-label={profile.country}>{countryFlag}</span>}
                                                {profile.country}
                                             </span>
                                             )}
                                             <span className="text-[var(--text-secondary)]">{managerName}</span>
                                       </div>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-4 text-right font-mono">
                                 <span className={`inline-flex items-center justify-end gap-1.5 font-medium ${isTopGameweekScorer ? 'text-amber-700 dark:text-amber-300' : isCurrentUser ? 'text-teal-700 dark:text-teal-200' : 'text-[var(--text-secondary)]'}`}>
                                    {isTopGameweekScorer && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Top gameweek scorer" />}
                                    {entry.gameweek_points || 0}
                                 </span>
                              </td>
                              <td className="px-6 py-4 text-right font-mono">
                                 <span className={`text-lg font-bold ${isCurrentUser ? 'text-teal-700 dark:text-teal-300' : 'text-amber-700 dark:text-amber-400'}`}>{entry.total_points || 0}</span>
                              </td>
                           </tr>
                        );
                     })
                  )}
               </tbody>
            </table>
         </div>
         
         {/* Pagination */}
         {!loading && entries.length > 0 && (
            <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-raised)] px-6 py-4">
               <div className="text-sm text-[var(--text-secondary)]">
                  {entries.some((entry) => !entry.is_pinned)
                    ? `Showing top ${(page - 1) * 50 + 1} to ${(page - 1) * 50 + entries.filter((entry) => !entry.is_pinned).length}`
                    : 'No leaderboard entries on this page.'}
                  {entries.some((entry) => entry.is_pinned) && <span className="ml-2 text-teal-700 dark:text-teal-300">Your rank is pinned below.</span>}
               </div>
               <div className="flex gap-2">
                  <button 
                     onClick={() => setPage(p => Math.max(1, p - 1))}
                     disabled={page === 1}
                     className="leaderboard-pagination-button rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                     Previous
                  </button>
                  <button 
                     onClick={() => setPage(p => p + 1)}
                     disabled={entries.length < 50}
                     className="leaderboard-pagination-button rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                     Next
                  </button>
               </div>
            </div>
         )}
      </div>

      {/* Manager Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 no-scrollbar">
            {/* Header */}
            <div className="border-b border-slate-800 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-amber-500/50 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  {selectedUser.avatarUrl ? (
                    <Image src={selectedUser.avatarUrl} alt={selectedUser.manager} width={56} height={56} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-amber-400">
                      {(selectedUser.displayName || selectedUser.username || selectedUser.manager).substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white">{selectedUser.manager}</h2>
                    {selectedUser.rank && (
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/40">
                        Rank #{selectedUser.rank}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    @{selectedUser.username || selectedUser.manager.toLowerCase().replace(/\s+/g, '_')}
                    {selectedUser.teamName && (
                      <span className="text-slate-500 ml-1.5">• {selectedUser.teamName}</span>
                    )}
                  </p>
                </div>
              </div>

              {selectedUser.bio && (
                <p className="leaderboard-manager-bio mt-4 text-sm text-slate-300 bg-slate-950/40 border border-slate-800/80 rounded-lg p-3 italic">
                  &quot;{selectedUser.bio}&quot;
                </p>
              )}
            </div>

            {/* Performance Stats Grid */}
            <div className="my-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Global Standing & Performance</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="leaderboard-modal-label text-xs text-slate-400 uppercase tracking-wider">Total Points</div>
                  <div className="leaderboard-total-points text-2xl font-mono font-bold text-amber-400 mt-1">{selectedUser.points} <span className="text-sm font-sans text-amber-300">pts</span></div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="leaderboard-modal-label text-xs text-slate-400 uppercase tracking-wider">Gameweek</div>
                  <div className="leaderboard-gameweek-points text-2xl font-mono font-bold text-slate-200 mt-1">{selectedUser.gwPoints ?? 0} <span className="leaderboard-points-label text-sm font-sans text-slate-400">pts</span></div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="leaderboard-modal-label text-xs text-slate-400 uppercase tracking-wider">Global Rank</div>
                  <div className="leaderboard-global-rank text-2xl font-mono font-bold text-white mt-1">#{selectedUser.rank ?? '-'}</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
