'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

type MatchDetail = {
  id: number;
  status: string;
  scheduled_at: string;
  duration_seconds: number | null;
  winner_team_id: number | null;
  radiant_team_id: number;
  dire_team_id: number;
  radiant_team?: { name: string; tag?: string } | null;
  dire_team?: { name: string; tag?: string } | null;
  tournaments?: { name: string } | null;
  gameweeks?: { gameweek_number: number; status: string } | null;
};

type MatchApiResponse = {
  match?: MatchDetail;
};

export default function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMatch() {
      try {
        const response = await fetch(`/api/matches/${id}`);
        const data = (await response.json()) as MatchApiResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Failed to load match');
        setMatch(data.match ?? null);
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : 'Failed to load match');
      } finally {
        setLoading(false);
      }
    }

    void loadMatch();
  }, [id]);

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-slate-400">Loading match...</div>;
  }

  if (error || !match) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h1 className="mb-3 text-3xl font-bold text-white">Match unavailable</h1>
        <p className="mb-6 text-slate-400">{error || 'This match could not be found.'}</p>
        <Link href="/matches" className="text-amber-500 hover:text-amber-400">Back to Matches</Link>
      </div>
    );
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Not completed';
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };
  const isRadiantWinner = match.winner_team_id === match.radiant_team_id;
  const isDireWinner = match.winner_team_id === match.dire_team_id;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link href="/matches" className="mb-8 inline-flex text-slate-400 hover:text-white">Back to Matches</Link>
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <p className="mb-2 text-sm text-amber-500">{match.tournaments?.name || 'Professional Match'}</p>
            <h1 className="text-3xl font-bold text-white">Match Details</h1>
            <p className="mt-2 text-slate-400">{new Date(match.scheduled_at).toLocaleString()}</p>
          </div>
          <span className="rounded-full bg-slate-700 px-3 py-1 text-sm capitalize text-slate-300">{match.status.replace('_', ' ')}</span>
        </div>

        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
          <div className={`text-center ${isRadiantWinner ? 'text-white' : 'text-slate-300'}`}>
            <div className="mb-2 text-4xl font-bold">{match.radiant_team?.tag || 'RAD'}</div>
            <div className="text-xl font-semibold">{match.radiant_team?.name || 'Radiant'}</div>
            {isRadiantWinner && <p className="mt-2 text-sm text-emerald-400">Winner</p>}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-500">{match.status === 'completed' ? `${isRadiantWinner ? 1 : 0} : ${isDireWinner ? 1 : 0}` : 'VS'}</p>
            <p className="mt-2 text-xs text-slate-500">{formatDuration(match.duration_seconds)}</p>
          </div>
          <div className={`text-center ${isDireWinner ? 'text-white' : 'text-slate-300'}`}>
            <div className="mb-2 text-4xl font-bold">{match.dire_team?.tag || 'DIR'}</div>
            <div className="text-xl font-semibold">{match.dire_team?.name || 'Dire'}</div>
            {isDireWinner && <p className="mt-2 text-sm text-emerald-400">Winner</p>}
          </div>
        </div>

        {match.gameweeks && <p className="mt-8 border-t border-slate-700 pt-4 text-sm text-slate-400">Gameweek {match.gameweeks.gameweek_number} · {match.gameweeks.status}</p>}
      </div>
    </div>
  );
}
