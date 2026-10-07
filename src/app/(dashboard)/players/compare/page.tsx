'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowLeftRight, CalendarDays, X } from 'lucide-react';

type ComparisonPlayer = {
  id: number;
  name: string;
  in_game_name: string | null;
  primary_role: string | null;
  team_id: number | null;
  current_price: number | null;
  price_change: number | null;
  gameweek_points: number | null;
  recent_points: number | null;
  availability_status: string | null;
  professional_teams?: {
    name: string;
    logo_url: string | null;
  } | null;
};

type TeamMatch = {
  id: number;
  scheduled_time: string;
  team_a_id: number | null;
  team_b_id: number | null;
  team_a?: { name: string } | null;
  team_b?: { name: string } | null;
  tournaments?: { name: string } | null;
};

type PlayersResponse = { data?: ComparisonPlayer[]; error?: string };
type MatchesResponse = { matches?: TeamMatch[]; error?: string };

function playerLabel(player: ComparisonPlayer): string {
  return player.in_game_name || player.name;
}

function formatPrice(value: number | null | undefined): string {
  return value == null ? 'N/A' : `$${Number(value).toFixed(1)}M`;
}

function formatPoints(value: number | null | undefined): string {
  return value == null ? 'N/A' : Number(value).toFixed(1);
}

function formatPriceChange(value: number | null | undefined): string {
  if (value == null) return 'No price history';
  const amount = Number(value);
  const sign = amount > 0 ? '+' : '';
  return `${sign}$${amount.toFixed(2)}M`;
}

function formatMatchDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time TBA';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function PlayerComparisonSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 animate-pulse" role="status" aria-label="Loading player comparison">
      <div className="mb-6 h-4 w-36 rounded bg-slate-800" />
      <div className="mb-8 space-y-3">
        <div className="h-9 w-64 rounded bg-slate-800" />
        <div className="h-4 w-full max-w-2xl rounded bg-slate-800" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800/40">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[minmax(8rem,0.8fr)_repeat(3,minmax(0,1fr))] border-b border-slate-700">
            <div className="p-4"><div className="h-4 w-24 rounded bg-slate-800" /></div>
            {[1, 2, 3].map((column) => (
              <div key={column} className="border-l border-slate-700 p-4">
                <div className="h-5 w-28 rounded bg-slate-700" />
                <div className="mt-2 h-3 w-20 rounded bg-slate-800" />
                <div className="mt-3 h-3 w-16 rounded bg-slate-800" />
              </div>
            ))}
          </div>
          {['Professional team', 'Current price', 'Latest price movement', 'Latest gameweek points', 'Average recent points', 'Availability', 'Upcoming fixtures'].map((label) => (
            <div key={label} className="grid grid-cols-[minmax(8rem,0.8fr)_repeat(3,minmax(0,1fr))] border-b border-slate-700/70 last:border-0">
              <div className="p-4"><div className="h-4 w-24 max-w-full rounded bg-slate-800" /></div>
              {[1, 2, 3].map((column) => (
                <div key={column} className="border-l border-slate-700/70 p-4">
                  <div className="h-4 w-28 max-w-full rounded bg-slate-800" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PlayerComparisonPage() {
  return (
    <Suspense fallback={<PlayerComparisonSkeleton />}>
      <PlayerComparisonContent />
    </Suspense>
  );
}

function PlayerComparisonContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ids = useMemo(
    () => [...new Set((searchParams.get('ids') ?? '')
      .split(',')
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0))].slice(0, 4),
    [searchParams],
  );
  const [players, setPlayers] = useState<ComparisonPlayer[]>([]);
  const [upcomingByTeam, setUpcomingByTeam] = useState<Map<number, TeamMatch[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadComparison() {
      setLoading(true);
      setError(null);
      setPlayers([]);
      setUpcomingByTeam(new Map());

      if (ids.length < 2) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/players?ids=${ids.join(',')}&limit=4&show_all=true`);
        const data = (await response.json()) as PlayersResponse;
        if (!response.ok) throw new Error(data.error || `Unable to load players (${response.status})`);
        if (cancelled) return;

        const loadedPlayers = data.data ?? [];
        setPlayers(loadedPlayers);

        const teamIds = [...new Set(loadedPlayers
          .map((player) => player.team_id)
          .filter((teamId): teamId is number => teamId != null))];
        const scheduleResults = await Promise.all(teamIds.map(async (teamId) => {
          const scheduleResponse = await fetch(
            `/api/matches?teamId=${teamId}&status=scheduled&order=asc&limit=100`,
          );
          const scheduleData = (await scheduleResponse.json()) as MatchesResponse;
          if (!scheduleResponse.ok) {
            throw new Error(scheduleData.error || `Unable to load fixtures for team ${teamId}`);
          }
          const now = Date.now();
          const fixtures = (scheduleData.matches ?? [])
            .filter((match) => new Date(match.scheduled_time).getTime() >= now)
            .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
            .slice(0, 3);
          return [teamId, fixtures] as const;
        }));

        if (cancelled) return;
        setUpcomingByTeam(new Map(scheduleResults));
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load player comparison');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadComparison();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const removePlayer = (playerId: number) => {
    const remainingIds = ids.filter((id) => id !== playerId);
    const query = remainingIds.length ? `?ids=${remainingIds.join(',')}` : '';
    router.replace(`/players/compare${query}`);
  };

  if (loading) {
    return <PlayerComparisonSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-6 text-rose-200">
          {error}
        </div>
        <Link href="/players" className="mt-5 inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200">
          <ArrowLeft className="h-4 w-4" /> Back to players
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Link href="/players" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to players
      </Link>

      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <ArrowLeftRight className="h-7 w-7 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Player comparison</h1>
        </div>
        <p className="text-slate-400">
          Compare recent fantasy form, price movement, availability, and upcoming fixtures side by side.
        </p>
      </div>

      {ids.length < 2 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center">
          <p className="text-lg font-semibold text-white">Choose at least two players</p>
          <p className="mt-2 text-sm text-slate-400">You can compare up to four players at a time.</p>
          <Link href="/players" className="mt-5 inline-flex rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
            Select players
          </Link>
        </div>
      ) : players.length < 2 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center">
          <p className="text-lg font-semibold text-white">Not enough players were found</p>
          <p className="mt-2 text-sm text-slate-400">One or more selected players may no longer be available.</p>
          <Link href="/players" className="mt-5 inline-flex rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
            Choose players
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800/40">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <caption className="sr-only">Selected player statistics and upcoming matches</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-44 border-b border-slate-700 bg-slate-800/80 p-4 text-sm font-medium text-slate-400">
                    Player metrics
                  </th>
                  {players.map((player) => (
                    <th key={player.id} scope="col" className="min-w-52 border-b border-slate-700 bg-slate-800/80 p-4 align-top">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link href={`/players/${player.id}`} className="font-semibold text-white hover:text-cyan-300">
                            {playerLabel(player)}
                          </Link>
                          {player.name !== playerLabel(player) && (
                            <p className="mt-1 text-xs font-normal text-slate-500">{player.name}</p>
                          )}
                          <p className="mt-2 text-xs font-medium text-cyan-300">{player.primary_role || 'Role unassigned'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePlayer(player.id)}
                          aria-label={`Remove ${playerLabel(player)} from comparison`}
                          className="rounded-md p-1 text-slate-500 hover:bg-slate-700 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/70">
                <ComparisonRow label="Professional team">
                  {players.map((player) => (
                    <td key={player.id} className="p-4 text-sm text-slate-200">
                      <div className="flex items-center gap-2">
                        {player.professional_teams?.logo_url && (
                          <Image
                            src={player.professional_teams.logo_url}
                            alt=""
                            width={20}
                            height={20}
                            unoptimized
                            className="h-5 w-5 rounded object-contain"
                          />
                        )}
                        {player.professional_teams?.name || 'Free agent'}
                      </div>
                    </td>
                  ))}
                </ComparisonRow>
                <ComparisonRow label="Current price">
                  {players.map((player) => (
                    <td key={player.id} className="p-4 font-mono text-sm font-semibold text-white">
                      {formatPrice(player.current_price)}
                    </td>
                  ))}
                </ComparisonRow>
                <ComparisonRow label="Latest price movement">
                  {players.map((player) => {
                    const movement = player.price_change;
                    const color = movement == null || movement === 0
                      ? 'text-slate-300'
                      : movement > 0 ? 'text-emerald-400' : 'text-rose-400';
                    return (
                      <td key={player.id} className={`p-4 text-sm font-medium ${color}`}>
                        {formatPriceChange(movement)}
                      </td>
                    );
                  })}
                </ComparisonRow>
                <ComparisonRow label="Latest gameweek points">
                  {players.map((player) => (
                    <td key={player.id} className="p-4 text-sm font-semibold text-white">
                      {formatPoints(player.gameweek_points)}
                    </td>
                  ))}
                </ComparisonRow>
                <ComparisonRow label="Average recent points">
                  {players.map((player) => (
                    <td key={player.id} className="p-4 text-sm font-semibold text-white">
                      {formatPoints(player.recent_points)}
                      <span className="ml-1 text-xs font-normal text-slate-500">last 5 gameweeks</span>
                    </td>
                  ))}
                </ComparisonRow>
                <ComparisonRow label="Availability">
                  {players.map((player) => {
                    const available = player.availability_status === 'available';
                    return (
                      <td key={player.id} className="p-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          available
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                        }`}>
                          {player.availability_status || 'Unknown'}
                        </span>
                      </td>
                    );
                  })}
                </ComparisonRow>
                <ComparisonRow label="Upcoming matches">
                  {players.map((player) => (
                    <td key={player.id} className="p-4 align-top">
                      <UpcomingMatches
                        player={player}
                        matches={player.team_id == null ? [] : upcomingByTeam.get(player.team_id) ?? []}
                      />
                    </td>
                  ))}
                </ComparisonRow>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Recent points use the last five recorded gameweek scores. Price movement is the latest recorded player price change.
          </p>
        </>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <tr>
      <th scope="row" className="bg-slate-900/30 p-4 text-sm font-medium text-slate-400">
        {label}
      </th>
      {children}
    </tr>
  );
}

function UpcomingMatches({
  player,
  matches,
}: {
  player: ComparisonPlayer;
  matches: TeamMatch[];
}) {
  if (player.team_id == null) return <p className="text-sm text-slate-500">No team schedule</p>;
  if (matches.length === 0) return <p className="text-sm text-slate-500">No upcoming matches</p>;

  return (
    <ul className="space-y-2">
      {matches.map((match) => {
        const opponent = match.team_a_id === player.team_id
          ? match.team_b?.name
          : match.team_a?.name;
        return (
          <li key={match.id} className="rounded-lg border border-slate-700/80 bg-slate-900/40 p-2.5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-white">
              <CalendarDays className="h-3.5 w-3.5 text-cyan-400" />
              vs {opponent || 'Opponent TBA'}
            </p>
            <p className="mt-1 text-xs text-slate-400">{formatMatchDate(match.scheduled_time)}</p>
            {match.tournaments?.name && (
              <p className="mt-1 truncate text-xs text-slate-500">{match.tournaments.name}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
