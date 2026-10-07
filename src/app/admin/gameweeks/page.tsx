'use client';

import { useState, useEffect, useCallback } from 'react';
import { Gamepad2, RefreshCw, ChevronDown, ChevronUp, Swords, Flag, Database, Clock, Hash, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/Toast';


interface GameweekRecord {
  id: number;
  name: string;
  /** Display status (maps DB active → live, closed → closed) */
  status: 'upcoming' | 'live' | 'locked' | 'closed';
  /** Raw DB status */
  dbStatus: 'upcoming' | 'active' | 'locked' | 'closed';
  startDate: string;
  endDate: string;
  deadline: string;
  matchCount: number;
  topScorer: { name: string; in_game_name?: string | null; total_points: number } | null;
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

interface GameweekApiRecord {
  id: number;
  gameweek_number: number;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  deadline?: string | null;
  match_count?: number;
  top_scorer?: { name: string; in_game_name?: string | null; total_points: number } | null;
}

const statusStyles: Record<GameweekRecord['status'], string> = {
  upcoming: 'bg-gray-500/10 text-gray-300 border-gray-500/30',
  live: 'bg-green-500/10 text-green-400 border-green-500/30',
  locked: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  closed: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
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
  closed: 'closed',
};

/** Cycle: upcoming → active → locked → closed → upcoming */
const NEXT_DB_STATUS: Record<GameweekRecord['dbStatus'], GameweekRecord['dbStatus']> = {
  upcoming: 'active',
  active: 'locked',
  locked: 'closed',
  closed: 'upcoming',
};

const NEXT_LABEL: Record<GameweekRecord['dbStatus'], string> = {
  upcoming: 'Activate',
  active: 'Lock',
  locked: 'Close',
  closed: 'Reset to Upcoming',
};

function formatDate(val: unknown) {
  if (!val) return '—';
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function getTransitionLabel(
  currentStatus: GameweekRecord['dbStatus'],
  nextStatus: GameweekRecord['dbStatus'],
) {
  if (nextStatus === 'active') return 'Activate';
  if (nextStatus === 'locked') return 'Lock';
  if (nextStatus === 'closed') return 'Close';
  return currentStatus === 'closed' ? 'Reset to Upcoming' : 'Update Status';
}

export default function AdminGameweeksPage() {
  const toast = useToast();
  const [gameweeks, setGameweeks] = useState<GameweekRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycling, setCycling] = useState<number | null>(null);
  const [pendingTransition, setPendingTransition] = useState<{
    gameweek: GameweekRecord;
    status: GameweekRecord['dbStatus'];
  } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<number, GameweekDetail>>({});
  const [detailsLoading, setDetailsLoading] = useState<number | null>(null);

  const loadGameweeks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gameweeks');
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json.gameweeks) ? json.gameweeks : [];
        setGameweeks(
          items.map((g: GameweekApiRecord) => {
            const dbStatus: GameweekRecord['dbStatus'] =
              g.status === 'active' ? 'active'
              : g.status === 'locked' ? 'locked'
              : g.status === 'closed' ? 'closed'
              : 'upcoming';
            return {
              id: g.id,
              name: `GW${g.gameweek_number}`,
              status: DB_TO_DISPLAY[dbStatus] ?? 'upcoming',
              dbStatus,
              startDate: g.start_date ? new Date(g.start_date).toLocaleDateString() : 'TBD',
              endDate: g.end_date ? new Date(g.end_date).toLocaleDateString() : 'TBD',
              deadline: g.deadline ? new Date(g.deadline).toLocaleString() : 'TBD',
              matchCount: g.match_count ?? 0,
              topScorer: g.top_scorer ?? null,
            };
          })
        );
      }
    } catch (err) {
      console.error('Failed to load gameweeks', err);
      toast.error('Load Error', 'Failed to load gameweeks');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // This effect intentionally loads external data when the admin page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadGameweeks(); }, [loadGameweeks]);

  const applyStatusTransition = async () => {
    if (!pendingTransition) return;
    const { gameweek, status: nextDbStatus } = pendingTransition;
    setCycling(gameweek.id);
    try {
      const res = await fetch(`/api/admin/gameweeks/${gameweek.id}`, {
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
        toast.success(
          'Gameweek Transitioned',
          `${gameweek.name} is now ${DB_TO_DISPLAY[nextDbStatus]?.toUpperCase()}.`
        );
      } else {
        const json = await res.json();
        console.error('Failed to cycle status', json);
        toast.error('Transition Failed', json.error || `Could not cycle ${gameweek.name} status`);
      }
    } catch (err) {
      console.error('Error cycling status', err);
      toast.error('Transition Error', `Network error updating ${gameweek.name}`);
    } finally {
      setCycling(null);
      setPendingTransition(null);
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Live" value={gameweeks.filter((g) => g.status === 'live').length} />
        <StatCard label="Upcoming" value={gameweeks.filter((g) => g.status === 'upcoming').length} />
        <StatCard label="Locked" value={gameweeks.filter((g) => g.status === 'locked').length} />
        <StatCard label="Closed" value={gameweeks.filter((g) => g.status === 'closed').length} />
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading gameweeks">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3"><div className="h-6 w-36 animate-pulse rounded bg-gray-700/60" /><div className="h-5 w-20 animate-pulse rounded bg-gray-700/50" /></div>
                    <div className="h-4 w-full max-w-md animate-pulse rounded bg-gray-700/40" />
                    <div className="h-3 w-64 max-w-full animate-pulse rounded bg-gray-700/40" />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="h-9 w-32 animate-pulse rounded bg-gray-700/50" />
                    <div className="h-9 w-36 animate-pulse rounded bg-gray-700/50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : gameweeks.map((gameweek) => {
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
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span>{gameweek.matchCount} match{gameweek.matchCount !== 1 ? 'es' : ''}</span>
                    {gameweek.topScorer && (
                      <span>
                        Top scorer: <span className="text-amber-400 font-medium">{gameweek.topScorer.in_game_name ?? gameweek.topScorer.name}</span>
                        <span className="ml-1 text-gray-400">{gameweek.topScorer.total_points.toFixed(2)} pts</span>
                      </span>
                    )}
                    {!gameweek.topScorer && gameweek.dbStatus === 'closed' && (
                      <span className="text-gray-600 italic">No scorer data yet</span>
                    )}
                  </div>
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
                  {gameweek.dbStatus === 'active' && (
                    <button
                      onClick={() => setPendingTransition({ gameweek, status: 'closed' })}
                      disabled={cycling === gameweek.id}
                      className="rounded border border-red-500/40 px-4 py-2 font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Close
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setPendingTransition({
                        gameweek,
                        status: NEXT_DB_STATUS[gameweek.dbStatus],
                      })
                    }
                    disabled={cycling === gameweek.id}
                    className="flex w-44 items-center justify-center gap-2 rounded bg-amber-500/20 px-4 py-2 font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 shrink-0 ${cycling === gameweek.id ? 'animate-spin' : ''}`} />
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
                    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading gameweek details">
                      <section>
                        <div className="mb-3 h-4 w-32 rounded bg-gray-500/20" />
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                          {Array.from({ length: 8 }).map((_, index) => (
                            <div key={index} className="space-y-2">
                              <div className="h-3 w-20 rounded bg-gray-500/20" />
                              <div className="h-4 w-full rounded bg-gray-500/15" />
                            </div>
                          ))}
                        </div>
                      </section>
                      <section>
                        <div className="mb-3 h-4 w-28 rounded bg-gray-500/20" />
                        <div className="space-y-2">
                          {Array.from({ length: 2 }).map((_, index) => (
                            <div key={index} className="h-12 rounded bg-gray-500/15" />
                          ))}
                        </div>
                      </section>
                      <section>
                        <div className="mb-3 h-4 w-24 rounded bg-gray-500/20" />
                        <div className="flex gap-2"><div className="h-8 w-28 rounded bg-gray-500/15" /><div className="h-8 w-24 rounded bg-gray-500/15" /></div>
                      </section>
                    </div>
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
                                  <Hash className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
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

      {pendingTransition && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && cycling === null) setPendingTransition(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gameweek-transition-title"
            className="w-full max-w-md rounded-xl border border-amber-500/30 bg-slate-900 p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" />
              <div>
                <h2 id="gameweek-transition-title" className="text-lg font-semibold text-white">
                  Confirm {getTransitionLabel(pendingTransition.gameweek.dbStatus, pendingTransition.status)}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Change {pendingTransition.gameweek.name} from{' '}
                  <span className="font-semibold text-white">{pendingTransition.gameweek.dbStatus}</span> to{' '}
                  <span className="font-semibold text-amber-300">{pendingTransition.status}</span>?
                  Gameweek status affects lineup locking and scoring.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingTransition(null)}
                disabled={cycling !== null}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void applyStatusTransition()}
                disabled={cycling !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {cycling !== null && <RefreshCw className="h-4 w-4 animate-spin" />}
                {cycling !== null ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
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
