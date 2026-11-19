'use client';

import { fetchWithAuth } from '@/lib/fetch-with-auth';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { BarChart3, RefreshCw, CheckCircle, Edit2, ArrowRightLeft } from 'lucide-react';


interface ProfessionalTeam {
  id: number;
  name: string;
  logo_url: string | null;
}

interface Tournament {
  name: string;
  tier: string | null;
}

interface Match {
  id: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';
  scheduled_time: string;
  detailed_stats_fetched_at: string | null;
  team_a: ProfessionalTeam | null;
  team_b: ProfessionalTeam | null;
  tournament: Tournament | null;
  winner_team_id: number | null;
  team_a_id: number;
  team_b_id: number;
  series_id?: number | null;
  best_of?: number | null;
  gameweek_id?: number | null;
}

interface SeriesOption {
  id: number;
  series_number: number;
  best_of: number | null;
  gameweek_id: number;
  team_a: { name: string } | null;
  team_b: { name: string } | null;
  tournament: { name: string } | null;
  match_count: number;
}

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [syncingMatchId, setSyncingMatchId] = useState<number | null>(null);
  const [syncingAllPending, setSyncingAllPending] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [patchingMatchId, setPatchingMatchId] = useState<number | null>(null);
  const [editingBestOfMatchId, setEditingBestOfMatchId] = useState<number | null>(null);
  const [movingMatch, setMovingMatch] = useState<Match | null>(null);
  const [seriesOptions, setSeriesOptions] = useState<SeriesOption[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [selectedTargetSeriesId, setSelectedTargetSeriesId] = useState<number | null>(null);

  const limit = 25;
  const requestKey = JSON.stringify([page, statusFilter, refreshVersion]);
  const loading = loadedRequestKey !== requestKey;

  useEffect(() => {
    async function fetchMatches() {
      try {
        const offset = (page - 1) * limit;
        const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
        if (statusFilter) params.append('status', statusFilter);

        const res = await fetchWithAuth(`/api/admin/matches?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setMatches(data.data || []);
          setTotal(data.total || 0);
        }
      } catch (err) {
        console.error('Failed to fetch matches', err);
      } finally {
        setLoadedRequestKey(JSON.stringify([page, statusFilter, refreshVersion]));
      }
    }

    void fetchMatches();
  }, [page, statusFilter, refreshVersion]);

  const handleSync = async (matchId: number) => {
    setSyncingMatchId(matchId);
    setSyncMessage(null);
    try {
      const res = await fetchWithAuth(`/api/admin/matches/${matchId}/sync`, { method: 'POST' });
      const data = await res.json();
      setSyncMessage(data.message || (res.ok ? 'Sync triggered.' : data.error));
    } catch {
      setSyncMessage('Failed to trigger sync.');
    } finally {
      setSyncingMatchId(null);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const handleForceComplete = async (matchId: number) => {
    setPatchingMatchId(matchId);
    setSyncMessage(null);
    try {
      const res = await fetchWithAuth(`/api/admin/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(`Match ${matchId} marked as completed.`);
        setRefreshVersion((v) => v + 1);
      } else {
        setSyncMessage(data.error || 'Failed to force complete match.');
      }
    } catch {
      setSyncMessage('Failed to force complete match.');
    } finally {
      setPatchingMatchId(null);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const handleEditBestOf = async (matchId: number, bestOf: number) => {
    setPatchingMatchId(matchId);
    setSyncMessage(null);
    try {
      const res = await fetchWithAuth(`/api/admin/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ best_of: bestOf }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(`Series best_of updated to Bo${bestOf}.`);
        setRefreshVersion((v) => v + 1);
      } else {
        setSyncMessage(data.error || 'Failed to update best_of.');
      }
    } catch {
      setSyncMessage('Failed to update best_of.');
    } finally {
      setPatchingMatchId(null);
      setEditingBestOfMatchId(null);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const handleSyncAllPending = async () => {
    setSyncingAllPending(true);
    setSyncMessage(null);

    try {
      const response = await fetchWithAuth('/api/admin/jobs/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobName: 'fetch-match-details' }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start the match details job.');
      }

      if (data.result?.status !== 'completed') {
        throw new Error(data.result?.error || 'The match details job did not complete successfully.');
      }

      const result = data.result.result as { fetched?: number; errors?: string[] } | undefined;
      const fetched = result?.fetched ?? 0;
      const errorCount = result?.errors?.length ?? 0;
      setSyncMessage(
        errorCount > 0
          ? `Synced ${fetched} pending match${fetched === 1 ? '' : 'es'}; ${errorCount} failed. Check the job logs for details.`
          : `Synced ${fetched} pending match${fetched === 1 ? '' : 'es'}.`,
      );
      setRefreshVersion((version) => version + 1);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Failed to sync pending matches.');
    } finally {
      setSyncingAllPending(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const handleStartMoveMatch = async (match: Match) => {
    setMovingMatch(match);
    setSelectedTargetSeriesId(match.series_id ?? null);
    setLoadingSeries(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (match.gameweek_id) {
        params.append('gameweek_id', match.gameweek_id.toString());
      }
      const res = await fetchWithAuth(`/api/admin/series?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSeriesOptions(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load series options', err);
    } finally {
      setLoadingSeries(false);
    }
  };

  const handleConfirmMoveMatch = async (matchId: number, targetSeriesId: number) => {
    setPatchingMatchId(matchId);
    setSyncMessage(null);
    try {
      const res = await fetchWithAuth(`/api/admin/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series_id: targetSeriesId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(`Match ${matchId} moved to Series #${targetSeriesId}.`);
        setRefreshVersion((v) => v + 1);
        setMovingMatch(null);
      } else {
        setSyncMessage(data.error || 'Failed to move match to series.');
      }
    } catch {
      setSyncMessage('Failed to move match to series.');
    } finally {
      setPatchingMatchId(null);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const getStatusBadge = (status: string, detailedStatsFetchedAt: string | null) => {
    if (status === 'completed' && !detailedStatsFetchedAt) {
      return <span className="px-2 py-0.5 text-xs font-medium rounded border bg-orange-500/10 text-orange-400 border-orange-500/20">Pending Stats</span>;
    }
    if (status === 'completed') {
      return <span className="px-2 py-0.5 text-xs font-medium rounded border bg-green-500/10 text-green-400 border-green-500/20">Synced</span>;
    }
    if (status === 'in_progress') {
      return <span className="px-2 py-0.5 text-xs font-medium rounded border bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse">Live</span>;
    }
    if (status === 'scheduled') {
      return <span className="px-2 py-0.5 text-xs font-medium rounded border bg-slate-500/10 text-slate-400 border-slate-500/20">Scheduled</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-medium rounded border bg-red-500/10 text-red-400 border-red-500/20">{status}</span>;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-8">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-white"><BarChart3 className="h-8 w-8 text-amber-400" />Match Management</h1>
        <p className="mt-1 text-slate-400">View match sync status and trigger re-fetches.</p>
      </div>

      {syncMessage && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
          {syncMessage}
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex flex-wrap gap-4 items-center">
          <button
            type="button"
            onClick={() => void handleSyncAllPending()}
            disabled={syncingAllPending || syncingMatchId !== null}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${syncingAllPending ? 'animate-spin' : ''}`} />
            {syncingAllPending ? 'Syncing Pending Matches...' : 'Sync All Pending'}
          </button>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="cancelled">Cancelled</option>
            <option value="postponed">Postponed</option>
          </select>
          <button onClick={() => setRefreshVersion((version) => version + 1)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg text-sm transition-colors">
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-700 text-slate-400 text-sm">
                <th className="px-4 py-3 font-medium">Match</th>
                <th className="px-4 py-3 font-medium">Tournament</th>
                <th className="px-4 py-3 font-medium">Format</th>
                <th className="px-4 py-3 font-medium">Scheduled</th>
                <th className="px-4 py-3 font-medium">Sync Status</th>
                <th className="px-4 py-3 font-medium">Last Synced</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading && matches.length === 0 ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`match-skeleton-${index}`} className="animate-pulse">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1"><div className="h-4 w-4 rounded-sm bg-slate-700/60" /><div className="h-4 w-4 rounded-sm bg-slate-700/60" /></div>
                        <div className="space-y-2"><div className="h-3 w-24 rounded bg-slate-700/60" /><div className="h-3 w-20 rounded bg-slate-700/50" /></div>
                      </div>
                    </td>
                    <td className="px-4 py-4"><div className="h-4 w-28 rounded bg-slate-700/50" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-16 rounded bg-slate-700/50" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-36 rounded bg-slate-700/50" /></td>
                    <td className="px-4 py-4"><div className="h-5 w-20 rounded bg-slate-700/50" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-32 rounded bg-slate-700/50" /></td>
                    <td className="px-4 py-4"><div className="ml-auto h-8 w-20 rounded bg-slate-700/50" /></td>
                  </tr>
                ))
              ) : matches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">No matches found.</td>
                </tr>
              ) : (
                matches.map((match) => (
                  <tr key={match.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center w-5">
                          {match.team_a?.logo_url
                            ? <Image src={match.team_a.logo_url} width={16} height={16} unoptimized className="w-4 h-4 object-contain" alt={`${match.team_a.name} logo`} />
                            : <div className="w-4 h-4 bg-slate-700 rounded-sm" />}
                          {match.team_b?.logo_url
                            ? <Image src={match.team_b.logo_url} width={16} height={16} unoptimized className="w-4 h-4 object-contain mt-1" alt={`${match.team_b.name} logo`} />
                            : <div className="w-4 h-4 bg-slate-700 rounded-sm mt-1" />}
                        </div>
                        <div className="flex flex-col text-sm">
                          <span className={`font-medium ${match.winner_team_id === match.team_a_id ? 'text-white' : 'text-slate-300'}`}>{match.team_a?.name || 'TBD'}</span>
                          <span className={`font-medium ${match.winner_team_id === match.team_b_id ? 'text-white' : 'text-slate-300'}`}>{match.team_b?.name || 'TBD'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{match.tournament?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-col gap-0.5">
                        {editingBestOfMatchId === match.id ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              defaultValue={match.best_of ?? 3}
                              disabled={patchingMatchId === match.id}
                              onChange={(e) => void handleEditBestOf(match.id, parseInt(e.target.value))}
                              className="px-2 py-0.5 text-xs bg-slate-900 border border-slate-600 rounded text-amber-300 focus:outline-none focus:border-amber-500"
                            >
                              <option value={1}>Bo1</option>
                              <option value={2}>Bo2</option>
                              <option value={3}>Bo3</option>
                              <option value={5}>Bo5</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => setEditingBestOfMatchId(null)}
                              className="text-xs text-slate-400 hover:text-white px-1"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingBestOfMatchId(match.id)}
                            title="Click to edit series Best of"
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-slate-700 bg-slate-800/80 text-slate-300 hover:border-amber-500/50 hover:text-amber-300 transition-colors w-fit"
                          >
                            {match.best_of ? `Bo${match.best_of}` : 'Bo3'}
                            <Edit2 className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        )}
                        {match.series_id && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Series #{match.series_id}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{new Date(match.scheduled_time).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">{getStatusBadge(match.status, match.detailed_stats_fetched_at)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {match.detailed_stats_fetched_at ? new Date(match.detailed_stats_fetched_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => void handleStartMoveMatch(match)}
                          disabled={patchingMatchId === match.id}
                          title="Move match to a different series"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded transition-colors disabled:opacity-50"
                        >
                          <ArrowRightLeft className="h-3 w-3 text-amber-400" />
                          Move
                        </button>
                        {match.status === 'in_progress' && (
                          <button
                            onClick={() => void handleForceComplete(match.id)}
                            disabled={patchingMatchId === match.id}
                            title="Force mark this stuck live match as completed"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-blue-500/40 text-blue-300 hover:bg-blue-500/10 rounded transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-blue-400" />
                            {patchingMatchId === match.id ? 'Updating...' : 'Force Complete'}
                          </button>
                        )}
                        {match.status === 'completed' && (
                          <button
                            onClick={() => handleSync(match.id)}
                            disabled={Boolean(match.detailed_stats_fetched_at) || syncingMatchId === match.id || syncingAllPending}
                            title={match.detailed_stats_fetched_at ? 'Match details have already been synced.' : undefined}
                            className="px-3 py-1.5 text-xs font-medium border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                          >
                            {syncingMatchId === match.id
                              ? 'Syncing...'
                              : match.detailed_stats_fetched_at
                                ? 'Synced'
                                : 'Sync Now'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/80 flex items-center justify-between">
            <span className="text-sm text-slate-400">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-slate-600 rounded bg-slate-800 text-white disabled:opacity-50 hover:bg-slate-700 transition-colors">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 border border-slate-600 rounded bg-slate-800 text-white disabled:opacity-50 hover:bg-slate-700 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Move Match to Series Modal */}
      {movingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-400" />
                Move Match #{movingMatch.id} to Series
              </h3>
              <button
                type="button"
                onClick={() => setMovingMatch(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-300">
              Reassign match <span className="text-white font-medium">#{movingMatch.id}</span> ({movingMatch.team_a?.name || 'TBD'} vs {movingMatch.team_b?.name || 'TBD'}) to an existing series to repair a split series.
            </p>

            <div className="text-xs text-slate-400 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50">
              Current Series: <span className="text-amber-300 font-mono">#{movingMatch.series_id ?? 'None'}</span> {movingMatch.best_of ? `(Bo${movingMatch.best_of})` : ''}
            </div>

            {loadingSeries ? (
              <div className="py-6 text-center text-slate-400 text-sm animate-pulse">
                Loading available series in gameweek...
              </div>
            ) : seriesOptions.length === 0 ? (
              <div className="py-4 text-center text-slate-400 text-sm">
                No tournament series found for this gameweek.
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Destination Series
                </label>
                <select
                  value={selectedTargetSeriesId ?? ''}
                  onChange={(e) => setSelectedTargetSeriesId(parseInt(e.target.value) || null)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select destination series...</option>
                  {seriesOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      Series #{s.id}: {s.team_a?.name || 'TBD'} vs {s.team_b?.name || 'TBD'} [Bo{s.best_of ?? 3}] ({s.match_count} game{s.match_count === 1 ? '' : 's'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setMovingMatch(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedTargetSeriesId && movingMatch) {
                    void handleConfirmMoveMatch(movingMatch.id, selectedTargetSeriesId);
                  }
                }}
                disabled={!selectedTargetSeriesId || patchingMatchId !== null || selectedTargetSeriesId === movingMatch.series_id}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {patchingMatchId !== null ? 'Moving...' : 'Confirm Move'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
