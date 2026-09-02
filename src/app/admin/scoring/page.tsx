'use client';

import { useState, useEffect } from 'react';

export default function AdminScoringPage() {
  const [activeTab, setActiveTab] = useState<'rules' | 'balance' | 'historical' | 'simulator'>('rules');
  const [ruleVersions, setRuleVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balanceReport, setBalanceReport] = useState<any>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [historicalReport, setHistoricalReport] = useState<any>(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalRange, setHistoricalRange] = useState({ seasonId: '1', gameweekFrom: '', gameweekTo: '' });

  // Simulator state
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [simForm, setSimForm] = useState({
    matchId: '1',
    playerId: '1',
    teamId: '1',
    duration_minutes: 40,
    winner_team_id: 1,
    kills: 0,
    deaths: 0,
    assists: 0,
    gold_per_minute: 0,
    experience_per_minute: 0,
    last_hits: 0,
    denies: 0,
    hero_damage: 0,
    tower_damage: 0,
    healing: 0,
    wards_placed: 0,
    wards_destroyed: 0,
    roshan_kills: 0
  });

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/scoring/rules');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const versions = Object.values(data).sort((a: any, b: any) => b.version - a.version);
      setRuleVersions(versions);
      
      if (!selectedVersion && versions.length > 0) {
        setSelectedVersion((versions[0] as any).version);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleCreateDraft = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/scoring/rules', { method: 'POST', body: JSON.stringify({}) });
      if (!res.ok) throw new Error('Failed to create draft version');
      await fetchRules();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleUpdateRule = async (ruleId: number, field: string, value: any) => {
    try {
      const res = await fetch(`/api/admin/scoring/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      if (!res.ok) throw new Error('Failed to update rule');
      
      // Update local state instead of full refetch for better UX
      setRuleVersions(prev => prev.map(v => {
        if (v.version !== selectedVersion) return v;
        return {
          ...v,
          rules: v.rules.map((r: any) => r.id === ruleId ? { ...r, [field]: value } : r)
        };
      }));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePublish = async () => {
    const gameweekId = prompt('Enter the Gameweek ID from which this version should be effective (e.g., 2):');
    if (!gameweekId) return;

    try {
      setLoading(true);
      const res = await fetch('/api/admin/scoring/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: selectedVersion, gameweekId })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to publish');
      }
      await fetchRules();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimLoading(true);
    setSimResult(null);
    setError(null);
    
    try {
      const res = await fetch('/api/admin/scoring/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: simForm.matchId,
          playerId: simForm.playerId,
          teamId: simForm.teamId,
          metrics: {
            ...simForm,
            winner_team_id: simForm.winner_team_id
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSimResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSimLoading(false);
    }
  };

  const fetchBalanceReport = async () => {
    setBalanceLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scoring/balance?seasonId=1');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load balance report');
      setBalanceReport(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBalanceLoading(false);
    }
  };

  const runHistoricalSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setHistoricalLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scoring/historical-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: Number(historicalRange.seasonId),
          gameweekFrom: historicalRange.gameweekFrom ? Number(historicalRange.gameweekFrom) : undefined,
          gameweekTo: historicalRange.gameweekTo ? Number(historicalRange.gameweekTo) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Historical simulation failed');
      setHistoricalReport(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setHistoricalLoading(false);
    }
  };

  const handleSimChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSimForm(prev => ({ ...prev, [name]: Number(value) }));
  };

  const currentVersionData = ruleVersions.find(v => v.version === selectedVersion);
  const isDraft = currentVersionData && !currentVersionData.is_published;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Scoring Management</h1>
        <p className="mt-1 text-slate-400">Manage rules versions and simulate outcomes</p>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-4 rounded-lg">
          {error}
          <button className="float-right text-red-200 hover:text-white" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'rules' ? 'bg-slate-800 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
          }`}
        >
          Rule Versions
        </button>
        <button
          onClick={() => { setActiveTab('balance'); if (!balanceReport) fetchBalanceReport(); }}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'balance' ? 'bg-slate-800 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
          }`}
        >
          Balance Analytics
        </button>
        <button
          onClick={() => setActiveTab('historical')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'historical' ? 'bg-slate-800 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
          }`}
        >
          Historical Simulation
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'simulator' ? 'bg-slate-800 text-white border-b-2 border-blue-500' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
          }`}
        >
          Simulator
        </button>
      </div>

      {activeTab === 'balance' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div>
              <h2 className="text-lg font-semibold text-white">Role Balance Analytics</h2>
              <p className="text-sm text-slate-400">Historical scoring distribution, market value, ownership, and captain impact.</p>
            </div>
            <button onClick={fetchBalanceReport} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded">Refresh</button>
          </div>
          {balanceLoading ? <div className="text-center p-12 text-slate-400">Loading analytics...</div> : balanceReport && (
            <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-800/50"><tr>{['Role', 'Samples', 'Average', 'Median', 'Bottom 10%', 'Top 10%', 'Avg Price', 'Ownership', 'Price / Point', 'Captain Impact'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">{heading}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {balanceReport.report.map((row: any) => <tr key={row.role}>
                    <td className="px-4 py-3 text-sm font-medium text-white">{row.role}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{row.sampleSize}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{row.averagePoints.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{row.medianPoints.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{row.bottomTenPercentPoints.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-400">{row.topTenPercentPoints.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{row.averagePrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{row.averageOwnershipPercentage.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{row.averagePriceToPointRatio.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-blue-400">{row.captainImpact.toFixed(2)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'historical' && (
        <div className="space-y-6">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white">Historical Scoring Simulation</h2>
            <p className="text-sm text-slate-400 mt-1">Replays stored performances with the selected published rules. Live scoring data is never modified.</p>
            <form onSubmit={runHistoricalSimulation} className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5">
              <input aria-label="Season ID" type="number" min="1" value={historicalRange.seasonId} onChange={(e) => setHistoricalRange({ ...historicalRange, seasonId: e.target.value })} className="bg-slate-900 border border-slate-700 rounded p-2 text-white" placeholder="Season ID" />
              <input aria-label="Gameweek from" type="number" min="1" value={historicalRange.gameweekFrom} onChange={(e) => setHistoricalRange({ ...historicalRange, gameweekFrom: e.target.value })} className="bg-slate-900 border border-slate-700 rounded p-2 text-white" placeholder="Gameweek from" />
              <input aria-label="Gameweek to" type="number" min="1" value={historicalRange.gameweekTo} onChange={(e) => setHistoricalRange({ ...historicalRange, gameweekTo: e.target.value })} className="bg-slate-900 border border-slate-700 rounded p-2 text-white" placeholder="Gameweek to" />
              <button type="submit" disabled={historicalLoading} className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded">{historicalLoading ? 'Running...' : 'Run Historical Simulation'}</button>
            </form>
          </div>
          {historicalReport && <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4"><div className="text-xs text-slate-400">Performances</div><div className="text-2xl text-white font-semibold">{historicalReport.playerPerformances}</div></div>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4"><div className="text-xs text-slate-400">Average Points</div><div className="text-2xl text-white font-semibold">{historicalReport.totals.averagePoints.toFixed(2)}</div></div>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4"><div className="text-xs text-slate-400">Highest Points</div><div className="text-2xl text-emerald-400 font-semibold">{historicalReport.totals.highestPoints.toFixed(2)}</div></div>
            </div>
            <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800"><thead className="bg-slate-800/50"><tr><th className="px-4 py-3 text-left text-xs text-slate-400 uppercase">Role</th><th className="px-4 py-3 text-left text-xs text-slate-400 uppercase">Samples</th><th className="px-4 py-3 text-left text-xs text-slate-400 uppercase">Average</th><th className="px-4 py-3 text-left text-xs text-slate-400 uppercase">Median</th><th className="px-4 py-3 text-left text-xs text-slate-400 uppercase">Top 10%</th></tr></thead>
                <tbody className="divide-y divide-slate-800">{historicalReport.roleBreakdown.map((row: any) => <tr key={row.role}><td className="px-4 py-3 text-sm text-white">{row.role}</td><td className="px-4 py-3 text-sm text-slate-300">{row.sampleSize}</td><td className="px-4 py-3 text-sm text-slate-300">{row.averagePoints.toFixed(2)}</td><td className="px-4 py-3 text-sm text-slate-300">{row.medianPoints.toFixed(2)}</td><td className="px-4 py-3 text-sm text-emerald-400">{row.topTenPercentPoints.toFixed(2)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>}
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex justify-between items-center bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center space-x-4">
              <label className="text-sm text-slate-400">Select Version:</label>
              <select 
                value={selectedVersion || ''} 
                onChange={(e) => setSelectedVersion(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 text-white rounded p-2 text-sm"
              >
                {ruleVersions.map(v => (
                  <option key={v.version} value={v.version}>
                    Version {v.version} {v.is_published ? '(Published)' : '(Draft)'}
                  </option>
                ))}
              </select>
              
              {currentVersionData && (
                <span className={`text-xs px-2 py-1 rounded-full ${isDraft ? 'bg-amber-900/50 text-amber-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
                  {isDraft ? 'DRAFT' : `Active from GW ${currentVersionData.effective_from_gameweek_id}`}
                </span>
              )}
            </div>
            
            <div className="flex space-x-3">
              {isDraft ? (
                <button 
                  onClick={handlePublish}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-4 py-2 rounded shadow transition"
                >
                  Publish Version {selectedVersion}
                </button>
              ) : (
                <button 
                  onClick={handleCreateDraft}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded shadow transition"
                >
                  Create New Draft
                </button>
              )}
            </div>
          </div>

          {/* Rules Table */}
          {loading ? (
            <div className="text-center p-12 text-slate-400">Loading rules...</div>
          ) : currentVersionData && (
            <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Rule</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                  {currentVersionData.rules.map((rule: any) => (
                    <tr key={rule.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{rule.rule_name}</div>
                        <div className="text-xs text-slate-500 font-mono">{rule.rule_key}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isDraft ? (
                          <input 
                            type="number"
                            step="0.0001"
                            value={rule.value}
                            onChange={(e) => handleUpdateRule(rule.id, 'value', parseFloat(e.target.value))}
                            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white w-24 focus:border-blue-500 focus:outline-none"
                          />
                        ) : (
                          <span className="text-sm text-slate-300">{rule.value}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isDraft ? (
                          <button
                            onClick={() => handleUpdateRule(rule.id, 'is_enabled', !rule.is_enabled)}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              rule.is_enabled ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {rule.is_enabled ? 'Enabled' : 'Disabled'}
                          </button>
                        ) : (
                          <span className={`px-2 py-1 rounded-full text-xs ${rule.is_enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {rule.is_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Input Metrics</h3>
            <form onSubmit={handleSimulate} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Match Duration (min)</label>
                  <input type="number" name="duration_minutes" value={simForm.duration_minutes} onChange={handleSimChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Player Team ID vs Winner Team ID</label>
                  <div className="flex gap-2">
                    <input type="number" name="teamId" value={simForm.teamId} onChange={handleSimChange} className="w-1/2 bg-slate-900 border border-slate-700 rounded p-2 text-white" title="Player Team ID" />
                    <input type="number" name="winner_team_id" value={simForm.winner_team_id} onChange={handleSimChange} className="w-1/2 bg-slate-900 border border-slate-700 rounded p-2 text-white" title="Winner Team ID" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-700">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Kills</label>
                  <input type="number" name="kills" value={simForm.kills} onChange={handleSimChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Deaths</label>
                  <input type="number" name="deaths" value={simForm.deaths} onChange={handleSimChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Assists</label>
                  <input type="number" name="assists" value={simForm.assists} onChange={handleSimChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">GPM</label>
                  <input type="number" name="gold_per_minute" value={simForm.gold_per_minute} onChange={handleSimChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">XPM</label>
                  <input type="number" name="experience_per_minute" value={simForm.experience_per_minute} onChange={handleSimChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Last Hits</label>
                  <input type="number" name="last_hits" value={simForm.last_hits} onChange={handleSimChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Denies</label>
                  <input type="number" name="denies" value={simForm.denies} onChange={handleSimChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Hero Dmg</label>
                  <input type="number" name="hero_damage" value={simForm.hero_damage} onChange={handleSimChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tower Dmg</label>
                  <input type="number" name="tower_damage" value={simForm.tower_damage} onChange={handleSimChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Healing</label>
                  <input type="number" name="healing" value={simForm.healing} onChange={handleSimChange} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                </div>
              </div>

              <button type="submit" disabled={simLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg mt-4 transition">
                {simLoading ? 'Simulating...' : 'Run Simulation'}
              </button>
            </form>
          </div>

          {/* Results Output */}
          <div className="bg-slate-900 rounded-lg border border-slate-700 p-6 font-mono">
            <h3 className="text-lg font-semibold text-white font-sans mb-4">Simulation Output</h3>
            
            {simResult ? (
              <div className="space-y-2 text-slate-300">
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Combat</span>
                  <span className={simResult.combat > 0 ? 'text-emerald-400' : ''}>{simResult.combat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Economy</span>
                  <span className={simResult.economy > 0 ? 'text-emerald-400' : ''}>{simResult.economy.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Objectives</span>
                  <span className={simResult.objective > 0 ? 'text-emerald-400' : ''}>{simResult.objective.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Teamfight</span>
                  <span className={simResult.teamfight > 0 ? 'text-emerald-400' : ''}>{simResult.teamfight.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Win</span>
                  <span className={simResult.win > 0 ? 'text-emerald-400' : ''}>{simResult.win.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Series</span>
                  <span className={simResult.series > 0 ? 'text-emerald-400' : ''}>{simResult.series.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Performance</span>
                  <span className={simResult.performance > 0 ? 'text-emerald-400' : ''}>{simResult.performance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span>Consistency</span>
                  <span className={simResult.consistency > 0 ? 'text-emerald-400' : ''}>{simResult.consistency.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-700 pb-2 mb-2">
                  <span>Penalties</span>
                  <span className={simResult.penalty < 0 ? 'text-red-400' : ''}>{simResult.penalty.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between text-lg font-bold text-white pt-2">
                  <span>TOTAL</span>
                  <span className="text-blue-400">
                    {(simResult.combat + simResult.economy + simResult.objective + simResult.teamfight + 
                      simResult.win + simResult.series + simResult.performance + simResult.consistency + simResult.penalty).toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-slate-500 text-sm">
                Run a simulation to see the breakdown
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
