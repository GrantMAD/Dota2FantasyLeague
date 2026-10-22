'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  AlertTriangle,
  Award,
  CheckCircle2,
  Download,
  Medal,
  Share2,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-with-auth';
import {
  createSeasonRecapShareCardSvg,
  formatSeasonDate,
  getSeasonRecapShareText,
  SEASON_RECAP_CARD_THEMES,
  type SeasonRecapCardTheme,
  type SeasonRecap,
} from '@/lib/season-recap';

type RecapResponse = { recaps?: SeasonRecap[]; error?: string };

export default function SeasonRecapPage() {
  const [recaps, setRecaps] = useState<SeasonRecap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharingConsent, setSharingConsent] = useState(false);
  const [cardTheme, setCardTheme] = useState<SeasonRecapCardTheme>('radiant');
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
    const blob = new Blob([createSeasonRecapShareCardSvg(recap, cardTheme)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dota-fantasy-${recap.seasonName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-recap.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
    setFeedback('Privacy-safe recap card downloaded.');
  };

  const selectedCardTheme = SEASON_RECAP_CARD_THEMES.find((theme) => theme.id === cardTheme)
    ?? SEASON_RECAP_CARD_THEMES[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <header className="relative mb-8 overflow-hidden rounded-2xl border border-cyan-500/30 bg-[var(--surface)] p-6 shadow-xl shadow-cyan-500/5 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.14),transparent_55%)]" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400" />
        <div className="relative">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
              <Sparkles className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">Your season, distilled</p>
              <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)]">Season recap</h1>
            </div>
          </div>
          <p className="max-w-2xl text-sm text-[var(--text-secondary)]">
            Look back at your finished seasons, standout gameweeks, and top-scoring picks.
          </p>
        </div>
      </header>

      {loading && (
        <div className="space-y-6 animate-pulse" role="status" aria-label="Loading season recaps">
          {[1, 2, 3].map((recap) => (
            <article key={recap} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] p-5 sm:p-6">
                <div className="space-y-3">
                  <div className="h-3 w-24 rounded bg-[var(--surface-muted)]" />
                  <div className="h-7 w-48 rounded bg-[var(--surface-muted)]" />
                  <div className="h-4 w-36 rounded bg-[var(--surface-raised)]" />
                </div>
                <div className="flex gap-2">
                  <div className="h-9 w-28 rounded-lg bg-[var(--surface-muted)]" />
                  <div className="h-9 w-28 rounded-lg bg-[var(--surface-muted)]" />
                </div>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
                {[1, 2, 3, 4].map((metric) => (
                  <div key={metric} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
                    <div className="h-3 w-24 rounded bg-[var(--surface-muted)]" />
                    <div className="mt-3 h-7 w-16 rounded bg-[var(--surface-muted)]" />
                  </div>
                ))}
              </div>
              <div className="space-y-3 px-5 pb-5 sm:px-6 sm:pb-6">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3">
                    <div className="h-9 w-9 rounded-full bg-[var(--surface-muted)]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 rounded bg-[var(--surface-muted)]" />
                      <div className="h-3 w-24 rounded bg-[var(--surface-raised)]" />
                    </div>
                    <div className="h-4 w-12 rounded bg-[var(--surface-muted)]" />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}
      {!loading && !error && recaps.length === 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <Trophy className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
          <h2 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">Your season recap will appear here</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--text-secondary)]">
            Once a season has ended and its gameweeks have been finalized, we will summarize your results here.
          </p>
          <Link href="/gameweeks" className="mt-5 inline-flex text-sm font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200">
            View gameweeks
          </Link>
        </div>
      )}

      {feedback && (
        <div
          role={feedback.startsWith('Could not') ? 'alert' : 'status'}
          className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            feedback.startsWith('Could not')
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200'
              : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-800 dark:text-cyan-100'
          }`}
        >
          {feedback.startsWith('Could not')
            ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-current" />
            : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-current" />}
          <p>{feedback}</p>
        </div>
      )}

      {recaps.length > 0 && (
        <section className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg shadow-cyan-500/5 sm:p-6">
          <div className="flex items-start gap-3">
            <input
              id="season-recap-sharing-consent"
              type="checkbox"
              checked={sharingConsent}
              onChange={(event) => setSharingConsent(event.target.checked)}
              className="mt-1 h-4 w-4 accent-cyan-500"
            />
            <div>
              <label htmlFor="season-recap-sharing-consent" className="cursor-pointer text-sm font-bold text-[var(--text-primary)]">
                I choose to enable recap sharing and downloads
              </label>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                Sharing and downloading create a copy you can give to others, so both actions stay disabled until you opt in.
                Nothing is published automatically.
              </p>
              <details className="group mt-3 text-sm">
                <summary className="w-fit cursor-pointer font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200">
                  What information is included?
                </summary>
                <p className="mt-2 max-w-3xl leading-relaxed text-[var(--text-secondary)]">
                  A shared recap may include your season results and selected player statistics, such as points, rankings,
                  best gameweek, top-scoring pick, and transfer count. It excludes your manager name, account details,
                  squad name, league name, and public links.
                </p>
              </details>
            </div>
          </div>
          <fieldset className="mt-5">
            <legend className="mb-3 text-sm font-bold text-[var(--text-primary)]">Choose your card style</legend>
            <div role="group" aria-label="Recap card theme" className="grid gap-3 sm:grid-cols-3">
              {SEASON_RECAP_CARD_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  aria-pressed={cardTheme === theme.id}
                  onClick={() => setCardTheme(theme.id)}
                  className={`relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
                    cardTheme === theme.id
                      ? 'border-cyan-500 ring-2 ring-cyan-500/20'
                      : 'border-[var(--border)] hover:-translate-y-0.5 hover:border-cyan-500/50'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="mb-3 block h-12 rounded-lg border"
                    style={{
                      background: `linear-gradient(120deg, ${theme.startColor}, ${theme.endColor})`,
                      borderColor: `${theme.borderColor}88`,
                    }}
                  >
                    <span className="ml-2 mt-2 block h-1 w-10 rounded-full" style={{ backgroundColor: theme.accentColor }} />
                    <span className="ml-2 mt-1.5 block h-1 w-16 rounded-full opacity-70" style={{ backgroundColor: theme.labelColor }} />
                  </span>
                  <span className="flex items-center justify-between gap-2 text-sm font-bold text-[var(--text-primary)]">
                    {theme.name}
                    {cardTheme === theme.id && <CheckCircle2 className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{theme.description}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </section>
      )}

      <div className="space-y-6">
        {recaps.map((recap) => (
          <article key={recap.fantasySeasonId} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-cyan-950/5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] p-5 sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">Season recap</p>
                <h2 className="mt-1 text-2xl font-black text-[var(--text-primary)]">{recap.seasonName}</h2>
                {(formatSeasonDate(recap.startDate) || formatSeasonDate(recap.endDate)) && (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {[formatSeasonDate(recap.startDate), formatSeasonDate(recap.endDate)].filter(Boolean).join(' — ')}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!sharingConsent || busyRecapId === recap.fantasySeasonId}
                  onClick={() => void shareRecap(recap)}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-cyan-600/20 transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Share2 className="h-4 w-4" /> {busyRecapId === recap.fantasySeasonId ? 'Sharing…' : 'Share recap'}
                </button>
                <button
                  type="button"
                  disabled={!sharingConsent}
                  onClick={() => downloadCard(recap)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] transition hover:border-cyan-500/50 hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="h-4 w-4" /> Download card
                </button>
              </div>
            </div>

            <figure className="relative isolate overflow-hidden border-b border-[var(--border)] bg-[var(--surface-raised)] p-4 sm:p-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl"
                style={{ backgroundColor: selectedCardTheme.accentColor }}
              />
              <div className="relative z-10 mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xl">
                <Image
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(createSeasonRecapShareCardSvg(recap, cardTheme))}`}
                  alt={`Preview of the ${recap.seasonName} ${selectedCardTheme.name} recap card`}
                  width={800}
                  height={640}
                  unoptimized
                  sizes="(max-width: 672px) 100vw, 672px"
                  className="h-auto w-full rounded-xl"
                />
              </div>
              <figcaption className="mt-4 text-center text-xs font-medium text-[var(--text-secondary)]">
                Live preview · {selectedCardTheme.name} theme
              </figcaption>
            </figure>

            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <RecapStat icon={Trophy} accent="amber" label="Season points" value={recap.totalPoints.toFixed(1)} />
              <RecapStat
                icon={Medal}
                accent="cyan"
                label="Final global rank"
                value={recap.finalGlobalRank != null ? `#${recap.finalGlobalRank}` : 'Not ranked'}
              />
              <RecapStat
                icon={Zap}
                accent="emerald"
                label="Best gameweek"
                value={recap.bestGameweek
                  ? `GW ${recap.bestGameweek.gameweek} · ${recap.bestGameweek.points.toFixed(1)} pts`
                  : 'No score recorded'}
              />
              <RecapStat
                icon={Star}
                accent="amber"
                label="Top-scoring pick"
                value={recap.topPlayer
                  ? `${recap.topPlayer.name} · ${recap.topPlayer.points.toFixed(1)} pts`
                  : 'No score recorded'}
              />
              <RecapStat
                icon={TrendingUp}
                accent="cyan"
                label="Rank progress"
                value={recap.rankProgression
                  ? `#${recap.rankProgression.startingRank} → #${recap.rankProgression.finalRank}`
                  : 'Not available'}
              />
              <RecapStat
                icon={Award}
                accent="violet"
                label="Best league finish"
                value={recap.bestLeagueRank != null ? `#${recap.bestLeagueRank}` : 'No league result'}
              />
              <RecapStat icon={Users} accent="rose" label="Transfers made" value={String(recap.transferCount)} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function RecapStat({
  icon: Icon,
  accent,
  label,
  value,
}: {
  icon: LucideIcon;
  accent: 'amber' | 'cyan' | 'emerald' | 'violet' | 'rose';
  label: string;
  value: string;
}) {
  const accentClasses = {
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    violet: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
    rose: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  }[accent];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
          <p className="mt-2 break-words text-lg font-bold text-[var(--text-primary)]">{value}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${accentClasses}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
