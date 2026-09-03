'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TransfersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [fantasySeasonId, setFantasySeasonId] = useState<number | null>(null);
  const [budget, setBudget] = useState(0);
  const [freeTransfers, setFreeTransfers] = useState(0);
  const [wildcardUsed, setWildcardUsed] = useState(false);
  const [ownedPlayerIds, setOwnedPlayerIds] = useState<number[]>([]);
  const [selectedPlayerIn, setSelectedPlayerIn] = useState<number | null>(null);
  const [selectedPlayerOut, setSelectedPlayerOut] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Player Detail Modal state
  const [modalPlayer, setModalPlayer] = useState<any | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const [playersRes, contextRes] = await Promise.all([
          fetch('/api/players?limit=100'),
          fetch('/api/fantasy/transfer-context'),
        ]);
        const data = await playersRes.json();
        const context = await contextRes.json();
        if (!playersRes.ok) throw new Error(data.error || 'Failed to load players');
        if (!contextRes.ok) throw new Error(context.error || 'Failed to load transfer context');
        setPlayers(data.data || []);
        setFantasySeasonId(context.fantasySeasonId);
        setBudget(context.budget || 0);
        setFreeTransfers(context.freeTransfers || 0);
        setWildcardUsed(context.wildcardUsed || false);
        setOwnedPlayerIds(context.ownedPlayerIds || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load players');
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, []);

  const openPlayerModal = async (playerSummary: any) => {
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
    return true;
  });

  const handlePlayerAction = (playerId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (ownedPlayerIds.includes(playerId)) {
      setSelectedPlayerOut(selectedPlayerOut === playerId ? null : playerId);
    } else {
      setSelectedPlayerIn(selectedPlayerIn === playerId ? null : playerId);
    }
  };

  const submitTransfer = async () => {
    if (!fantasySeasonId || selectedPlayerIn === null || selectedPlayerOut === null) {
      setActionMessage('Select one player to buy and one player to sell.');
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch('/api/fantasy/transfer', {
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
      setActionMessage(data.message || 'Transfer completed.');
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setActionLoading(false);
    }
  };

  const activateWildcard = async () => {
    if (!fantasySeasonId) {
      setActionMessage('Create a fantasy team before using the wildcard.');
      return;
    }
    setActionLoading(true);
    try {
      const response = await fetch('/api/fantasy/wildcard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fantasySeasonId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Wildcard activation failed');
      setWildcardUsed(true);
      setFreeTransfers(99);
      setActionMessage(data.message || 'Wildcard activated.');
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Wildcard activation failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Transfer Market</h1>
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
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
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
            </div>
          </div>

          <div className="wildcard-card bg-amber-900/20 border border-amber-700/50 rounded-xl p-5">
            <h3 className="wildcard-card-title font-semibold text-amber-500 mb-2 text-sm">Wildcard Available</h3>
            <p className="wildcard-card-description text-xs text-amber-200/70 mb-3">{wildcardUsed ? 'Wildcard already used this season.' : 'Play it to make unlimited transfers this week with no point deductions.'}</p>
            <button disabled={wildcardUsed || actionLoading} onClick={activateWildcard} className="wildcard-card-action w-full bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/50 text-amber-500 text-xs font-bold py-2 rounded-lg transition-colors disabled:opacity-50">
              {wildcardUsed ? 'Wildcard Used' : 'Play Wildcard'}
            </button>
          </div>

          {(selectedPlayerIn !== null || selectedPlayerOut !== null || actionMessage) && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-white mb-2">Pending Swaps</h4>
              <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                {selectedPlayerIn ? `Buying: ${players.find((p) => p.id === selectedPlayerIn)?.in_game_name || 'Player'}` : 'Select a player to buy.'}
                <br />
                {selectedPlayerOut ? `Selling: ${players.find((p) => p.id === selectedPlayerOut)?.in_game_name || 'Player'}` : 'Select an owned player to sell.'}
              </p>
              {actionMessage && <p className="text-xs text-amber-400 mb-3 bg-amber-500/10 p-2 rounded border border-amber-500/20">{actionMessage}</p>}
              <button disabled={actionLoading || selectedPlayerIn === null || selectedPlayerOut === null} onClick={submitTransfer} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50 shadow-md">
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
                  ) : filteredPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No players found matching your criteria.</td>
                    </tr>
                  ) : (
                    filteredPlayers.map((player) => (
                      <tr
                        key={player.id}
                        onClick={() => openPlayerModal(player)}
                        className="hover:bg-slate-700/40 transition-colors group cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 overflow-hidden shrink-0 flex items-center justify-center">
                              {player.profile_image_url ? (
                                <img src={player.profile_image_url} alt={player.in_game_name || player.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-slate-400">
                                  {(player.in_game_name || player.name || '').substring(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                                {player.in_game_name || player.name}
                                {ownedPlayerIds.includes(player.id) && (
                                  <span className="rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold px-1.5 py-0.2 border border-emerald-500/30">
                                    Owned
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">{player.professional_teams?.name || 'Free Agent'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block bg-slate-700/80 text-slate-300 text-[10px] uppercase font-bold px-2 py-1 rounded">
                            {player.primary_role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-mono font-bold text-amber-400">${player.current_price}M</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm text-slate-200 font-mono">{player.recent_points ?? '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-sm font-bold text-white font-mono">{player.gameweek_points ?? '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handlePlayerAction(player.id, e)}
                            className={`p-1.5 rounded-md transition-colors ${
                              ownedPlayerIds.includes(player.id)
                                ? selectedPlayerOut === player.id
                                  ? 'bg-red-600 text-white'
                                  : 'bg-slate-700 hover:bg-red-600 text-slate-200 hover:text-white'
                                : selectedPlayerIn === player.id
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 hover:bg-emerald-600 text-white'
                            }`}
                            title={ownedPlayerIds.includes(player.id) ? 'Select to sell' : 'Select to buy'}
                          >
                            {ownedPlayerIds.includes(player.id) ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
                    <img src={modalPlayer.profile_image_url} alt={modalPlayer.in_game_name || modalPlayer.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-slate-500">
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
                        {modalPlayer.performances.map((perf: any) => (
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
                <button
                  type="button"
                  onClick={() => setModalPlayer(null)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

