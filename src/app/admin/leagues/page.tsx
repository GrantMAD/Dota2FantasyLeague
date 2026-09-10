'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search, Shield, Users, Lock, Globe, X, Trophy,
  Hash, Calendar, Info, Swords, ChevronRight,
} from 'lucide-react';

interface Standing {
  userId: string;
  username: string;
  manager: string;
  points: number;
  gwPoints: number;
  rank: number | null;
  wins: number;
  losses: number;
  draws: number;
}

interface Fixture {
  id: number;
  gameweekId: number;
  home: string;
  away: string;
  homePoints: number;
  awayPoints: number;
  isBye: boolean;
}

interface AdminLeague {
  id: string;
  name: string;
  type: 'classic' | 'head_to_head';
  privacy: 'public' | 'private';
  ownerUsername: string;
  memberCount: number;
  maxMembers: number;
  status: 'active' | 'full' | 'completed';
  totalPoints: number;
  createdAt: string;
  inviteCode: string;
  description: string;
  standings: Standing[];
  fixtures: Fixture[];
}

const statusStyles: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  full: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  completed: 'bg-slate-700/50 text-slate-400 border-slate-600',
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Detail slide-over ───────────────────────────────────────────────────────
function LeagueDetailPanel({ league, onClose }: { league: AdminLeague; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-700 bg-slate-800/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{league.name}</h2>
              {league.description && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">{league.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Type', value: league.type === 'classic' ? 'Classic' : 'Head-to-Head', color: league.type === 'classic' ? 'text-blue-400' : 'text-purple-400' },
              { label: 'Status', value: league.status, color: league.status === 'active' ? 'text-green-400' : league.status === 'full' ? 'text-amber-400' : 'text-slate-400' },
              { label: 'Privacy', value: league.privacy === 'public' ? 'Public' : 'Private', color: league.privacy === 'public' ? 'text-blue-400' : 'text-slate-400' },
              { label: 'Members', value: `${league.memberCount} / ${league.maxMembers}`, color: 'text-white' },
              { label: 'Total Points', value: league.totalPoints.toLocaleString(), color: 'text-amber-400' },
              { label: 'Created', value: formatDate(league.createdAt), color: 'text-slate-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-sm font-semibold capitalize ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Invite code */}
          {league.inviteCode && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center gap-3">
              <Hash className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Invite Code</p>
                <p className="text-sm font-mono font-bold text-amber-400">{league.inviteCode}</p>
              </div>
            </div>
          )}

          {/* Standings */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
              <Trophy className="w-4 h-4 text-amber-400" />
              Standings
              <span className="text-xs text-slate-500 font-normal">({league.standings.length} members)</span>
            </h3>
            {league.standings.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6 bg-slate-800/30 rounded-lg border border-slate-700">No members yet.</p>
            ) : (
              <div className="rounded-lg border border-slate-700 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-800 text-slate-400 text-xs">
                      <th className="px-3 py-2 font-medium w-8">#</th>
                      <th className="px-3 py-2 font-medium">Manager</th>
                      <th className="px-3 py-2 font-medium text-right">Pts</th>
                      {league.type === 'head_to_head' && (
                        <>
                          <th className="px-3 py-2 font-medium text-right">W</th>
                          <th className="px-3 py-2 font-medium text-right">L</th>
                          <th className="px-3 py-2 font-medium text-right">D</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {[...league.standings]
                      .sort((a, b) => b.points - a.points)
                      .map((s, i) => (
                        <tr key={s.userId} className="text-sm hover:bg-slate-700/30 transition-colors">
                          <td className="px-3 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            <div>
                              <p className="text-white font-medium">{s.manager}</p>
                              <p className="text-slate-500 text-xs">@{s.username}</p>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-400">{s.points.toLocaleString()}</td>
                          {league.type === 'head_to_head' && (
                            <>
                              <td className="px-3 py-2.5 text-right text-green-400">{s.wins}</td>
                              <td className="px-3 py-2.5 text-right text-red-400">{s.losses}</td>
                              <td className="px-3 py-2.5 text-right text-slate-400">{s.draws}</td>
                            </>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* H2H Fixtures */}
          {league.type === 'head_to_head' && league.fixtures.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
                <Swords className="w-4 h-4 text-purple-400" />
                Fixtures
                <span className="text-xs text-slate-500 font-normal">({league.fixtures.length} matchups)</span>
              </h3>
              <div className="space-y-2">
                {league.fixtures.map((f) => (
                  <div key={f.id} className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 flex items-center gap-3 text-sm">
                    <span className="text-xs text-slate-500 shrink-0">GW{f.gameweekId}</span>
                    <span className={`flex-1 text-right font-medium ${!f.isBye && f.homePoints > f.awayPoints ? 'text-green-400' : 'text-white'}`}>
                      {f.home}
                    </span>
                    <div className="text-center shrink-0 px-2">
                      <span className="font-mono text-xs text-slate-300 bg-slate-700 px-2 py-0.5 rounded">
                        {f.homePoints} – {f.awayPoints}
                      </span>
                    </div>
                    <span className={`flex-1 font-medium ${f.isBye ? 'text-slate-500 italic' : !f.isBye && f.awayPoints > f.homePoints ? 'text-green-400' : 'text-white'}`}>
                      {f.isBye ? 'Bye' : f.away}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        .animate-slide-in { animation: slide-in 0.25s cubic-bezier(0.25,0.46,0.45,0.94) both; }
      `}</style>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminLeaguesPage() {
  const [leagues, setLeagues] = useState<AdminLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState('');
  const [selected, setSelected] = useState<AdminLeague | null>(null);

  useEffect(() => {
    async function loadLeagues() {
      try {
        const res = await fetch('/api/leagues');
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json.leagues) ? json.leagues : (Array.isArray(json) ? json : []);
          setLeagues(
            items.map((l: any) => ({
              id: String(l.id),
              name: l.name,
              type: l.type === 'h2h' ? 'head_to_head' : 'classic',
              privacy: l.privacyLevel === 'private' ? 'private' : 'public',
              ownerUsername: l.standings?.[0]?.username || 'admin',
              memberCount: l.currentParticipants || l.standings?.length || 0,
              maxMembers: l.maxParticipants || 32,
              status: (l.status === 'completed' ? 'completed' : (l.currentParticipants >= l.maxParticipants ? 'full' : 'active')) as any,
              totalPoints: (l.standings || []).reduce((acc: number, s: any) => acc + (s.points || 0), 0),
              createdAt: l.createdAt || new Date().toISOString(),
              inviteCode: l.inviteCode || '',
              description: l.description || '',
              standings: (l.standings || []).map((s: any) => ({
                userId: s.userId,
                username: s.username || 'unknown',
                manager: s.manager || s.username || 'Manager',
                points: Number(s.points || 0),
                gwPoints: Number(s.gwPoints || 0),
                rank: s.rank ?? null,
                wins: s.wins || 0,
                losses: s.losses || 0,
                draws: s.draws || 0,
              })),
              fixtures: (l.fixtures || []).map((f: any) => ({
                id: f.id,
                gameweekId: f.gameweekId,
                home: f.home || 'TBD',
                away: f.away || 'TBD',
                homePoints: Number(f.homePoints || 0),
                awayPoints: Number(f.awayPoints || 0),
                isBye: f.isBye || false,
              })),
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load leagues', err);
      } finally {
        setLoading(false);
      }
    }
    loadLeagues();
  }, []);

  const filtered = useMemo(() => {
    return leagues.filter((l) => {
      const matchesQuery = `${l.name} ${l.ownerUsername}`.toLowerCase().includes(query.toLowerCase());
      const matchesType = !typeFilter || l.type === typeFilter;
      const matchesPrivacy = !privacyFilter || l.privacy === privacyFilter;
      return matchesQuery && matchesType && matchesPrivacy;
    });
  }, [leagues, query, typeFilter, privacyFilter]);

  const totalMembers = leagues.reduce((s, l) => s + l.memberCount, 0);
  const publicCount = leagues.filter(l => l.privacy === 'public').length;
  const privateCount = leagues.filter(l => l.privacy === 'private').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-8">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold text-white"><Shield className="h-8 w-8 text-amber-400" />League Management</h1>
        <p className="mt-1 text-slate-400">Monitor and manage all active leagues across the platform.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Leagues</p>
          <p className="text-3xl font-bold text-white">{leagues.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Members</p>
          <p className="text-3xl font-bold text-amber-400">{totalMembers}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <p className="text-xs text-slate-400 uppercase tracking-wider">Public</p>
          </div>
          <p className="text-3xl font-bold text-blue-400">{publicCount}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-3.5 h-3.5 text-purple-400" />
            <p className="text-xs text-slate-400 uppercase tracking-wider">Private</p>
          </div>
          <p className="text-3xl font-bold text-purple-400">{privateCount}</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by league name or owner..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">All Types</option>
            <option value="classic">Classic</option>
            <option value="head_to_head">Head-to-Head</option>
          </select>
          <select
            value={privacyFilter}
            onChange={(e) => setPrivacyFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">All Privacy</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
          <span className="text-sm text-slate-400">{filtered.length} leagues</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">Loading leagues…</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/50 border-b border-slate-700 text-slate-400 text-sm">
                  <th className="px-4 py-3 font-medium">League</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Privacy</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium text-right">Members</th>
                  <th className="px-4 py-3 font-medium text-right">Total Pts</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                      No leagues found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((league) => (
                    <tr
                      key={league.id}
                      onClick={() => setSelected(league)}
                      className="hover:bg-slate-700/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                            <Shield className="w-4 h-4 text-amber-400" />
                          </div>
                          <span className="font-medium text-white text-sm">{league.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded border ${
                          league.type === 'classic'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        }`}>
                          {league.type === 'classic' ? 'Classic' : 'H2H'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          {league.privacy === 'public'
                            ? <><Globe className="w-3.5 h-3.5 text-blue-400" /><span className="text-blue-400">Public</span></>
                            : <><Lock className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-400">Private</span></>
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-sm">{league.ownerUsername}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        <span className="text-white font-medium">{league.memberCount}</span>
                        <span className="text-slate-500">/{league.maxMembers}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-400 font-bold text-sm">
                        {league.totalPoints.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded border capitalize ${statusStyles[league.status]}`}>
                          {league.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-sm whitespace-nowrap">
                        {formatDate(league.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 group-hover:text-slate-400 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <LeagueDetailPanel league={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
