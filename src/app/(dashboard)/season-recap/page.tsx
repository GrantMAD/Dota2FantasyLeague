'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Share2, Sparkles, Trophy } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import {
  createSeasonRecapShareCardSvg,
  formatSeasonDate,
  getSeasonRecapShareText,
  type SeasonRecap,
} from '@/lib/season-recap';

type RecapResponse = { recaps?: SeasonRecap[]; error?: string };

export default function SeasonRecapPage() {
  const [recaps, setRecaps] = useState<SeasonRecap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharingConsent, setSharingConsent] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyRecapId, setBusyRecapId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRecaps() {
      try {
        const response = await fetchWithAuth('/api/season-recap');
        const data = (await response.json()) as RecapResponse;
        if (!response.ok) throw new Error(data.error || `Unable to load season recaps (${response.status})`);
        if (!cancelled) setRecaps(data.recaps ?? []);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load season recaps');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRecaps();
    return () => {
      cancelled = true;
    };
  }, []);

  const shareRecap = async (recap: SeasonRecap) => {
    if (!sharingConsent) return;
    setBusyRecapId(recap.fantasySeasonId);
    setFeedback(null);
    try {
      const text = getSeasonRecapShareText(recap);
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `${recap.seasonName} recap`, text });
        setFeedback('Your recap was shared.');
      } else {
        await navigator.clipboard.writeText(text);
        setFeedback('Privacy-safe recap copied to your clipboard.');
      }
    } catch (shareError: unknown) {
      if (shareError instanceof Error && shareError.name === 'AbortError') return;
      setFeedback(shareError instanceof Error ? `Could not share recap: ${shareError.message}` : 'Could not share recap.');
    } finally {
      setBusyRecapId(null);
    }
  };

  const downloadCard = (recap: SeasonRecap) => {
    if (!sharingConsent) return;
    const blob = new Blob([createSeasonRecapShareCardSvg(recap)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dota-fantasy-${recap.seasonName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-recap.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
    setFeedback('Privacy-safe recap card downloaded.');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Season recap</h1>
        </div>
        <p className="text-slate-400">
          Look back at your finished seasons, standout gameweeks, and top-scoring picks.
        </p>
      </header>

      {loading && <p className="animate-pulse text-slate-300" role="status">Loading season recaps...</p>}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-5 text-rose-200">
          {error}
        </div>
      )}
      {!loading && !error && recaps.length === 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-8 text-center">
          <Trophy className="mx-auto h-8 w-8 text-slate-500" />
          <h2 className="mt-3 text-lg font-semibold text-white">Your season recap will appear here</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
            Once a season has ended and its gameweeks have been finalized, we will summarize your results here.
          </p>
          <Link href="/gameweeks" className="mt-5 inline-flex text-sm font-medium text-cyan-300 hover:text-cyan-200">
            View gameweeks
          </Link>
        </div>
      )}

      {feedback && (
        <p role="status" className="mb-4 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-200">
          {feedback}
        </p>
      )}

      {recaps.length > 0 && (
        <section className="mb-6 rounded-xl border border-slate-700 bg-slate-800/40 p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={sharingConsent}
              onChange={(event) => setSharingConsent(event.target.checked)}
              className="mt-1 h-4 w-4 accent-cyan-400"
            />
            <span>
              <span className="block text-sm font-semibold text-white">I choose to share a privacy-safe recap</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                Sharing includes season results and selected player statistics only. It does not include your manager name,
                account details, squad name, league name, or a public link.
              </span>
            </span>
          </label>
        </section>
      )}

      <div className="space-y-6">
        {recaps.map((recap) => (
          <article key={recap.fantasySeasonId} className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/40">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-700 p-5 sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Season recap</p>
                <h2 className="mt-1 text-2xl font-bold text-white">{recap.seasonName}</h2>
                {(formatSeasonDate(recap.startDate) || formatSeasonDate(recap.endDate)) && (
                  <p className="mt-1 text-sm text-slate-400">
                    {[formatSeasonDate(recap.startDate), formatSeasonDate(recap.endDate)].filter(Boolean).join(' — ')}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!sharingConsent || busyRecapId === recap.fantasySeasonId}
                  onClick={() => void shareRecap(recap)}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Share2 className="h-4 w-4" /> Share recap
                </button>
                <button
                  type="button"
                  disabled={!sharingConsent}
                  onClick={() => downloadCard(recap)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="h-4 w-4" /> Download card
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <RecapStat label="Season points" value={recap.totalPoints.toFixed(1)} />
              <RecapStat
                label="Final global rank"
                value={recap.finalGlobalRank != null ? `#${recap.finalGlobalRank}` : 'Not ranked'}
              />
              <RecapStat
                label="Best gameweek"
                value={recap.bestGameweek
                  ? `GW ${recap.bestGameweek.gameweek} · ${recap.bestGameweek.points.toFixed(1)} pts`
                  : 'No score recorded'}
              />
              <RecapStat
                label="Top-scoring pick"
                value={recap.topPlayer
                  ? `${recap.topPlayer.name} · ${recap.topPlayer.points.toFixed(1)} pts`
                  : 'No score recorded'}
              />
              <RecapStat
                label="Rank progress"
                value={recap.rankProgression
                  ? `#${recap.rankProgression.startingRank} → #${recap.rankProgression.finalRank}`
                  : 'Not available'}
              />
              <RecapStat
                label="Best league finish"
                value={recap.bestLeagueRank != null ? `#${recap.bestLeagueRank}` : 'No league result'}
              />
              <RecapStat label="Transfers made" value={String(recap.transferCount)} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function RecapStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
