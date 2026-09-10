'use client';

import { useState, useEffect } from 'react';
import { Gamepad2, RefreshCw, ChevronDown, ChevronUp, Swords, Flag, Database, Clock, Hash } from 'lucide-react';


interface GameweekRecord {
  id: number;
  name: string;
  /** Display status (maps DB active → live) */
  status: 'upcoming' | 'live' | 'locked';
  /** Raw DB status */
  dbStatus: 'upcoming' | 'active' | 'locked';
  startDate: string;
  endDate: string;
  deadline: string;
}

interface GameweekDetail {
  gameweek: Record<string, unknown>;
  matches: Array<{
    id: number;
    status: string;
    scheduled_at: string | null;
    radiant_team_id: number;
    dire_team_id: number;
    winner_team_id: number | null;
    duration_seconds: number | null;
    professional_teams?: { id: number; name: string; tag?: string } | null;
    dire_team?: { id: number; name: string; tag?: string } | null;
  }>;
  teamFlags: Array<{
    id: number;
    flag: string;
    team_id: number;
    professional_teams?: { id: number; name: string; tag?: string } | null;
  }>;
}

const statusStyles: Record<GameweekRecord['status'], string> = {
  upcoming: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
  live: 'bg-green-500/10 text-green-400 border-green-500/30',
  locked: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

const matchStatusStyles: Record<string, string> = {
  scheduled: 'text-gray-400',
  live: 'text-green-400',
  completed: 'text-blue-400',
  cancelled: 'text-red-400',
};

/** DB status → display label */
const DB_TO_DISPLAY: Record<string, GameweekRecord['status']> = {
  upcoming: 'upcoming',
  active: 'live',
  locked: 'locked',
};

/** Cycle: upcoming → active → locked → upcoming */
const NEXT_DB_STATUS: Record<GameweekRecord['dbStatus'], GameweekRecord['dbStatus']> = {
  upcoming: 'active',
  active: 'locked',
  locked: 'upcoming',
};

const NEXT_LABEL: Record<GameweekRecord['dbStatus'], string> = {
  upcoming: 'Set Live',
  active: 'Lock',
  locked: 'Reset to Upcoming',
};

function formatDate(val: unknown) {
  if (!val) return '—';
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminGameweeksPage() {
  const [gameweeks, setGameweeks] = useState<GameweekRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycling, setCycling] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<number, GameweekDetail>>({});
  const [detailsLoading, setDetailsLoading] = useState<number | null>(null);

  async function loadGameweeks() {
    setLoading(true);
    try {
      const res = await fetch('/api/gameweeks');
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json.gameweeks) ? json.gameweeks : [];
        setGameweeks(
          items.map((g: any) => {
            const dbStatus: GameweekRecord['dbStatus'] =
              g.status === 'active' ? 'active' : g.status === 'locked' ? 'locked' : 'upcoming';
            return {
              id: g.id,
              name: `GW${g.gameweek_number}`,
              status: DB_TO_DISPLAY[dbStatus] ?? 'upcoming',
              dbStatus,
              startDate: g.start_date ? new Date(g.start_date).toLocaleDateString() : 'TBD',
              endDate: g.end_date ? new Date(g.end_date).toLocaleDateString() : 'TBD',
              deadline: g.deadline ? new Date(g.deadline).toLocaleString() : 'TBD',
            };
          })
        );
      }
    } catch (err) {
      console.error('Failed to load gameweeks', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadGameweeks(); }, []);

  const cycleStatus = async (gameweek: GameweekRecord) => {
    const nextDbStatus = NEXT_DB_STATUS[gameweek.dbStatus];
    setCycling(gameweek.id);
    try {
      const res = await fetch(`/api/gameweeks/${gameweek.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextDbStatus }),
      });
      if (res.ok) {
        setGameweeks((prev) =>
          prev.map((gw) =>
            gw.id === gameweek.id
              ? { ...gw, dbStatus: nextDbStatus, status: DB_TO_DISPLAY[nextDbStatus] }
              : gw
          )
        );
      } else {
        const json = await res.json().catch(() => ({}));
        console.error('Failed to cycle status', json);
      }
    } catch (err) {
      console.error('Error cycling status', err);
    } finally {
      setCycling(null);
    }
  };

  const toggleDetails = async (gameweek: GameweekRecord) => {
    if (expandedId === gameweek.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(gameweek.id);
    if (detailsCache[gameweek.id]) return; // already fetched
    setDetailsLoading(gameweek.id);
    try {
      const res = await fetch(`/api/gameweeks/${gameweek.id}`);
      if (res.ok) {
        const json = await res.json();
        setDetailsCache((prev) => ({ ...prev, [gameweek.id]: json }));
      }
    } catch (err) {
      console.error('Failed to load gameweek details', err);
    } finally {
      setDetailsLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Gamepad2 className="h-8 w-8 text-amber-400" />
            Gameweeks
          </h1>
          <p className="mt-1 text-gray-400">Manage fantasy gameweek schedule and deadlines</p>
        </div>
        <button
          onClick={() => loadGameweeks()}
          className="flex items-center gap-2 rounded bg-gray-700/60 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Live" value={gameweeks.filter((g) => g.status === 'live').length} />
        <StatCard label="Upcoming" value={gameweeks.filter((g) => g.status === 'upcoming').length} />
        <StatCard label="Locked" value={gameweeks.filter((g) => g.status === 'locked').length} />
      </div>

      {loading && <p className="text-center text-gray-400">Loading gameweeks…</p>}

      <div className="space-y-3">
        {gameweeks.map((gameweek) => {
          const isExpanded = expandedId === gameweek.id;
          const isLoadingDetails = detailsLoading === gameweek.id;
          const detail = detailsCache[gameweek.id];

          return (
            <div
              key={gameweek.id}
              className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800/50"
            >
              {/* ── Summary row ── */}
              <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-white">{gameweek.name}</h3>
                    <span className={`rounded border px-2 py-1 text-xs font-medium ${statusStyles[gameweek.status]}`}>
                      {gameweek.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">
                    {gameweek.startDate}
                    {gameweek.endDate !== 'TBD' && ` – ${gameweek.endDate}`}
                    <span className="mx-2 text-gray-600">•</span>
                    Deadline: {gameweek.deadline}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Details toggle */}
                  <button
                    onClick={() => toggleDetails(gameweek)}
                    className="flex w-32 items-center justify-center gap-2 rounded border border-gray-600 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700"
                  >
                    {isLoadingDetails
                      ? <RefreshCw className="h-4 w-4 animate-spin" />
                      : isExpanded
                        ? <><ChevronUp className="h-4 w-4" /> Hide</>
                        : <><ChevronDown className="h-4 w-4" /> Details</>
                    }
                  </button>

                  {/* Next-status hint — fixed width so it lines up across rows */}
                  <span className="hidden w-24 text-right text-xs text-gray-500 lg:block">
                    → {NEXT_DB_STATUS[gameweek.dbStatus]}
                  </span>
                  <button
                    onClick={() => cycleStatus(gameweek)}
                    disabled={cycling === gameweek.id}
                    className="flex w-44 items-center justify-center gap-2 rounded bg-amber-500/20 px-4 py-2 font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 flex-shrink-0 ${cycling === gameweek.id ? 'animate-spin' : ''}`} />
                    {cycling === gameweek.id ? 'Saving…' : NEXT_LABEL[gameweek.dbStatus]}
                  </button>
                </div>
              </div>

              {/* ── Details panel ── */}
              {isExpanded && (
                <div
                  className="border-t p-5 space-y-6"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}
                >
                  {isLoadingDetails && (
                    <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading details…</p>
                  )}

                  {detail && (
                    <>
                      {/* Raw fields */}
                      <section>
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          <Database className="h-4 w-4" /> Gameweek Data
                        </h4>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-3 lg:grid-cols-4">
                          {Object.entries(detail.gameweek).map(([key, val]) => (
                            <div key={key} className="flex flex-col gap-0.5">
                              <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{key}</span>
                              <span className="break-all" style={{ color: 'var(--text-secondary)' }}>
                                {val === null || val === undefined ? '—' : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>

                      {/* Matches */}
                      <section>
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          <Swords className="h-4 w-4" /> Matches ({detail.matches.length})
                        </h4>
                        {detail.matches.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No matches scheduled.</p>
                        ) : (
                          <div className="space-y-2">
                            {detail.matches.map((match) => (
                              <div
                                key={match.id}
                                className="flex flex-col gap-2 rounded p-3 text-sm md:flex-row md:items-center md:justify-between"
                                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
                              >
                                <div className="flex items-center gap-3">
                                  <Hash className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                                  <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{match.id}</span>
                                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {match.professional_teams?.name ?? `Team ${match.radiant_team_id}`}
                                  </span>
                                  <span style={{ color: 'var(--text-muted)' }}>vs</span>
                                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {match.dire_team?.name ?? `Team ${match.dire_team_id}`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  {match.scheduled_at && (
                                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                      <Clock className="h-3 w-3" />
                                      {formatDate(match.scheduled_at)}
                                    </span>
                                  )}
                                  <span className={`text-xs font-medium ${matchStatusStyles[match.status] ?? 'text-gray-400'}`}>
                                    {match.status}
                                  </span>
                                  {match.winner_team_id && (
                                    <span className="text-xs text-amber-400">
                                      Winner: {
                                        match.winner_team_id === match.radiant_team_id
                                          ? (match.professional_teams?.name ?? 'Radiant')
                                          : (match.dire_team?.name ?? 'Dire')
                                      }
                                    </span>
                                  )}
                                  {match.duration_seconds != null && (
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                      {Math.floor(match.duration_seconds / 60)}m
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      {/* Team flags */}
                      <section>
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          <Flag className="h-4 w-4" /> Team Flags ({detail.teamFlags.length})
                        </h4>
                        {detail.teamFlags.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No flags set.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {detail.teamFlags.map((tf) => (
                              <div
                                key={tf.id}
                                className="flex items-center gap-2 rounded px-3 py-1.5 text-sm"
                                style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
                              >
                                <span
                                  className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                                    tf.flag === 'double' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/10 text-red-400'
                                  }`}
                                >
                                  {tf.flag}
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  {tf.professional_teams?.name ?? `Team ${tf.team_id}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!loading && gameweeks.length === 0 && (
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-12 text-center text-gray-400">
            No gameweeks found.
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
