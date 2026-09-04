'use client';

import { useState, useEffect } from 'react';

type ChipType = 'triple-captain' | 'bench-boost' | null;

export default function LineupsPage() {
  const [tcStatus, setTcStatus] = useState<any>(null);
  const [bbStatus, setBbStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ChipType>(null);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fantasySeasonId, setFantasySeasonId] = useState<number | null>(null);
  const [gameweekId, setGameweekId] = useState<number | null>(null);
  const [lineup, setLineup] = useState<any[]>([]);
  const [ownedPlayers, setOwnedPlayers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchChipStatuses() {
      try {
        setLoading(true);
        const [dashboardResponse, gameweekResponse] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch('/api/gameweeks?status=active'),
        ]);

        if (!dashboardResponse.ok) throw new Error('Failed to load fantasy season');
        const dashboardData = await dashboardResponse.json();
        const currentFantasySeasonId = dashboardData.fantasySeasonId;
        setFantasySeasonId(currentFantasySeasonId);

        const gameweekData = await gameweekResponse.json();
        const activeGameweek = gameweekData.gameweeks?.[0];
        if (activeGameweek) {
          setGameweekId(activeGameweek.id);
        }

        if (currentFantasySeasonId && activeGameweek) {
          const [lineupResponse, playersResponse, contextResponse, tcRes, bbRes] = await Promise.all([
            fetch(`/api/fantasy/lineup?gameweekId=${activeGameweek.id}&fantasySeasonId=${currentFantasySeasonId}`),
            fetch('/api/players?limit=100'),
            fetch('/api/fantasy/transfer-context'),
            fetch(`/api/fantasy/triple-captain/status?fantasy_season_id=${currentFantasySeasonId}`),
            fetch(`/api/fantasy/bench-boost/status?fantasy_season_id=${currentFantasySeasonId}`),
          ]);
          const lineupData = await lineupResponse.json();
          const playersData = await playersResponse.json();
          const contextData = await contextResponse.json();
          setLineup(lineupData.lineup || []);
          setOwnedPlayers((playersData.data || []).filter((player: any) => (contextData.ownedPlayerIds || []).includes(player.id)));
          setTcStatus(await tcRes.json());
          setBbStatus(await bbRes.json());
        }
      } catch (err) {
        console.error('Failed to fetch chip statuses', err);
      } finally {
        setLoading(false);
      }
    }
    fetchChipStatuses();
  }, []);

  const updateSlot = (slot: string, playerId: number) => {
    const player = ownedPlayers.find((entry) => entry.id === playerId);
    setLineup((current) => [
      ...current.filter((entry) => entry.slot !== slot),
      { slot, player_id: playerId, is_starter: !slot.startsWith('bench'), is_captain: false, is_vice_captain: false, professional_players: player },
    ]);
  };

  const setCaptain = (playerId: number, vice = false) => {
    setLineup((current) => current.map((entry) => ({
      ...entry,
      is_captain: !vice && entry.player_id === playerId,
      is_vice_captain: vice && entry.player_id === playerId,
    })));
  };

  const saveLineup = async () => {
    if (!gameweekId || lineup.length !== 8) {
      setError('Fill every lineup slot before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/fantasy/lineup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameweekId, lineup: lineup.map((entry) => ({ playerId: entry.player_id, slot: entry.slot, isCaptain: entry.is_captain, isViceCaptain: entry.is_vice_captain })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save lineup');
      setMessage(data.message || 'Lineup saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lineup');
    } finally {
      setSaving(false);
    }
  };

  const openModal = (chip: ChipType) => {
    setMessage(null);
    setError(null);
    setActiveModal(chip);
  };

  const handleActivate = async () => {
    if (!activeModal) return;
    if (!fantasySeasonId) {
      setError('Create a fantasy squad before activating a chip.');
      return;
    }
    setActivating(true);
    setMessage(null);
    setError(null);

    const isTripleCaptain = activeModal === 'triple-captain';
    const endpoint = isTripleCaptain ? '/api/fantasy/triple-captain' : '/api/fantasy/bench-boost';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fantasySeasonId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Failed to activate ${isTripleCaptain ? 'Triple Captain' : 'Bench Boost'}`);
      }

      setMessage(data.message);
      if (isTripleCaptain) {
        setTcStatus({ ...tcStatus, tripleCaptainUsed: true, tripleCaptainGameweekId: data.gameweekId });
      } else {
        setBbStatus({ ...bbStatus, benchBoostUsed: true, benchBoostGameweekId: data.gameweekId });
      }
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setActivating(false);
      setActiveModal(null);
    }
  };

  const SpinnerIcon = () => (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Lineups</h1>
      <p className="text-slate-400 mb-8">Set your starting XI for each gameweek</p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main content */}
        <div className="lg:col-span-3">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Gameweek Lineup</h2>
                <p className="text-sm text-slate-400">Active gameweek {gameweekId ?? 'not available'}</p>
              </div>
              <button
                type="button"
                data-guide="lineup-save-btn"
                onClick={saveLineup}
                disabled={saving || lineup.length !== 8}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving...' : 'Save Lineup'}
              </button>
            </div>

            {loading ? (
              <div className="py-16 text-center text-slate-400">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3"></div>
                <p className="text-sm">Loading lineup...</p>
              </div>
            ) : ownedPlayers.length === 0 ? (
              <div data-guide="lineup-empty" className="py-16 text-center text-slate-400">
                Create a squad and add eight players before setting a lineup.
              </div>
            ) : (
              <div className="space-y-8">
                {/* Starting 5 */}
                <div data-guide="lineup-starters">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                      Starting Five (Active)
                    </h3>
                    <span className="text-xs text-slate-400">Active point scorers</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {['carry', 'mid', 'offlane', 'support', 'hard_support'].map((slot, index) => {
                      const selected = lineup.find((entry) => entry.slot === slot);
                      return (
                        <div
                          key={slot}
                          data-guide={index === 0 ? 'lineup-first-slot' : undefined}
                          className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 transition-colors"
                        >
                          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">
                            {slot.replace('_', ' ')}
                          </label>
                          <select
                            value={selected?.player_id ?? ''}
                            onChange={(event) => updateSlot(slot, Number(event.target.value))}
                            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                          >
                            <option value="">Select player</option>
                            {ownedPlayers.map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.in_game_name || player.name} · {player.primary_role}
                              </option>
                            ))}
                          </select>
                          <div
                            data-guide={index === 0 ? 'lineup-captain-controls' : undefined}
                            className="mt-3 flex items-center gap-2"
                          >
                            <button
                              type="button"
                              disabled={!selected}
                              onClick={() => selected && setCaptain(selected.player_id, false)}
                              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                selected?.is_captain
                                  ? 'bg-amber-500 text-slate-900 font-bold shadow'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed'
                              }`}
                            >
                              Captain (2x)
                            </button>
                            <button
                              type="button"
                              disabled={!selected}
                              onClick={() => selected && setCaptain(selected.player_id, true)}
                              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                selected?.is_vice_captain
                                  ? 'bg-slate-200 text-slate-900 font-bold shadow'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed'
                              }`}
                            >
                              Vice
                            </button>
                            {selected?.is_captain && (
                              <span className="text-[11px] font-semibold text-amber-400 ml-1">2x Points</span>
                            )}
                            {selected?.is_vice_captain && (
                              <span className="text-[11px] font-semibold text-slate-300 ml-1">Backup</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bench Substitutes */}
                <div data-guide="lineup-bench" className="border-t border-slate-700/70 pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                      Bench Substitutes (Reserves)
                    </h3>
                    <span className="text-xs text-slate-400">Auto-sub in order if starters miss</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {['bench_1', 'bench_2', 'bench_3'].map((slot, index) => {
                      const selected = lineup.find((entry) => entry.slot === slot);
                      return (
                        <div
                          key={slot}
                          data-guide={index === 0 ? 'lineup-first-bench' : undefined}
                          className="rounded-lg border border-slate-700 bg-slate-900/40 p-4"
                        >
                          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                            {slot.replace('_', ' ')}
                          </label>
                          <select
                            value={selected?.player_id ?? ''}
                            onChange={(event) => updateSlot(slot, Number(event.target.value))}
                            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                          >
                            <option value="">Select player</option>
                            {ownedPlayers.map((player) => (
                              <option key={player.id} value={player.id}>
                                {player.in_game_name || player.name} · {player.primary_role}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chips sidebar */}
        <div data-guide="lineup-chips" className="lg:col-span-1 space-y-4">
          {/* Triple Captain */}
          <div className="lineup-chip-card lineup-chip-purple bg-purple-900/20 border border-purple-700/50 rounded-xl p-5">
            <h3 className="font-semibold text-purple-400 mb-2 text-sm flex items-center justify-between">
              Triple Captain
              <span className="text-xl">🌟</span>
            </h3>
            {loading ? (
              <p className="text-xs text-slate-400">Loading...</p>
            ) : tcStatus?.tripleCaptainUsed ? (
              <div>
                <p className="text-xs text-slate-400 mb-2">Already played this season.</p>
                <div className="bg-purple-900/40 text-purple-300 text-xs text-center py-2 rounded border border-purple-700/30">
                  Used in GW {tcStatus.tripleCaptainGameweekId}
                </div>
              </div>
            ) : (
              <div>
                <p className="lineup-chip-description text-xs text-purple-200/70 mb-3">Triple your captain's points for one gameweek.</p>
                <button
                  onClick={() => openModal('triple-captain')}
                  className="w-full bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 text-purple-400 text-xs font-bold py-2 rounded-lg transition-colors"
                >
                  Play Triple Captain
                </button>
              </div>
            )}
          </div>

          {/* Bench Boost */}
          <div className="lineup-chip-card lineup-chip-emerald bg-emerald-900/20 border border-emerald-700/50 rounded-xl p-5">
            <h3 className="font-semibold text-emerald-400 mb-2 text-sm flex items-center justify-between">
              Bench Boost
              <span className="text-xl">⚡</span>
            </h3>
            {loading ? (
              <p className="text-xs text-slate-400">Loading...</p>
            ) : bbStatus?.benchBoostUsed ? (
              <div>
                <p className="text-xs text-slate-400 mb-2">Already played this season.</p>
                <div className="bg-emerald-900/40 text-emerald-300 text-xs text-center py-2 rounded border border-emerald-700/30">
                  Used in GW {bbStatus.benchBoostGameweekId}
                </div>
              </div>
            ) : (
              <div>
                <p className="lineup-chip-description text-xs text-emerald-200/70 mb-3">Your bench players also score points for one gameweek.</p>
                <button
                  onClick={() => openModal('bench-boost')}
                  className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/50 text-emerald-400 text-xs font-bold py-2 rounded-lg transition-colors"
                >
                  Play Bench Boost
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chip Activation Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className={`bg-slate-900 border rounded-xl shadow-2xl max-w-md w-full overflow-hidden ${
            activeModal === 'triple-captain'
              ? 'border-purple-500/30'
              : 'border-emerald-500/30'
          }`}>
            {/* Modal header */}
            <div className={`px-6 py-4 border-b ${
              activeModal === 'triple-captain'
                ? 'bg-purple-900/40 border-purple-500/20'
                : 'bg-emerald-900/40 border-emerald-500/20'
            }`}>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-2xl">{activeModal === 'triple-captain' ? '🌟' : '⚡'}</span>
                {activeModal === 'triple-captain' ? 'Activate Triple Captain' : 'Activate Bench Boost'}
              </h2>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4">
              {activeModal === 'triple-captain' ? (
                <p className="text-slate-300 text-sm leading-relaxed">
                  Your captain will earn <strong className="text-purple-400">3x points</strong> instead of the usual 2x for the upcoming gameweek.
                </p>
              ) : (
                <p className="text-slate-300 text-sm leading-relaxed">
                  All three of your bench players will <strong className="text-emerald-400">score their full points</strong> for the upcoming gameweek, in addition to your starting five.
                </p>
              )}

              <div className="bg-amber-900/20 border border-amber-700/30 rounded p-3 text-xs text-amber-200/80">
                <strong>Warning:</strong> You can only use this chip once per season. This action cannot be undone once the gameweek deadline passes.
              </div>

              {error && <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded">{error}</div>}
              {message && <div className="text-emerald-400 text-sm bg-emerald-900/20 p-2 rounded">{message}</div>}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 bg-slate-800 flex justify-end gap-3 border-t border-slate-700">
              <button
                onClick={() => setActiveModal(null)}
                disabled={activating || !!message}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleActivate}
                disabled={activating || !!message}
                className={`text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${
                  activeModal === 'triple-captain'
                    ? 'bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20'
                }`}
              >
                {activating ? (
                  <><SpinnerIcon /> Activating...</>
                ) : message ? 'Activated!' : 'Confirm Activation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
