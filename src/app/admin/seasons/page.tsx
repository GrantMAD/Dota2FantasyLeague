'use client';

import { useState, useEffect } from 'react';
import { Calendar, Plus, ChevronDown, Check, X, Loader2, Clock } from 'lucide-react';

interface GameweekRecord {
  id: number;
  season_id: number;
  gameweek_number: number;
  start_date: string | null;
  end_date: string | null;
  deadline_date: string | null;
  status: string;
}

interface SeasonRecord {
  id: number;
  name: string;
  status: 'planning' | 'active' | 'ended' | 'archived';
  start_date: string | null;
  end_date: string | null;
  gameweeks: GameweekRecord[];
}

type UiStatus = 'planning' | 'active' | 'ended' | 'archived';

const STATUS_LABELS: Record<UiStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  ended: 'Ended',
  archived: 'Archived',
};

const STATUS_STYLES: Record<UiStatus, string> = {
  planning: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
  active: 'bg-green-500/10 text-green-400 border-green-500/30',
  ended: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  archived: 'bg-slate-700/50 text-slate-500 border-slate-600',
};

const STATUS_CYCLE: UiStatus[] = ['planning', 'active', 'ended', 'archived'];

function formatDate(d: string | null) {
  if (!d) return 'N/A';
  try {
    return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
}

// ─── New Season Modal ─────────────────────────────────────────────────────────
function NewSeasonModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: SeasonRecord) => void }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Season name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          status: 'planning',
          start_date: startDate || null,
          end_date: endDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to create season.'); return; }
      const created = Array.isArray(json.data) ? json.data[0] : json.data;
      onCreated({ ...created, gameweeks: [] });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-slate-700">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-400" /> New Season
            </h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">Season Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. DPC Season 2026"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1.5">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 text-sm transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Season'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Season Card ──────────────────────────────────────────────────────────────
function SeasonCard({ season, onStatusChange }: { season: SeasonRecord; onStatusChange: (id: number, status: UiStatus) => void }) {
  const [updating, setUpdating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function cycleStatus() {
    const idx = STATUS_CYCLE.indexOf(season.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    setUpdating(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'season', id: season.id, status: next }),
      });
      if (res.ok) onStatusChange(season.id, next);
    } catch {
      console.error('Failed to update season status');
    } finally {
      setUpdating(false);
    }
  }

  const gwList = season.gameweeks.sort((a, b) => a.gameweek_number - b.gameweek_number);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
      {/* Card header */}
      <div className="p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Calendar className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-white">{season.name}</h3>
              <span className={`rounded border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[season.status]}`}>
                {STATUS_LABELS[season.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {formatDate(season.start_date)} → {formatDate(season.end_date)}
            </p>
            {gwList.length > 0 && (
              <p className="mt-0.5 text-xs text-slate-500">{gwList.length} gameweek{gwList.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {gwList.length > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 text-sm transition-colors"
            >
              <Clock className="w-4 h-4" />
              Gameweeks
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button
            onClick={cycleStatus}
            disabled={updating}
            className="flex items-center gap-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 px-4 py-2 font-medium text-amber-400 text-sm transition-colors disabled:opacity-60"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Update Status
          </button>
        </div>
      </div>

      {/* Gameweeks expandable */}
      {expanded && gwList.length > 0 && (
        <div className="border-t border-slate-700 divide-y divide-slate-700/50">
          <div className="px-5 py-2 bg-slate-800/80 grid grid-cols-4 text-xs text-slate-500 uppercase tracking-wider">
            <span>GW</span><span>Start</span><span>End</span><span>Status</span>
          </div>
          {gwList.map(gw => (
            <div key={gw.id} className="px-5 py-2.5 grid grid-cols-4 text-sm hover:bg-slate-700/20 transition-colors">
              <span className="text-white font-medium">GW{gw.gameweek_number}</span>
              <span className="text-slate-400">{formatDate(gw.start_date)}</span>
              <span className="text-slate-400">{formatDate(gw.end_date)}</span>
              <span className={`capitalize text-xs font-medium ${
                gw.status === 'active' ? 'text-green-400' :
                gw.status === 'upcoming' ? 'text-amber-400' :
                gw.status === 'completed' ? 'text-blue-400' : 'text-slate-500'
              }`}>{gw.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminSeasonsPage() {
  const [seasons, setSeasons] = useState<SeasonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSeasons() {
      try {
        const res = await fetch('/api/admin/settings');
        if (!res.ok) { setError('Failed to load seasons.'); return; }
        const json = await res.json();
        const rawSeasons: any[] = Array.isArray(json.seasons) ? json.seasons : [];
        const rawGameweeks: GameweekRecord[] = Array.isArray(json.gameweeks) ? json.gameweeks : [];

        setSeasons(
          rawSeasons.map((s: any) => ({
            id: s.id,
            name: s.name,
            status: (['planning', 'active', 'ended', 'archived'].includes(s.status) ? s.status : 'planning') as UiStatus,
            start_date: s.start_date ?? null,
            end_date: s.end_date ?? null,
            gameweeks: rawGameweeks.filter(gw => gw.season_id === s.id),
          }))
        );
      } catch {
        setError('Network error loading seasons.');
      } finally {
        setLoading(false);
      }
    }
    loadSeasons();
  }, []);

  function handleStatusChange(id: number, status: UiStatus) {
    setSeasons(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }

  function handleCreated(season: SeasonRecord) {
    setSeasons(prev => [season, ...prev]);
    setShowNew(false);
  }

  const activeCount = seasons.filter(s => s.status === 'active').length;
  const planningCount = seasons.filter(s => s.status === 'planning').length;
  const endedCount = seasons.filter(s => s.status === 'ended' || s.status === 'archived').length;

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Calendar className="h-8 w-8 text-amber-400" />Seasons Management
          </h1>
          <p className="mt-1 text-slate-400">Create and manage fantasy season lifecycle</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 px-4 py-2 font-semibold text-slate-900 text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> New Season
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: 'Active', value: activeCount, color: 'text-green-400' },
          { label: 'Planning', value: planningCount, color: 'text-amber-400' },
          { label: 'Ended / Archived', value: endedCount, color: 'text-slate-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading seasons…
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
          {error}
        </div>
      ) : seasons.length === 0 ? (
        <div className="py-16 text-center text-slate-500 bg-slate-800/30 border border-slate-700 rounded-xl">
          No seasons found. Create your first season to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {seasons.map(season => (
            <SeasonCard key={season.id} season={season} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}

      {showNew && <NewSeasonModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}
    </div>
  );
}
