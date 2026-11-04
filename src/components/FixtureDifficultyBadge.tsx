import type { FixtureDifficultyResult } from '@/lib/fixture-difficulty';

interface FixtureDifficultyBadgeProps {
  difficulty: FixtureDifficultyResult | undefined;
}

const RATING_STYLES: Record<number, string> = {
  1: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  2: 'border-lime-500/30 bg-lime-500/10 text-lime-700 dark:text-lime-300',
  3: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  4: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  5: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

export function FixtureDifficultyBadge({ difficulty }: FixtureDifficultyBadgeProps) {
  const rating = difficulty?.rating ?? null;
  const label = difficulty?.label ?? 'Unknown';
  const title = rating === null || difficulty?.winRate === null
    ? 'Opponent form unavailable: at least five recent completed results are required.'
    : `Opponent won ${difficulty?.wins} of their last ${difficulty?.games} completed matches (${difficulty?.winRate}%). Difficulty is based on up to ten results; 1 is easiest and 5 is hardest.`;

  return (
    <span
      title={title}
      aria-label={rating === null
        ? 'Fixture difficulty unknown; fewer than five recent completed results'
        : `Fixture difficulty ${rating} of 5, ${label}; opponent win rate ${difficulty?.winRate}% over ${difficulty?.games} matches`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        rating === null
          ? 'border-slate-400/30 bg-slate-400/10 text-slate-600 dark:text-slate-300'
          : RATING_STYLES[rating]
      }`}
    >
      <span>{rating === null ? '—' : `${rating}/5`}</span>
      <span>{label}</span>
    </span>
  );
}
