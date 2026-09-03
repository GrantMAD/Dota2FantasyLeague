'use client';

import { useEffect, useState } from 'react';

type LeagueRecord = {
  id: number;
  name: string;
  type: 'classic' | 'h2h';
  privacyLevel: 'public' | 'private';
  description: string;
  maxParticipants: number;
  currentParticipants: number;
  inviteCode: string;
  standings?: Array<{ manager: string; points: number; rank: number | null; wins: number; losses: number; draws: number; form: string[] }>;
  fixtures?: Array<{ id: number; gameweekId: number; home: string; away: string; homePoints: number; awayPoints: number; winnerId: number | null; isBye: boolean }>;
};

export default function LeaguesPage() {
  const [tab, setTab] = useState<'classic' | 'h2h'>('classic');
  const [leagues, setLeagues] = useState<LeagueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<LeagueRecord | null>(null);
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
          <h1 className="mb-2 text-3xl font-bold text-white">Leagues</h1>
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
                <h2 className="mb-4 text-xl font-semibold text-white">Consolidated Standings</h2>
                <div className="space-y-3">
                  {loading ? (
                    <p className="text-slate-400">Loading standings...</p>
                  ) : standings.length === 0 ? (
                    <p className="text-slate-400">No classic league standings available yet.</p>
                  ) : (
                    standings.map((entry, index) => (
                      <div key={`${entry.manager}-${index}`} className="flex items-center justify-between rounded border border-slate-700 bg-slate-900/40 p-3">
                        <div className="flex items-center gap-4">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-400">
                            #{entry.rank ?? index + 1}
                          </span>
                          <div>
                            <p className="font-semibold text-white">{entry.manager}</p>
                            <p className="text-xs text-slate-400">{entry.wins}W {entry.losses}L {entry.draws}D</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-bold text-white">{entry.points} pts</p>
                          <p className="text-xs text-slate-400">
                            {entry.wins}W {entry.losses}L
                          </p>
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
                <h2 className="mb-4 text-xl font-semibold text-white">All H2H Fixtures</h2>
                <div className="space-y-3">
                  {loading ? (
                    <p className="text-slate-400">Loading fixtures...</p>
                  ) : fixtures.length === 0 ? (
                    <p className="text-slate-400">No Head-to-Head fixtures available yet.</p>
                  ) : (
                    fixtures.map((fixture) => (
                      <div key={fixture.id} className="rounded border border-slate-700 bg-slate-900/40 p-3">
                        <div className="flex items-center justify-between text-sm text-slate-300">
                          <span className="font-medium text-white">{fixture.home}</span>
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">VS</span>
                          <span className="font-medium text-white">{fixture.away}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                          <span>GW {fixture.gameweekId}: <strong className="text-white">{fixture.homePoints}</strong> - <strong className="text-white">{fixture.awayPoints}</strong></span>
                          <span className={`font-semibold ${fixture.isBye ? 'text-slate-400' : fixture.winnerId ? 'text-green-400' : 'text-amber-400'}`}>
                            {fixture.isBye ? 'Bye' : fixture.winnerId ? 'Complete' : 'Live / In Progress'}
                          </span>
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
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
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
              <button
                type="button"
                onClick={() => setSelectedLeague(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                title="Close modal"
              >
                ✕
              </button>
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
                <p className="mt-1 font-mono text-sm font-bold text-slate-200">{selectedLeague.inviteCode || 'N/A'}</p>
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
                        <th className="px-4 py-3 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {selectedLeague.standings
                        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
                        .map((participant, index) => (
                          <tr key={`${participant.manager}-${index}`} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3">
                              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                (participant.rank ?? index + 1) === 1
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                  : 'text-slate-400'
                              }`}>
                                #{participant.rank ?? index + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-white">{participant.manager}</td>
                            {selectedLeague.type === 'h2h' && (
                              <td className="px-4 py-3 text-center text-slate-300 font-mono text-xs">
                                {participant.wins}W - {participant.losses}L - {participant.draws}D
                              </td>
                            )}
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
                      <div key={fixture.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-white">{fixture.home}</span>
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">
                            {fixture.homePoints} - {fixture.awayPoints}
                          </span>
                          <span className="font-semibold text-white">{fixture.away}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                          <span>Gameweek {fixture.gameweekId}</span>
                          <span className={fixture.isBye ? 'text-slate-400' : fixture.winnerId ? 'text-green-400 font-semibold' : 'text-amber-400 font-semibold'}>
                            {fixture.isBye ? 'Bye Round' : fixture.winnerId ? 'Result Final' : 'Scheduled / Live'}
                          </span>
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
    </div>
  );
}
