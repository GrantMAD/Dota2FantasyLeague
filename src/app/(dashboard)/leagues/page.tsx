'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Trophy,
  Loader2,
  Plus,
  Hash,
  X,
  Copy,
  Check,
  BarChart3,
  Swords,
  Users,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import { useToast } from '@/components/Toast';
import type { LeagueRecord, StandingEntry, FixtureEntry } from './types';
import { LeagueHero } from './components/LeagueHero';
import { LeagueFilters } from './components/LeagueFilters';
import { LeagueCard } from './components/LeagueCard';
import { LeagueActionModal } from './components/LeagueActionModal';

type ActionMode = 'create' | 'join' | null;

export default function LeaguesPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'classic' | 'h2h'>('classic');
  const [leagues, setLeagues] = useState<LeagueRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // modal state
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  // detail modals
  const [selectedLeague, setSelectedLeague] = useState<LeagueRecord | null>(null);
  const [selectedUser, setSelectedUser] = useState<StandingEntry | null>(null);
  const [selectedFixture, setSelectedFixture] = useState<FixtureEntry | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  useEffect(() => {
    void fetchWithAuth('/api/leagues')
      .then((r) => r.json())
      .then((p) => setLeagues(p.leagues || p.data || []))
      .catch(() => setLeagues([]))
      .finally(() => setLoading(false));
  }, []);

  const visibleLeagues = leagues.filter((l) => l.type === tab);
  const standings = visibleLeagues.flatMap((l) => l.standings ?? []).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const fixtures = visibleLeagues.flatMap((l) => l.fixtures ?? []);

  // Pick the hero league: first sorted by most participants
  const heroLeague = [...leagues].sort((a, b) => b.currentParticipants - a.currentParticipants)[0] ?? null;

  const onCreateLeague = async (form: {
    name: string;
    type: 'classic' | 'h2h';
    privacyLevel: 'public' | 'private';
    maxParticipants: number;
    description: string;
  }) => {
    if (isCreating) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await fetchWithAuth('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await res.json();
      if (res.ok) {
        setLeagues((cur) => [payload.data, ...cur]);
        toast.success('League Created', `${payload.data.name} is live! Share your invite code to get started.`);
        setActionMode(null);
      } else {
        const msg = payload.error || 'Failed to create league.';
        setCreateError(msg);
        toast.error('Could Not Create League', msg);
      }
    } catch {
      const msg = 'Network error while creating league.';
      setCreateError(msg);
      toast.error('Could Not Create League', msg);
    } finally {
      setIsCreating(false);
    }
  };

  const onJoinLeague = async (code: string) => {
    if (isJoining) return;
    setIsJoining(true);
    setJoinError(null);
    setJoinSuccess(null);
    try {
      const res = await fetchWithAuth('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', inviteCode: code }),
      });
      const payload = await res.json();
      if (res.ok) {
        setLeagues((cur) => {
          const exists = cur.some((l) => l.inviteCode === payload.data.inviteCode);
          if (exists) return cur.map((l) => (l.inviteCode === payload.data.inviteCode ? payload.data : l));
          return [payload.data, ...cur];
        });
        const msg = payload.message || `Successfully joined ${payload.data.name}!`;
        setJoinSuccess(msg);
        toast.success('Joined League', msg);
        setTimeout(() => {
          setJoinSuccess(null);
          setActionMode(null);
        }, 2500);
      } else {
        const msg = payload.error || 'Failed to join league.';
        setJoinError(msg);
        toast.error('Could Not Join League', msg);
      }
    } catch {
      const msg = 'Network error while joining league.';
      setJoinError(msg);
      toast.error('Could Not Join League', msg);
    } finally {
      setIsJoining(false);
    }
  };

  const closeActionModal = () => {
    setActionMode(null);
    setCreateError(null);
    setJoinError(null);
    setJoinSuccess(null);
  };

  const classicCount = leagues.filter((l) => l.type === 'classic').length;
  const h2hCount = leagues.filter((l) => l.type === 'h2h').length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300">
            Competitive Circuits
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Trophy className="h-8 w-8 text-amber-400 shrink-0" />
            Leagues
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Classic rankings, private leagues, and head-to-head matchups powered by live pro match data.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setActionMode('join')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            <Hash className="h-4 w-4" />
            Join with Code
          </button>
          <button
            type="button"
            onClick={() => setActionMode('create')}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-300 transition hover:border-amber-400 hover:bg-amber-500/15"
          >
            <Plus className="h-4 w-4" />
            Create League
          </button>
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            <BarChart3 className="h-4 w-4" />
            Leaderboard
          </Link>
        </div>
      </div>

      {/* ── Loading Skeleton ──────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-6">
          <div className="animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="mb-4 h-6 w-48 rounded bg-slate-800" />
            <div className="mb-3 h-10 w-72 rounded bg-slate-800" />
            <div className="h-4 w-full rounded bg-slate-800" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="mb-4 h-4 w-40 rounded bg-slate-800" />
                <div className="h-24 rounded bg-slate-800" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* ── Hero Banner ──────────────────────────────────────────── */}
          {heroLeague && (
            <LeagueHero
              league={heroLeague}
              onOpen={() => setSelectedLeague(heroLeague)}
            />
          )}

          {/* ── No Leagues Empty State ───────────────────────────────── */}
          {leagues.length === 0 && (
            <div className="mb-8 rounded-3xl border border-dashed border-amber-500/30 bg-amber-500/[0.04] px-8 py-14 text-center">
              <Trophy className="mx-auto mb-4 h-12 w-12 text-amber-400/50" />
              <h2 className="mb-2 text-xl font-bold text-white">No Leagues Yet</h2>
              <p className="mb-6 text-sm text-slate-400">Create your first league or join an existing one with an invite code.</p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActionMode('create')}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-500/20 transition hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Create a League
                </button>
                <button
                  type="button"
                  onClick={() => setActionMode('join')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
                >
                  <Hash className="h-4 w-4" />
                  Join with Code
                </button>
              </div>
            </div>
          )}

          {leagues.length > 0 && (
            <>
              {/* ── Tabs ─────────────────────────────────────────────── */}
              <LeagueFilters
                activeTab={tab}
                onTabChange={setTab}
                classicCount={classicCount}
                h2hCount={h2hCount}
              />

              {/* ── League Cards Grid ─────────────────────────────────── */}
              {visibleLeagues.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center text-slate-400">
                  No {tab === 'classic' ? 'classic' : 'head-to-head'} leagues found.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visibleLeagues.map((league) => (
                    <LeagueCard
                      key={league.id}
                      league={league}
                      onClick={() => setSelectedLeague(league)}
                    />
                  ))}
                </div>
              )}

              {/* ── Standings / Fixtures Section ─────────────────────── */}
              {tab === 'classic' && standings.length > 0 && (
                <div className="mt-10">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                      <Trophy className="h-5 w-5 text-amber-400" />
                      Consolidated Standings
                    </h2>
                    <span className="text-xs text-amber-400">Click a manager to view profile</span>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-800">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-5 py-3.5">Rank</th>
                          <th className="px-5 py-3.5">Manager</th>
                          <th className="px-5 py-3.5 text-right">GW Pts</th>
                          <th className="px-5 py-3.5 text-right">Total Pts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                        {standings.map((entry, idx) => {
                          const rank = entry.rank ?? idx + 1;
                          return (
                            <tr
                              key={`${entry.manager}-${idx}`}
                              onClick={() => setSelectedUser(entry)}
                              className="cursor-pointer transition-colors hover:bg-slate-800/60 group"
                            >
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                  rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                                  rank === 2 ? 'bg-slate-400/10 text-slate-300 border border-slate-600' :
                                  rank === 3 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/40' :
                                  'text-slate-500'
                                }`}>
                                  #{rank}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-semibold text-white group-hover:text-amber-400 transition-colors">
                                {entry.manager}
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono text-slate-300">{entry.gwPoints ?? 0}</td>
                              <td className="px-5 py-3.5 text-right font-mono font-bold text-white">{entry.points} pts</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'h2h' && fixtures.length > 0 && (
                <div className="mt-10">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                      <Swords className="h-5 w-5 text-sky-400" />
                      H2H Fixtures
                    </h2>
                    <span className="text-xs text-amber-400">Click a matchup to view details</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {fixtures.map((fixture) => (
                      <div
                        key={fixture.id}
                        onClick={() => setSelectedFixture(fixture)}
                        className="cursor-pointer rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition-all hover:border-sky-500/40 hover:shadow-lg hover:shadow-sky-500/5 group"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-white group-hover:text-amber-400 transition-colors">{fixture.home}</span>
                          <span className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-black text-amber-400 font-mono">
                            {fixture.homePoints} — {fixture.awayPoints}
                          </span>
                          <span className="font-semibold text-white group-hover:text-amber-400 transition-colors">{fixture.away}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
                          <span>GW {fixture.gameweekId}</span>
                          <span className={`font-semibold ${fixture.isBye ? 'text-slate-400' : fixture.winnerId ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {fixture.isBye ? 'Bye' : fixture.winnerId ? 'Final' : 'Live / Scheduled'} →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Create / Join Modal ───────────────────────────────────── */}
      {actionMode && (
        <LeagueActionModal
          mode={actionMode}
          onClose={closeActionModal}
          onCreate={onCreateLeague}
          onJoin={onJoinLeague}
          isLoading={actionMode === 'create' ? isCreating : isJoining}
          error={actionMode === 'create' ? createError : joinError}
          successMessage={actionMode === 'join' ? joinSuccess : null}
        />
      )}

      {/* ── League Detail Modal ───────────────────────────────────── */}
      {selectedLeague && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl no-scrollbar">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 p-6 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      selectedLeague.type === 'h2h'
                        ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    }`}>
                      {selectedLeague.type === 'h2h' ? 'Head-to-Head' : 'Classic League'}
                    </span>
                    <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] capitalize text-slate-300">
                      {selectedLeague.privacyLevel}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-white">{selectedLeague.name}</h2>
                  {selectedLeague.description && (
                    <p className="mt-1 text-sm text-slate-400">{selectedLeague.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLeague(null)}
                  className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Quick Stats */}
              <div className="mb-6 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                    <Users className="h-3 w-3" /> Managers
                  </div>
                  <div className="text-xl font-black text-white">{selectedLeague.currentParticipants}<span className="text-sm font-normal text-slate-500">/{selectedLeague.maxParticipants}</span></div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Scoring</div>
                  <div className="text-sm font-bold text-amber-400">{selectedLeague.type === 'h2h' ? 'Weekly Wins' : 'Total Points'}</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Invite Code</div>
                  {selectedLeague.inviteCode ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-mono text-sm font-bold text-slate-200">{selectedLeague.inviteCode}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigator.clipboard.writeText(selectedLeague.inviteCode);
                          setCopiedInvite(true);
                          setTimeout(() => setCopiedInvite(false), 2000);
                        }}
                        className="rounded p-1 text-slate-400 hover:text-amber-400 transition-colors"
                      >
                        {copiedInvite ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500">N/A</span>
                  )}
                </div>
              </div>

              {/* Standings Table */}
              <div className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-white">
                  <Trophy className="h-4 w-4 text-amber-400" /> League Standings
                </h3>
                {(!selectedLeague.standings || selectedLeague.standings.length === 0) ? (
                  <p className="text-sm text-slate-400">No participants registered yet.</p>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-800">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Rank</th>
                          <th className="px-4 py-3">Manager</th>
                          {selectedLeague.type === 'h2h' && <th className="px-4 py-3 text-center">W-L-D</th>}
                          <th className="px-4 py-3 text-right">GW Pts</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                        {[...selectedLeague.standings]
                          .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
                          .map((p, idx) => {
                            const rank = p.rank ?? idx + 1;
                            return (
                              <tr
                                key={`${p.manager}-${idx}`}
                                onClick={() => setSelectedUser(p)}
                                className="cursor-pointer transition-colors hover:bg-slate-800/60 group"
                              >
                                <td className="px-4 py-3">
                                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                    rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                                    rank === 2 ? 'bg-slate-400/10 text-slate-300 border border-slate-600' :
                                    rank === 3 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/40' :
                                    'text-slate-500'
                                  }`}>
                                    #{rank}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-white group-hover:text-amber-400 transition-colors">{p.manager}</td>
                                {selectedLeague.type === 'h2h' && (
                                  <td className="px-4 py-3 text-center font-mono text-xs text-slate-300">{p.wins}W-{p.losses}L-{p.draws}D</td>
                                )}
                                <td className="px-4 py-3 text-right font-mono text-slate-300">{p.gwPoints ?? 0}</td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-white">{p.points} pts</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* H2H Fixtures in detail modal */}
              {selectedLeague.type === 'h2h' && (
                <div className="mb-4">
                  <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-white">
                    <Swords className="h-4 w-4 text-sky-400" /> Matchups &amp; Fixtures
                  </h3>
                  {(!selectedLeague.fixtures || selectedLeague.fixtures.length === 0) ? (
                    <p className="text-sm text-slate-400">No fixtures generated yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedLeague.fixtures.map((fixture) => (
                        <div
                          key={fixture.id}
                          onClick={() => setSelectedFixture({ ...fixture, leagueName: selectedLeague.name })}
                          className="cursor-pointer rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 transition-all hover:border-sky-500/40 hover:bg-slate-800/60 group"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-white group-hover:text-amber-400 transition-colors">{fixture.home}</span>
                            <span className="rounded-lg bg-amber-500/20 px-2 py-0.5 text-xs font-bold font-mono text-amber-400">
                              {fixture.homePoints} — {fixture.awayPoints}
                            </span>
                            <span className="font-semibold text-white group-hover:text-amber-400 transition-colors">{fixture.away}</span>
                          </div>
                          <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs text-slate-400">
                            <span>Gameweek {fixture.gameweekId}</span>
                            <span className={`font-semibold ${fixture.isBye ? 'text-slate-400' : fixture.winnerId ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {fixture.isBye ? 'Bye Round' : fixture.winnerId ? 'Result Final' : 'Scheduled / Live'} →
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Manager Details Modal ─────────────────────────────────── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl p-6 no-scrollbar">
            <div className="border-b border-slate-800 pb-5">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-slate-800 border-2 border-amber-500/50 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  {selectedUser.avatarUrl ? (
                    <Image src={selectedUser.avatarUrl} alt={selectedUser.manager} width={56} height={56} unoptimized className="h-full w-full object-cover" />
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
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">
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
                <p className="mt-4 text-sm text-slate-300 bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 italic">
                  &quot;{selectedUser.bio}&quot;
                </p>
              )}
            </div>

            <div className="my-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">League Performance</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Total Pts</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-amber-400">{selectedUser.points}</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">GW Pts</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-slate-200">{selectedUser.gwPoints ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Rank</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-white">#{selectedUser.rank ?? '—'}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-center">
                  <div className="text-[11px] text-slate-400 uppercase">Wins</div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-emerald-400">{selectedUser.wins}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-center">
                  <div className="text-[11px] text-slate-400 uppercase">Losses</div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-red-400">{selectedUser.losses}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-center">
                  <div className="text-[11px] text-slate-400 uppercase">Draws</div>
                  <div className="mt-0.5 font-mono text-lg font-bold text-slate-300">{selectedUser.draws}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="rounded-xl bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── H2H Fixture Detail Modal ──────────────────────────────── */}
      {selectedFixture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl p-6 no-scrollbar">
            <div className="border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
                  Gameweek {selectedFixture.gameweekId}
                </span>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                  selectedFixture.isBye ? 'border-slate-600 bg-slate-700/40 text-slate-300'
                  : selectedFixture.winnerId ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                }`}>
                  {selectedFixture.isBye ? 'Bye Round' : selectedFixture.winnerId ? 'Final Result' : 'Live / Scheduled'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Head-to-Head Matchup</h2>
                  {selectedFixture.leagueName && <p className="text-xs text-slate-400 mt-0.5">{selectedFixture.leagueName}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFixture(null)}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Score card */}
            <div className="my-6 rounded-3xl border border-slate-800 bg-slate-950/60 p-6">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                {/* Home */}
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden mb-2 shadow-inner">
                    {selectedFixture.homeAvatarUrl ? (
                      <Image src={selectedFixture.homeAvatarUrl} alt={selectedFixture.home} width={64} height={64} unoptimized className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-amber-400">{selectedFixture.home.substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <h4 className="font-bold text-white text-base leading-snug">{selectedFixture.home}</h4>
                  {selectedFixture.homeUsername && <span className="text-[11px] text-slate-400">@{selectedFixture.homeUsername}</span>}
                  <div className="mt-3">
                    <span className="font-mono text-3xl font-black text-white">{selectedFixture.homePoints}</span>
                    <span className="text-xs text-slate-400 ml-1">pts</span>
                  </div>
                  <div className="mt-2 flex min-h-5 items-center justify-center">
                    {selectedFixture.winnerId && selectedFixture.homePoints > selectedFixture.awayPoints && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
                        Winner (+3 pts)
                      </span>
                    )}
                  </div>
                </div>

                {/* VS */}
                <div className="flex flex-col items-center px-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/20 font-black text-amber-400 text-sm">VS</span>
                  <div className="text-[11px] text-slate-500 mt-2 font-mono">
                    {selectedFixture.homePoints === selectedFixture.awayPoints
                      ? 'Tied'
                      : `Δ ${Math.abs(Number((selectedFixture.homePoints - selectedFixture.awayPoints).toFixed(1)))}`}
                  </div>
                </div>

                {/* Away */}
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden mb-2 shadow-inner">
                    {selectedFixture.awayAvatarUrl ? (
                      <Image src={selectedFixture.awayAvatarUrl} alt={selectedFixture.away} width={64} height={64} unoptimized className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-slate-400">{selectedFixture.away.substring(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <h4 className="font-bold text-white text-base leading-snug">{selectedFixture.away}</h4>
                  {selectedFixture.awayUsername && <span className="text-[11px] text-slate-400">@{selectedFixture.awayUsername}</span>}
                  <div className="mt-3">
                    <span className="font-mono text-3xl font-black text-white">{selectedFixture.awayPoints}</span>
                    <span className="text-xs text-slate-400 ml-1">pts</span>
                  </div>
                  <div className="mt-2 flex min-h-5 items-center justify-center">
                    {selectedFixture.winnerId && selectedFixture.awayPoints > selectedFixture.homePoints && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
                        Winner (+3 pts)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Info strip */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-2 text-xs text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Matchup Type</span>
                <span className="font-medium text-white">Head-to-Head Gameweek Duel</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Scoring Model</span>
                <span className="font-medium text-white">3pts Win · 1pt Draw · 0 Loss</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Status</span>
                <span className={`font-semibold ${selectedFixture.isBye ? 'text-slate-400' : selectedFixture.winnerId ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {selectedFixture.isBye ? 'Bye (Auto Win)' : selectedFixture.winnerId ? 'Score Finalized' : 'In Progress / Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
