'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, CalendarClock, CalendarDays, CircleAlert, ShieldCheck } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';

type PlannerPlayer = {
  id: number;
  name: string;
  in_game_name: string | null;
  primary_role: string | null;
  profile_image_url: string | null;
  availability_status: string | null;
  availability_reason: string | null;
  current_price: number;
  professional_teams: {
    id: number;
    name: string;
    slug: string;
  } | null;
};

type PlannerLineupEntry = {
  slot: string;
  player_id: number;
  is_starter: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  professional_players: PlannerPlayer | null;
};

type FantasyContext = {
  gameweek: {
    id: number;
    gameweekNumber: number;
    status: string;
    deadline: string | null;
    isLocked: boolean;
  } | null;
  lineup: PlannerLineupEntry[];
  ownedPlayers: PlannerPlayer[];
};

type PlannerMatch = {
  id: number;
  scheduled_time: string;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a?: { name: string } | null;
  team_b?: { name: string } | null;
  tournaments?: { name: string } | null;
};

type MatchesResponse = { matches?: PlannerMatch[]; error?: string };

function displayName(player: PlannerPlayer): string {
  return player.in_game_name || player.name;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time to be confirmed';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDeadline(value: string | null): string {
  if (!value) return 'Deadline not announced';
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return 'Deadline not announced';
  const remaining = deadline.getTime() - Date.now();
  const formatted = deadline.toLocaleString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  if (remaining <= 0) return `${formatted} (passed)`;
  const hours = Math.floor(remaining / 3_600_000);
  const days = Math.floor(hours / 24);
  const timeLeft = days > 0
    ? `${days}d ${hours % 24}h remaining`
    : `${hours}h ${Math.floor((remaining % 3_600_000) / 60_000)}m remaining`;
  return `${formatted} · ${timeLeft}`;
}

