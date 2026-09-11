'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Settings,
  Calendar,
  Clock,
  Coins,
  Users,
  Shield,
  Zap,
  Activity,
  Database,
  CheckCircle2,
  AlertTriangle,
  Save,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  SlidersHorizontal,
} from 'lucide-react';

interface Season {
  id: number;
  name: string;
  slug?: string;
  status: 'planning' | 'active' | 'ended' | 'archived';
  start_date: string;
  end_date: string;
  starting_budget?: number;
  max_players_per_team?: number;
  squad_size?: number;
  starters_required?: number;
  bench_size?: number;
}

interface Gameweek {
  id: number;
  season_id: number;
  gameweek_number: number;
  start_date: string;
  end_date: string;
  deadline_date: string;
  status: string;
  is_international_break?: boolean;
}

export default function AdminSettingsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSeasonId, setSavingSeasonId] = useState<number | null>(null);
  const [savingGwId, setSavingGwId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Editable form state for seasons
  const [seasonEdits, setSeasonEdits] = useState<Record<number, Partial<Season>>>({});

  // Editable deadline overrides & international break flags (keyed by gameweek id)
  const [deadlineOverrides, setDeadlineOverrides] = useState<Record<number, string>>({});
  const [breakOverrides, setBreakOverrides] = useState<Record<number, boolean>>({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        const loadedSeasons: Season[] = data.seasons || [];
        const loadedGameweeks: Gameweek[] = data.gameweeks || [];

        setSeasons(loadedSeasons);
        setGameweeks(loadedGameweeks);

        // Initialise season edit state with current database values
        const sEdits: Record<number, Partial<Season>> = {};
        loadedSeasons.forEach(s => {
          sEdits[s.id] = {
            status: s.status,
            starting_budget: s.starting_budget ?? 100000000,
            max_players_per_team: s.max_players_per_team ?? 3,
            squad_size: s.squad_size ?? 8,
            starters_required: s.starters_required ?? 5,
            bench_size: s.bench_size ?? 3,
          };
        });
        setSeasonEdits(sEdits);

        // Initialise gameweek overrides
        const dOverrides: Record<number, string> = {};
        const bOverrides: Record<number, boolean> = {};
        loadedGameweeks.forEach((gw: Gameweek) => {
          // Format ISO datetime string for datetime-local input safely
          try {
            const dt = new Date(gw.deadline_date);
            if (!isNaN(dt.getTime())) {
              // Convert to local YYYY-MM-DDTHH:mm
              const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
              dOverrides[gw.id] = localIso;
            } else {
              dOverrides[gw.id] = gw.deadline_date?.slice(0, 16) || '';
            }
          } catch {
            dOverrides[gw.id] = gw.deadline_date?.slice(0, 16) || '';
          }
          bOverrides[gw.id] = Boolean(gw.is_international_break);
        });
        setDeadlineOverrides(dOverrides);
        setBreakOverrides(bOverrides);
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4500);
  };

  const handleSeasonFieldChange = (seasonId: number, field: keyof Season, val: any) => {
    setSeasonEdits(prev => ({
      ...prev,
      [seasonId]: {
        ...prev[seasonId],
        [field]: val,
      },
    }));
  };

  const saveSeasonSettings = async (seasonId: number) => {
    const edit = seasonEdits[seasonId];
    if (!edit) return;

    setSavingSeasonId(seasonId);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'season',
          id: seasonId,
          status: edit.status,
          starting_budget: edit.starting_budget,
          max_players_per_team: edit.max_players_per_team,
          squad_size: edit.squad_size,
          starters_required: edit.starters_required,
          bench_size: edit.bench_size,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`Season rules & status saved successfully.`, 'success');
        setSeasons(prev => prev.map(s => s.id === seasonId ? { ...s, ...edit } : s));
      } else {
        showMessage(data.error || 'Failed to update season rules.', 'error');
      }
    } catch (err) {
      showMessage('Network error while saving season rules.', 'error');
    } finally {
      setSavingSeasonId(null);
    }
  };

  const updateGameweekDeadlineAndBreak = async (gameweekId: number) => {
    const localVal = deadlineOverrides[gameweekId];
    const isBreak = breakOverrides[gameweekId];

    if (!localVal) return;

    // Convert local datetime input back to standard ISO UTC string
    let isoString: string;
    try {
      const localDate = new Date(localVal);
      isoString = localDate.toISOString();
    } catch {
      isoString = localVal + ':00Z';
    }

    setSavingGwId(gameweekId);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'gameweek',
          id: gameweekId,
          deadline_date: isoString,
          is_international_break: isBreak,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`Gameweek ${gameweeks.find(g => g.id === gameweekId)?.gameweek_number ?? ''} configuration saved.`, 'success');
        setGameweeks(prev => prev.map(g => g.id === gameweekId ? { ...g, deadline_date: isoString, is_international_break: isBreak } : g));
      } else {
        showMessage(data.error || 'Failed to update gameweek settings.', 'error');
      }
    } catch (err) {
      showMessage('Network error while saving gameweek settings.', 'error');
    } finally {
      setSavingGwId(null);
    }
  };

  const getSeasonStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'planning': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'ended': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
      case 'archived': return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-28">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white tracking-tight">
            <Settings className="h-8 w-8 text-amber-400" /> Admin Settings & Governance
          </h1>
          <p className="mt-1 text-slate-400 text-sm">
            Configure season lifecycles, squad rules, roster limits, gameweek deadlines, and global platform controls.
          </p>
        </div>

        {/* Quick Jump Buttons to Operational Consoles */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/admin/observability"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" /> Observability
          </Link>
          <Link
            href="/admin/data-jobs"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Data Jobs
          </Link>
          <Link
            href="/admin/audit"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-blue-400" /> Audit Log
          </Link>
        </div>
      </div>

      {/* Notifications Message */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2.5 transition-all ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Quick Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Seasons</p>
              <p className="text-2xl font-bold text-white mt-0.5">{seasons.length}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Seasons</p>
              <p className="text-2xl font-bold text-emerald-400 mt-0.5">
                {seasons.filter(s => s.status === 'active').length}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Upcoming / Active GWs</p>
              <p className="text-2xl font-bold text-white mt-0.5">{gameweeks.length}</p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">International Breaks</p>
              <p className="text-2xl font-bold text-purple-300 mt-0.5">
                {gameweeks.filter(g => breakOverrides[g.id] ?? g.is_international_break).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Season Lifecycle & Squad Governance */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-700 bg-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-amber-400" /> Season Lifecycle & Competition Rules
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Advance season status and govern global fantasy constraints (starting budget, team limits, and roster slots).
            </p>
          </div>
          <Link
            href="/admin/seasons"
            className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0"
          >
            Create Season <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="p-5 space-y-6">
          {seasons.length === 0 ? (
            <p className="text-slate-400 text-sm">No seasons configured in database.</p>
          ) : (
            seasons.map(season => {
              const edit = seasonEdits[season.id] || {};
              const isSaving = savingSeasonId === season.id;

              return (
                <div
                  key={season.id}
                  className="p-5 bg-slate-900/50 rounded-xl border border-slate-700/70 hover:border-slate-600/80 transition-all space-y-4"
                >
                  {/* Season Title and Status Control */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-base font-bold text-white tracking-wide">{season.name}</span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${getSeasonStatusColor(edit.status || season.status)}`}>
                          {edit.status || season.status}
                        </span>
                        {season.slug && (
                          <span className="text-xs text-slate-500 font-mono">({season.slug})</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Active Period: {new Date(season.start_date).toLocaleDateString()} — {new Date(season.end_date).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-slate-300">Status:</label>
                        <select
                          value={edit.status || season.status}
                          onChange={(e) => handleSeasonFieldChange(season.id, 'status', e.target.value)}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500 text-xs font-medium disabled:opacity-60"
                        >
                          <option value="planning">Planning</option>
                          <option value="active">Active</option>
                          <option value="ended">Ended</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>

                      <button
                        onClick={() => saveSeasonSettings(season.id)}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-sm"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? 'Saving…' : 'Save Rules'}
                      </button>
                    </div>
                  </div>

                  {/* Season Rules Parameter Grid */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-400" /> Squad Budget & Roster Parameters
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {/* Starting Budget */}
                      <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-lg">
                        <label className="text-xs text-slate-400 block mb-1">Starting Budget ($M)</label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 text-xs font-bold">$</span>
                          <input
                            type="number"
                            step="1000000"
                            min="50000000"
                            max="200000000"
                            value={((edit.starting_budget ?? 100000000) / 1000000).toFixed(1)}
                            onChange={(e) => handleSeasonFieldChange(season.id, 'starting_budget', Math.round(parseFloat(e.target.value || '100') * 1000000))}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                          />
                          <span className="text-slate-400 text-xs">M</span>
                        </div>
                      </div>

                      {/* Same-Team Player Cap */}
                      <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-lg">
                        <label className="text-xs text-slate-400 block mb-1">Max Per Pro Team</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={edit.max_players_per_team ?? 3}
                          onChange={(e) => handleSeasonFieldChange(season.id, 'max_players_per_team', parseInt(e.target.value || '3', 10))}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Total Squad Size */}
                      <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-lg">
                        <label className="text-xs text-slate-400 block mb-1">Total Squad Slots</label>
                        <input
                          type="number"
                          min="5"
                          max="15"
                          value={edit.squad_size ?? 8}
                          onChange={(e) => handleSeasonFieldChange(season.id, 'squad_size', parseInt(e.target.value || '8', 10))}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Starters Required */}
                      <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-lg">
                        <label className="text-xs text-slate-400 block mb-1">Starters Required</label>
                        <input
                          type="number"
                          min="3"
                          max="8"
                          value={edit.starters_required ?? 5}
                          onChange={(e) => handleSeasonFieldChange(season.id, 'starters_required', parseInt(e.target.value || '5', 10))}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Bench Size */}
                      <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-lg">
                        <label className="text-xs text-slate-400 block mb-1">Bench Reserves</label>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          value={edit.bench_size ?? 3}
                          onChange={(e) => handleSeasonFieldChange(season.id, 'bench_size', parseInt(e.target.value || '3', 10))}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Section 2: Gameweek Deadline Overrides & International Breaks */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-700 bg-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" /> Gameweek Deadlines & International Breaks
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              Adjust upcoming gameweek lock times or mark international/tier-event pauses to defer fantasy scoring.
            </p>
          </div>
          <Link
            href="/admin/gameweeks"
            className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0"
          >
            Gameweeks Console <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        <div className="p-5">
          {gameweeks.length === 0 ? (
            <p className="text-slate-400 text-sm">No upcoming or active gameweeks found.</p>
          ) : (
            <div className="space-y-3">
              {gameweeks.map(gw => {
                const isSaving = savingGwId === gw.id;
                const isBreak = breakOverrides[gw.id] ?? false;

                return (
                  <div
                    key={gw.id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-900/40 rounded-xl border border-slate-700/60 hover:border-slate-600/70 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold text-sm tracking-wide">Gameweek {gw.gameweek_number}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${
                          gw.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        }`}>
                          {gw.status}
                        </span>
                        {isBreak && (
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                            <PauseCircle className="w-3 h-3" /> International Break
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Gameweek Span: {new Date(gw.start_date).toLocaleDateString()} — {new Date(gw.end_date).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* International Break Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isBreak}
                          onChange={(e) => setBreakOverrides(prev => ({ ...prev, [gw.id]: e.target.checked }))}
                          className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        <span className="text-xs text-slate-300 font-medium">International Break</span>
                      </label>

                      {/* Deadline Local Datetime Input */}
                      <div className="flex flex-col">
                        <label className="text-xs text-slate-400 mb-1">Transfer & Lineup Deadline</label>
                        <input
                          type="datetime-local"
                          value={deadlineOverrides[gw.id] || ''}
                          onChange={(e) => setDeadlineOverrides(prev => ({ ...prev, [gw.id]: e.target.value }))}
                          className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500 text-xs font-mono"
                        />
                      </div>

                      {/* Save Action */}
                      <button
                        onClick={() => updateGameweekDeadlineAndBreak(gw.id)}
                        disabled={isSaving}
                        className="sm:mt-5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 justify-center"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
