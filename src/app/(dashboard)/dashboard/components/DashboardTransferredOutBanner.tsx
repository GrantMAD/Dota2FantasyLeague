import type { DashboardStarter } from '@/types/fantasy';

export function DashboardTransferredOutBanner({ players }: { players: DashboardStarter[] }) {
  const transferredOutPlayers = players
    .filter((player) => player.transferred_out)
    .map((player) => player.in_game_name || player.name);

  if (transferredOutPlayers.length === 0) return null;

  return (
    <div
      role="status"
      aria-label="Players no longer in your squad"
      className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3"
    >
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        No longer in your squad: {transferredOutPlayers.join(', ')}
      </p>
      <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
        These players remain in this gameweek&apos;s saved lineup but won&apos;t be available for the next gameweek.
      </p>
    </div>
  );
}