function slotLabel(slot: string): string {
  if (slot === 'hard_support') return 'Hard Support';
  if (slot === 'bench_1' || slot === 'bench_2' || slot === 'bench_3') {
    return `Bench ${slot.slice(-1)}`;
  }
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

export default function SquadPlannerPage() {
  const [context, setContext] = useState<FantasyContext | null>(null);
  const [matchesByTeam, setMatchesByTeam] = useState<Map<number, PlannerMatch[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPlanner() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchWithAuth('/api/fantasy/context');
        const data = (await response.json()) as FantasyContext & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || `Unable to load your fantasy squad (${response.status})`);
        }
        if (cancelled) return;
        setContext(data);

        const teamIds = [...new Set((data.ownedPlayers ?? [])
          .map((player) => player.professional_teams?.id)
          .filter((teamId): teamId is number => teamId != null))];
        const matchResults = await Promise.all(teamIds.map(async (teamId) => {
          const matchesResponse = await fetch(
            `/api/matches?teamId=${teamId}&status=scheduled&order=asc&limit=100`,
          );
          const matchesData = (await matchesResponse.json()) as MatchesResponse;
          if (!matchesResponse.ok) {
            throw new Error(matchesData.error || `Unable to load fixtures for team ${teamId}`);
          }
          const now = Date.now();
          const upcoming = (matchesData.matches ?? [])
            .filter((match) => {
              const scheduled = new Date(match.scheduled_time).getTime();
              return Number.isFinite(scheduled) && scheduled >= now;
            })
            .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
          return [teamId, upcoming] as const;
        }));
        if (!cancelled) setMatchesByTeam(new Map(matchResults));
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load the squad planner');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPlanner();
    return () => {
      cancelled = true;
    };
  }, []);

  const lineupByPlayer = useMemo(
    () => new Map((context?.lineup ?? []).map((entry) => [entry.player_id, entry])),
    [context?.lineup],
  );

  const schedule = useMemo(() => {
    const allMatches = new Map<number, PlannerMatch>();
    for (const teamMatches of matchesByTeam.values()) {
      for (const match of teamMatches) allMatches.set(match.id, match);
    }
    return [...allMatches.values()]
      .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
  }, [matchesByTeam]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12" role="status">
        <p className="animate-pulse text-slate-300">Loading your gameweek planner...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-5 text-rose-200">
          {error}
        </div>
        <Link href="/gameweeks" className="mt-5 inline-flex items-center gap-2 text-sm text-cyan-300">
          <ArrowLeft className="h-4 w-4" /> Back to gameweeks
        </Link>
      </div>
    );
  }

  const gameweek = context?.gameweek;
  const ownedPlayers = context?.ownedPlayers ?? [];
  const unavailableCount = ownedPlayers.filter((player) => player.availability_status !== 'available').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link href="/gameweeks" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to gameweeks
      </Link>

      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <CalendarClock className="h-7 w-7 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">My Gameweek Planner</h1>
        </div>
        <p className="text-slate-400">
          Check your squad availability, lineup, deadline, and upcoming team fixtures in one place.
        </p>
      </header>

      <section className="mb-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/40 to-slate-900 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Planning for</p>
          <h2 className="mt-2 text-2xl font-bold text-white">
            {gameweek ? `Gameweek ${gameweek.gameweekNumber}` : 'No active gameweek'}
          </h2>
          <p className="mt-3 text-sm text-slate-300">
            {gameweek?.status === 'closed' || gameweek?.isLocked
              ? 'The current lineup is locked.'
              : gameweek?.deadline
                ? formatDeadline(gameweek.deadline)
                : 'There is no upcoming deadline available.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/lineups"
              className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
            >
              {gameweek?.isLocked ? 'View lineup' : 'Set lineup'}
            </Link>
            <Link
              href={gameweek ? `/matches?gameweekId=${gameweek.id}` : '/matches'}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Gameweek fixtures
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Squad status</p>
          <p className="mt-3 text-3xl font-bold text-white">{ownedPlayers.length} players</p>
          <p className={`mt-2 text-sm ${unavailableCount ? 'text-amber-300' : 'text-emerald-300'}`}>
            {unavailableCount
              ? `${unavailableCount} unavailable or status unconfirmed`
              : 'All players currently marked available'}
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Always review the latest lineup status before the deadline.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/40">
          <div className="border-b border-slate-700 p-5">
            <h2 className="text-lg font-semibold text-white">My squad availability</h2>
            <p className="mt-1 text-sm text-slate-400">Role, status, and recent form for your owned players.</p>
          </div>
          {ownedPlayers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-medium text-white">Your squad is empty</p>
              <Link href="/transfers" className="mt-3 inline-block text-sm text-cyan-300 hover:text-cyan-200">
                Visit the transfer market
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-700/70">
              {ownedPlayers.map((player) => {
                const lineupEntry = lineupByPlayer.get(player.id);
                const available = player.availability_status === 'available';
                const teamFixtures = player.professional_teams
                  ? matchesByTeam.get(player.professional_teams.id) ?? []
                  : [];
                return (
                  <li key={player.id} className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {player.profile_image_url ? (
                          <Image
                            src={player.profile_image_url}
                            alt=""
                            width={40}
                            height={40}
                            unoptimized
                            className="h-10 w-10 rounded-full bg-slate-700 object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">
                            {displayName(player).slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0">
                          <Link href={`/players/${player.id}`} className="truncate font-semibold text-white hover:text-cyan-300">
                            {displayName(player)}
                          </Link>
                          <p className="truncate text-xs text-slate-400">
                            {player.professional_teams?.name || 'Free agent'} · {player.primary_role || 'Role unassigned'}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                        available
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                      }`}>
                        {!available && <CircleAlert className="h-3.5 w-3.5" />}
                        {player.availability_status || 'Unknown'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span>{slotLabel(lineupEntry?.slot ?? '') || 'Not in lineup'}</span>
                      {lineupEntry?.is_captain && <span className="text-amber-300">Captain</span>}
                      {lineupEntry?.is_vice_captain && <span className="text-amber-200">Vice-captain</span>}
                      <span>{player.current_price ? `$${Number(player.current_price).toFixed(1)}M` : 'Price unavailable'}</span>
                    </div>
                    {!available && player.availability_reason && (
                      <p className="mt-2 text-xs text-amber-200/80">{player.availability_reason}</p>
                    )}
                    <div className="mt-3 flex items-start gap-2 text-xs text-slate-400">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                      <span>
                        {teamFixtures.length
                          ? `${teamFixtures.length} upcoming fixture${teamFixtures.length === 1 ? '' : 's'}`
                          : player.professional_teams ? 'No upcoming fixture listed' : 'No team schedule available'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/40">
          <div className="border-b border-slate-700 p-5">
            <h2 className="text-lg font-semibold text-white">Upcoming squad fixtures</h2>
            <p className="mt-1 text-sm text-slate-400">Next scheduled matches for teams represented in your squad.</p>
          </div>
          {schedule.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No upcoming fixtures found for your squad.</div>
          ) : (
            <ol className="divide-y divide-slate-700/70">
              {schedule.map((match) => {
                const involvedPlayers = ownedPlayers.filter((player) =>
                  player.professional_teams?.id === match.team_a_id
                  || player.professional_teams?.id === match.team_b_id);
                return (
                  <li key={match.id} className="p-4 sm:p-5">
                    <p className="flex items-center gap-2 text-sm font-semibold text-white">
                      <CalendarDays className="h-4 w-4 shrink-0 text-cyan-400" />
                      {match.team_a?.name || 'Team TBA'} <span className="text-slate-500">vs</span> {match.team_b?.name || 'Team TBA'}
                    </p>
                    <p className="mt-2 text-sm text-cyan-200">{formatDate(match.scheduled_time)}</p>
                    {match.tournaments?.name && (
                      <p className="mt-1 truncate text-xs text-slate-500">{match.tournaments.name}</p>
                    )}
                    {involvedPlayers.length > 0 && (
                      <p className="mt-2 text-xs text-slate-400">
                        Your squad: {involvedPlayers.map(displayName).join(', ')}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
