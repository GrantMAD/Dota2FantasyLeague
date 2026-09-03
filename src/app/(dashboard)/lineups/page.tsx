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

  useEffect(() => {
    async function fetchChipStatuses() {
      try {
        const dashboardResponse = await fetch('/api/dashboard/stats');
        if (!dashboardResponse.ok) throw new Error('Failed to load fantasy season');
        const dashboardData = await dashboardResponse.json();
        const currentFantasySeasonId = dashboardData.fantasySeasonId;
        setFantasySeasonId(currentFantasySeasonId);

        if (!currentFantasySeasonId) return;

        const [tcRes, bbRes] = await Promise.all([
          fetch(`/api/fantasy/triple-captain/status?fantasy_season_id=${currentFantasySeasonId}`),
          fetch(`/api/fantasy/bench-boost/status?fantasy_season_id=${currentFantasySeasonId}`),
        ]);
        setTcStatus(await tcRes.json());
        setBbStatus(await bbRes.json());
      } catch (err) {
        console.error('Failed to fetch chip statuses', err);
      } finally {
        setLoading(false);
      }
    }
    fetchChipStatuses();
  }, []);

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
      setTimeout(() => setActiveModal(null), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActivating(false);
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
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center h-full flex flex-col justify-center">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Active Lineups</h3>
            <p className="text-slate-400">Create a squad first to set your lineups</p>
          </div>
        </div>

        {/* Chips sidebar */}
        <div className="lg:col-span-1 space-y-4">
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
