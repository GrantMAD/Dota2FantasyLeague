'use client';

import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';

type StandingEntry = {
  userId?: string;
  manager: string;
  username?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  points: number;
  gwPoints?: number;
  rank: number | null;
  wins: number;
  losses: number;
  draws: number;
  form: string[];
};

type FixtureEntry = {
  id: number;
  leagueId?: number;
  leagueName?: string;
  gameweekId: number;
  home: string;
  homeUsername?: string;
  homeAvatarUrl?: string | null;
  away: string;
  awayUsername?: string | null;
  awayAvatarUrl?: string | null;
  homePoints: number;
  awayPoints: number;
  winnerId: number | null;
  isBye: boolean;
};

type LeagueRecord = {
  id: number;
  name: string;
  type: 'classic' | 'h2h';
  privacyLevel: 'public' | 'private';
  description: string;
  maxParticipants: number;
  currentParticipants: number;
  inviteCode: string;
  standings?: StandingEntry[];
  fixtures?: FixtureEntry[];
};

export default function LeaguesPage() {
  const [tab, setTab] = useState<'classic' | 'h2h'>('classic');
  const [leagues, setLeagues] = useState<LeagueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<LeagueRecord | null>(null);
  const [selectedUser, setSelectedUser] = useState<StandingEntry | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<FixtureEntry | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'classic' as 'classic' | 'h2h',
    privacyLevel: 'private' as 'public' | 'private',
    maxParticipants: 10,
    description: '',
  });

  useEffect(() => {
    void fetch('/api/leagues')
      .then((response) => response.json())
      .then((payload) => setLeagues(payload.data || []))
      .catch(() => setLeagues([]))
      .finally(() => setLoading(false));
  }, []);

  const visibleLeagues = leagues.filter((league) => league.type === tab);
  const standings = visibleLeagues.flatMap((league) => league.standings ?? []).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const fixtures = visibleLeagues.flatMap((league) => league.fixtures ?? []);

  const onCreateLeague = async () => {
    const response = await fetch('/api/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (response.ok) {
      const payload = await response.json();
      setLeagues((current) => [payload.data, ...current]);
      setForm({
        name: '',
        type: 'classic',
        privacyLevel: 'private',
        maxParticipants: 10,
        description: '',
      });
    }
  };

  const onJoinLeague = async () => {
    if (!joinCode.trim()) return;

    const response = await fetch('/api/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', inviteCode: joinCode }),
    });

    if (response.ok) {
      const payload = await response.json();
      setLeagues((current) => current.map((league) => (league.inviteCode === payload.data.inviteCode ? payload.data : league)));
      setJoinCode('');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-400 shrink-0" />
            <span>Leagues</span>
          </h1>
          <p className="text-slate-400">Classic rankings, public/private leagues, and head-to-head matchups powered by the launch engine</p>
        </div>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
          <div className="mb-4 flex gap-3">
            {(['classic', 'h2h'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`rounded px-4 py-2 font-medium transition-colors ${
                  tab === value
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {value === 'classic' ? 'Classic Leagues' : 'Head-to-Head'}
              </button>
            ))}
          </div>

          {/* List of leagues in the current category */}
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold text-white">
              {tab === 'classic' ? 'Classic Leagues' : 'Head-to-Head Leagues'}
            </h2>
            <p className="mb-3 text-xs text-slate-400">Click any league to open complete details, rules, standings, and fixtures</p>
            {loading ? (
              <p className="text-sm text-slate-400">Loading leagues...</p>
            ) : visibleLeagues.length === 0 ? (
              <div className="rounded border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                No {tab === 'classic' ? 'classic' : 'head-to-head'} leagues found. Create or join one using the panel on the right!
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {visibleLeagues.map((league) => (
                  <div
                    key={league.id}
                    onClick={() => setSelectedLeague(league)}
                    className="group cursor-pointer rounded-lg border border-slate-700 bg-slate-900/60 p-4 transition-all hover:border-amber-500/50 hover:bg-slate-900 hover:shadow-lg hover:shadow-amber-500/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white group-hover:text-amber-400 transition-colors">{league.name}</p>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{league.description || 'No description provided'}</p>
                      </div>
                      <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300 border border-slate-700 capitalize">
                        {league.privacyLevel}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
                      <span>👥 {league.currentParticipants}/{league.maxParticipants} managers</span>
                      <span className="font-mono text-amber-400/90 group-hover:text-amber-400">View League →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {tab === 'classic' ? (
            <div className="grid grid-cols-1 gap-6 border-t border-slate-700/80 pt-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Consolidated Standings</h2>
                  <span className="text-xs text-amber-400 font-medium">Click a manager to view profile</span>
                </div>
                <div className="space-y-3">
                  {loading ? (
                    <p className="text-slate-400">Loading standings...</p>
                  ) : standings.length === 0 ? (
                    <p className="text-slate-400">No classic league standings available yet.</p>
                  ) : (
                    standings.map((entry, index) => (
                      <div
                        key={`${entry.manager}-${index}`}
                        onClick={() => setSelectedUser(entry)}
                        className="flex items-center justify-between rounded border border-slate-700 bg-slate-900/40 p-3 hover:bg-slate-800/60 hover:border-amber-500/40 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-400 group-hover:scale-105 transition-transform">
                            #{entry.rank ?? index + 1}
                          </span>
                          <div>
                            <p className="font-semibold text-white group-hover:text-amber-400 transition-colors">{entry.manager}</p>
                            <p className="text-xs text-slate-400">{entry.wins}W {entry.losses}L {entry.draws}D</p>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-3">
                          <div>
                            <p className="font-bold text-white font-mono">{entry.points} pts</p>
                            <p className="text-xs text-slate-400">
                              {entry.wins}W {entry.losses}L
                            </p>
                          </div>
                          <span className="text-slate-500 group-hover:text-amber-400 transition-colors text-sm">→</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 border-t border-slate-700/80 pt-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">All H2H Fixtures</h2>
                  <span className="text-xs text-amber-400 font-medium">Click a matchup to view details</span>
                </div>
                <div className="space-y-3">
                  {loading ? (
                    <p className="text-slate-400">Loading fixtures...</p>
                  ) : fixtures.length === 0 ? (
                    <p className="text-slate-400">No Head-to-Head fixtures available yet.</p>
                  ) : (
                    fixtures.map((fixture) => (
                      <div
                        key={fixture.id}
                        onClick={() => setSelectedFixture(fixture)}
                        className="rounded-lg border border-slate-700 bg-slate-900/40 p-3.5 hover:bg-slate-800/60 hover:border-amber-500/40 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between text-sm text-slate-300">
                          <span className="font-semibold text-white group-hover:text-amber-400 transition-colors">{fixture.home}</span>
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400 group-hover:scale-105 transition-transform">VS</span>
                          <span className="font-semibold text-white group-hover:text-amber-400 transition-colors">{fixture.away}</span>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                          <span>GW {fixture.gameweekId}: <strong className="text-white font-mono">{fixture.homePoints}</strong> - <strong className="text-white font-mono">{fixture.awayPoints}</strong></span>
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${fixture.isBye ? 'text-slate-400' : fixture.winnerId ? 'text-green-400' : 'text-amber-400'}`}>
                              {fixture.isBye ? 'Bye' : fixture.winnerId ? 'Complete' : 'Live / In Progress'}
                            </span>
                            <span className="text-slate-500 group-hover:text-amber-400 transition-colors text-sm">→</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">Create League</h2>
            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="League name"
                className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="League description"
                className="min-h-24 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value as 'classic' | 'h2h' })}
                  className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="classic">Classic</option>
                  <option value="h2h">Head-to-head</option>
                </select>
                <select
                  value={form.privacyLevel}
                  onChange={(event) => setForm({ ...form, privacyLevel: event.target.value as 'public' | 'private' })}
                  className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Max Participants (4-32)</label>
                <input
                  type="number"
                  min={4}
                  max={32}
                  value={form.maxParticipants}
                  onChange={(event) => setForm({ ...form, maxParticipants: Number(event.target.value) || 10 })}
                  className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={onCreateLeague}
                className="w-full rounded bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 font-semibold text-white hover:opacity-90 transition-opacity shadow-md"
              >
                Create league
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">Join by Invite</h2>
            <div className="space-y-3">
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                placeholder="Enter invite code"
                className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none uppercase"
              />
              <button
                type="button"
                onClick={onJoinLeague}
                className="w-full rounded border border-amber-500/50 bg-amber-500/10 px-4 py-2 font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                Join league
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* League Detail Modal */}
      {selectedLeague && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl no-scrollbar">
            {/* Modal Header */}
            <div className="border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-400 border border-amber-500/30">
                    {selectedLeague.type === 'h2h' ? 'Head-to-Head' : 'Classic League'}
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300 border border-slate-700 capitalize">
                    {selectedLeague.privacyLevel}
                  </span>
                </div>
                <h2 className="mt-2 text-2xl font-bold text-white">{selectedLeague.name}</h2>
                <p className="mt-1 text-sm text-slate-400">{selectedLeague.description || 'No description provided for this league.'}</p>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="my-6 grid grid-cols-3 gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-center">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Managers</p>
                <p className="mt-1 text-xl font-bold text-white">{selectedLeague.currentParticipants} / {selectedLeague.maxParticipants}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Scoring Mode</p>
                <p className="mt-1 text-base font-bold text-amber-400">{selectedLeague.type === 'h2h' ? 'Weekly Wins (3pts)' : 'Total Points'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider">Invite Code</p>
                {selectedLeague.inviteCode ? (
                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    <span className="font-mono text-sm font-bold text-slate-200">{selectedLeague.inviteCode}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedLeague.inviteCode) {
                          navigator.clipboard.writeText(selectedLeague.inviteCode);
                          setCopiedInvite(true);
                          setTimeout(() => setCopiedInvite(false), 2000);
                        }
                      }}
                      className="rounded p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                      title="Copy invite code"
                    >
                      {copiedInvite ? (
                        <span className="text-xs font-bold text-emerald-400">Copied!</span>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="mt-1 font-mono text-sm font-bold text-slate-500">N/A</p>
                )}
              </div>
            </div>

            {/* League Standings Table */}
            <div className="mb-6">
              <h3 className="mb-3 text-lg font-semibold text-white flex items-center gap-2">
                <span>📊</span> League Standings
              </h3>
              {(!selectedLeague.standings || selectedLeague.standings.length === 0) ? (
                <p className="text-sm text-slate-400">No participants registered in this league yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-800">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Manager</th>
                        {selectedLeague.type === 'h2h' && <th className="px-4 py-3 text-center">Record (W-L-D)</th>}
                        <th className="px-4 py-3 text-right">GW Pts</th>
                        <th className="px-4 py-3 text-right">Total Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {selectedLeague.standings
                        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
                        .map((participant, index) => (
                          <tr
                            key={`${participant.manager}-${index}`}
                            onClick={() => setSelectedUser(participant)}
                            className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                            title="Click to view manager profile"
                          >
                            <td className="px-4 py-3">
                              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                (participant.rank ?? index + 1) === 1
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                  : 'text-slate-400'
                              }`}>
                                #{participant.rank ?? index + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-white group-hover:text-amber-400 transition-colors">
                              {participant.manager}
                            </td>
                            {selectedLeague.type === 'h2h' && (
                              <td className="px-4 py-3 text-center text-slate-300 font-mono text-xs">
                                {participant.wins}W - {participant.losses}L - {participant.draws}D
                              </td>
                            )}
                            <td className="px-4 py-3 text-right font-mono text-slate-300">
                              {participant.gwPoints ?? 0}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-white font-mono">
                              {participant.points} pts
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* H2H Fixtures Section (Only for Head-to-Head leagues) */}
            {selectedLeague.type === 'h2h' && (
              <div className="mb-6">
                <h3 className="mb-3 text-lg font-semibold text-white flex items-center gap-2">
                  <span>⚔️</span> Matchups & Fixtures
                </h3>
                {(!selectedLeague.fixtures || selectedLeague.fixtures.length === 0) ? (
                  <p className="text-sm text-slate-400">No fixtures generated for this league yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedLeague.fixtures.map((fixture) => (
                      <div
                        key={fixture.id}
                        onClick={() => setSelectedFixture({ ...fixture, leagueName: selectedLeague.name })}
                        className="rounded-lg border border-slate-800 bg-slate-950/40 p-3.5 hover:bg-slate-800/60 hover:border-amber-500/40 cursor-pointer transition-all group"
                        title="Click to view matchup details"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-white group-hover:text-amber-400 transition-colors">{fixture.home}</span>
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400 group-hover:scale-105 transition-transform">
                            {fixture.homePoints} - {fixture.awayPoints}
                          </span>
                          <span className="font-semibold text-white group-hover:text-amber-400 transition-colors">{fixture.away}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                          <span>Gameweek {fixture.gameweekId}</span>
                          <div className="flex items-center gap-2">
                            <span className={fixture.isBye ? 'text-slate-400' : fixture.winnerId ? 'text-green-400 font-semibold' : 'text-amber-400 font-semibold'}>
                              {fixture.isBye ? 'Bye Round' : fixture.winnerId ? 'Result Final' : 'Scheduled / Live'}
                            </span>
                            <span className="text-slate-500 group-hover:text-amber-400 transition-colors text-sm">→</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setSelectedLeague(null)}
                className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 no-scrollbar">
            {/* Header */}
            <div className="border-b border-slate-800 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-amber-500/50 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  {selectedUser.avatarUrl ? (
                    <img src={selectedUser.avatarUrl} alt={selectedUser.manager} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-amber-400">
                      {(selectedUser.displayName || selectedUser.username || selectedUser.manager).substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white">{selectedUser.manager}</h2>
                    {selectedUser.rank && (
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/40">
                        Rank #{selectedUser.rank}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    @{selectedUser.username || selectedUser.manager.toLowerCase().replace(/\s+/g, '_')}
                  </p>
                </div>
              </div>

              {selectedUser.bio && (
                <p className="mt-4 text-sm text-slate-300 bg-slate-950/40 border border-slate-800/80 rounded-lg p-3 italic">
                  "{selectedUser.bio}"
                </p>
              )}
            </div>

            {/* Performance Stats Grid */}
            <div className="my-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">League Performance</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Total Points</div>
                  <div className="text-2xl font-mono font-bold text-amber-400 mt-1">{selectedUser.points} <span className="text-sm font-sans text-amber-300">pts</span></div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Gameweek</div>
                  <div className="text-2xl font-mono font-bold text-slate-200 mt-1">{selectedUser.gwPoints ?? 0} <span className="text-sm font-sans text-slate-400">pts</span></div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="text-xs text-slate-400 uppercase tracking-wider">Current Rank</div>
                  <div className="text-2xl font-mono font-bold text-white mt-1">#{selectedUser.rank ?? '-'}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-center">
                  <div className="text-[11px] text-slate-400 uppercase">Wins</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">{selectedUser.wins}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-center">
                  <div className="text-[11px] text-slate-400 uppercase">Losses</div>
                  <div className="text-lg font-bold text-red-400 font-mono mt-0.5">{selectedUser.losses}</div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-center">
                  <div className="text-[11px] text-slate-400 uppercase">Draws</div>
                  <div className="text-lg font-bold text-slate-300 font-mono mt-0.5">{selectedUser.draws}</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Head-to-Head Fixture Details Modal */}
      {selectedFixture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 no-scrollbar">
            {/* Header */}
            <div className="border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="rounded bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/40 uppercase">
                  Gameweek {selectedFixture.gameweekId}
                </span>
                <span className={`rounded px-2.5 py-0.5 text-xs font-bold uppercase border ${
                  selectedFixture.isBye
                    ? 'bg-slate-700/40 text-slate-300 border-slate-600'
                    : selectedFixture.winnerId
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  {selectedFixture.isBye ? 'Bye Round' : selectedFixture.winnerId ? 'Final Result' : 'Live / Scheduled'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">Head-to-Head Matchup</h2>
              {selectedFixture.leagueName && (
                <p className="text-xs text-slate-400 mt-0.5">{selectedFixture.leagueName}</p>
              )}
            </div>

            {/* Matchup Comparison Card */}
            <div className="my-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                {/* Home Manager */}
                <div className="text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden mb-2 shadow-inner">
                    {selectedFixture.homeAvatarUrl ? (
                      <img src={selectedFixture.homeAvatarUrl} alt={selectedFixture.home} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-amber-400">
                        {selectedFixture.home.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-white text-base leading-snug">{selectedFixture.home}</h4>
                  {selectedFixture.homeUsername && (
                    <span className="text-[11px] text-slate-400">@{selectedFixture.homeUsername}</span>
                  )}
                  <div className="mt-3">
                    <span className="text-3xl font-mono font-bold text-white">{selectedFixture.homePoints}</span>
                    <span className="text-xs text-slate-400 ml-1">pts</span>
                  </div>
                  {selectedFixture.winnerId && selectedFixture.homePoints > selectedFixture.awayPoints && (
                    <span className="mt-2 inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 uppercase">
                      Winner (+3 pts)
                    </span>
                  )}
                </div>

                {/* VS Badge */}
                <div className="flex flex-col items-center px-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 font-black text-amber-400 text-sm border border-amber-500/40">
                    VS
                  </span>
                  <div className="text-[11px] text-slate-500 mt-2 font-mono">
                    {selectedFixture.homePoints === selectedFixture.awayPoints
                      ? 'Tied'
                      : `Δ ${Math.abs(Number((selectedFixture.homePoints - selectedFixture.awayPoints).toFixed(1)))}`}
                  </div>
                </div>

                {/* Away Manager */}
                <div className="text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden mb-2 shadow-inner">
                    {selectedFixture.awayAvatarUrl ? (
                      <img src={selectedFixture.awayAvatarUrl} alt={selectedFixture.away} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-slate-400">
                        {selectedFixture.away.substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-white text-base leading-snug">{selectedFixture.away}</h4>
                  {selectedFixture.awayUsername && (
                    <span className="text-[11px] text-slate-400">@{selectedFixture.awayUsername}</span>
                  )}
                  <div className="mt-3">
                    <span className="text-3xl font-mono font-bold text-white">{selectedFixture.awayPoints}</span>
                    <span className="text-xs text-slate-400 ml-1">pts</span>
                  </div>
                  {selectedFixture.winnerId && selectedFixture.awayPoints > selectedFixture.homePoints && (
                    <span className="mt-2 inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 uppercase">
                      Winner (+3 pts)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Status Breakdown Bar */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 text-xs text-slate-300 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Matchup Type</span>
                <span className="font-medium text-white">Head-to-Head Gameweek Duel</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Scoring Model</span>
                <span className="font-medium text-white">3 pts for Win, 1 pt for Draw, 0 for Loss</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Status</span>
                <span className={`font-semibold ${selectedFixture.isBye ? 'text-slate-400' : selectedFixture.winnerId ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedFixture.isBye ? 'Bye (Manager Awarded Win)' : selectedFixture.winnerId ? 'Score Finalized' : 'In Progress / Pending Deadline'}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-800 pt-4 mt-6">
              <button
                type="button"
                onClick={() => setSelectedFixture(null)}
                className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
