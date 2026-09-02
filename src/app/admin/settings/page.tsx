'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Season {
  id: number;
  name: string;
  status: 'planning' | 'active' | 'ended' | 'archived';
  start_date: string;
  end_date: string;
}

interface Gameweek {
  id: number;
  season_id: number;
  gameweek_number: number;
  start_date: string;
  end_date: string;
  deadline_date: string;
  status: string;
}

export default function AdminSettingsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Editable deadline overrides (keyed by gameweek id)
  const [deadlineOverrides, setDeadlineOverrides] = useState<Record<number, string>>({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSeasons(data.seasons || []);
        setGameweeks(data.gameweeks || []);
        // Initialise override map with current deadlines
        const overrides: Record<number, string> = {};
        (data.gameweeks || []).forEach((gw: Gameweek) => {
          overrides[gw.id] = gw.deadline_date;
        });
        setDeadlineOverrides(overrides);
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
    setTimeout(() => setMessage(null), 4000);
  };

  const updateSeasonStatus = async (seasonId: number, status: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'season', id: seasonId, status }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`Season status updated to "${status}".`, 'success');
        setSeasons(prev => prev.map(s => s.id === seasonId ? { ...s, status: status as Season['status'] } : s));
      } else {
        showMessage(data.error || 'Failed to update season.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const updateGameweekDeadline = async (gameweekId: number) => {
    const deadline = deadlineOverrides[gameweekId];
    if (!deadline) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'gameweek', id: gameweekId, deadline_date: deadline }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`Gameweek deadline updated.`, 'success');
      } else {
        showMessage(data.error || 'Failed to update deadline.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const getSeasonStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'planning': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'ended': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
      case 'archived': return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Admin Settings</h1>
        <p className="mt-1 text-slate-400">Manage season lifecycle, gameweek deadlines, and global controls.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border text-sm ${message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
          {message.text}
        </div>
      )}

      {/* Section 1: Season Lifecycle */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="p-5 border-b border-slate-700 bg-slate-800/80">
          <h2 className="text-lg font-semibold text-white">Season Lifecycle</h2>
          <p className="text-sm text-slate-400 mt-1">Advance or revert a season through its lifecycle stages.</p>
        </div>
        <div className="p-5 space-y-4">
          {seasons.length === 0 ? (
            <p className="text-slate-400 text-sm">No seasons found.</p>
          ) : (
            seasons.map(season => (
              <div key={season.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-900/40 rounded-lg border border-slate-700/50">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium">{season.name}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getSeasonStatusColor(season.status)}`}>{season.status}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(season.start_date).toLocaleDateString()} — {new Date(season.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    defaultValue={season.status}
                    onChange={(e) => updateSeasonStatus(season.id, e.target.value)}
                    disabled={saving}
                    className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500 text-sm disabled:opacity-60"
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="ended">Ended</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Section 2: Gameweek Deadline Overrides */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="p-5 border-b border-slate-700 bg-slate-800/80">
          <h2 className="text-lg font-semibold text-white">Gameweek Deadline Overrides</h2>
          <p className="text-sm text-slate-400 mt-1">Extend or adjust upcoming gameweek deadlines for emergency pauses or rescheduled matches.</p>
        </div>
        <div className="p-5">
          {gameweeks.length === 0 ? (
            <p className="text-slate-400 text-sm">No upcoming or active gameweeks found.</p>
          ) : (
            <div className="space-y-3">
              {gameweeks.map(gw => (
                <div key={gw.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-900/40 rounded-lg border border-slate-700/50">
                  <div>
                    <p className="text-white font-medium">Gameweek {gw.gameweek_number}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${gw.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>{gw.status}</span>
                      &nbsp;&bull;&nbsp;{new Date(gw.start_date).toLocaleDateString()} — {new Date(gw.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <label className="text-xs text-slate-400 mb-1">Deadline</label>
                      <input
                        type="datetime-local"
                        value={deadlineOverrides[gw.id] ? deadlineOverrides[gw.id].slice(0, 16) : ''}
                        onChange={(e) => setDeadlineOverrides(prev => ({ ...prev, [gw.id]: e.target.value + ':00Z' }))}
                        className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => updateGameweekDeadline(gw.id)}
                      disabled={saving}
                      className="mt-5 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-semibold text-sm rounded-lg transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
