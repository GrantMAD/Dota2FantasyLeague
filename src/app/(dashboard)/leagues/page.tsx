'use client';

import { useEffect, useMemo, useState } from 'react';
import { calculateLeagueStandings, generateHeadToHeadFixtures, simulateHeadToHead } from '@/lib/fantasy-gameplay';

const classicEntries = [
  { manager: 'Alpha', points: 1280, wins: 7, losses: 2, form: ['W', 'W', 'L', 'W'] },
  { manager: 'Bravo', points: 1225, wins: 6, losses: 3, form: ['W', 'L', 'W', 'W'] },
  { manager: 'Charlie', points: 1190, wins: 6, losses: 4, form: ['L', 'W', 'W', 'L'] },
  { manager: 'Delta', points: 1138, wins: 5, losses: 5, form: ['W', 'L', 'L', 'W'] },
];

const h2hParticipants = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

type LeagueRecord = {
  id: number;
  name: string;
  type: 'classic' | 'h2h';
  privacyLevel: 'public' | 'private';
  description: string;
  maxParticipants: number;
  currentParticipants: number;
  inviteCode: string;
};

export default function LeaguesPage() {
  const [tab, setTab] = useState<'classic' | 'h2h'>('classic');
  const [leagues, setLeagues] = useState<LeagueRecord[]>([]);
  const [joinCode, setJoinCode] = useState('');
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
      .catch(() => setLeagues([]));
  }, []);

  const standings = useMemo(() => calculateLeagueStandings(classicEntries), []);
  const fixtures = useMemo(() => generateHeadToHeadFixtures(h2hParticipants), []);

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
                className={`rounded px-4 py-2 font-medium ${
                  tab === value
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {value === 'classic' ? 'Classic League' : 'Head-to-Head'}
              </button>
            ))}
          </div>

          {tab === 'classic' ? (
            <div className="grid grid-cols-1 gap-6">
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
                <h2 className="mb-4 text-xl font-semibold text-white">Standings</h2>
                <div className="space-y-3">
                  {standings.map((entry) => (
                    <div key={entry.manager} className="flex items-center justify-between rounded border border-slate-700 bg-slate-900/40 p-3">
                      <div className="flex items-center gap-4">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-400">
                          #{entry.rank}
                        </span>
                        <div>
                          <p className="font-semibold text-white">{entry.manager}</p>
                          <p className="text-xs text-slate-400">Form: {entry.form}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-white">{entry.points} pts</p>
                        <p className="text-xs text-slate-400">
                          {entry.wins}W {entry.losses}L
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
                <h2 className="mb-4 text-xl font-semibold text-white">Fixtures</h2>
                <div className="space-y-3">
                  {fixtures.map((fixture, index) => {
                    const matchup = simulateHeadToHead(fixture.home, fixture.away, 80 + (index % 3) * 7, 72 + (index % 2) * 6);
                    return (
                      <div key={`${fixture.home}-${fixture.away}-${index}`} className="rounded border border-slate-700 bg-slate-900/40 p-3">
                        <div className="flex items-center justify-between text-sm text-slate-300">
                          <span>{fixture.home}</span>
                          <span className="text-amber-400">vs</span>
                          <span>{fixture.away}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                          <span>{fixture.score}</span>
                          <span>{matchup.winner}</span>
                        </div>
                      </div>
                    );
                  })}
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
                className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              />
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="League description"
                className="min-h-24 w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value as 'classic' | 'h2h' })}
                  className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white"
                >
                  <option value="classic">Classic</option>
                  <option value="h2h">Head-to-head</option>
                </select>
                <select
                  value={form.privacyLevel}
                  onChange={(event) => setForm({ ...form, privacyLevel: event.target.value as 'public' | 'private' })}
                  className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white"
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <input
                type="number"
                min={4}
                max={32}
                value={form.maxParticipants}
                onChange={(event) => setForm({ ...form, maxParticipants: Number(event.target.value) || 10 })}
                className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              />
              <button
                type="button"
                onClick={onCreateLeague}
                className="w-full rounded bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 font-semibold text-white"
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
                className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              />
              <button
                type="button"
                onClick={onJoinLeague}
                className="w-full rounded border border-amber-500/50 bg-amber-500/10 px-4 py-2 font-semibold text-amber-400"
              >
                Join league
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">Launch-ready leagues</h2>
            <div className="space-y-3">
              {leagues.map((league) => (
                <div key={league.id} className="rounded border border-slate-700 bg-slate-900/40 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{league.name}</p>
                    <span className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-200">
                      {league.type}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{league.privacyLevel} · {league.currentParticipants}/{league.maxParticipants} players</p>
                  <p className="mt-2 text-xs text-amber-400">Invite: {league.inviteCode}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
