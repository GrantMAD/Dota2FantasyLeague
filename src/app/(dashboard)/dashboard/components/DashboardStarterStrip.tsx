import type { DashboardStarter } from '@/types/fantasy';
import { DashboardStarterCard } from './DashboardStarterCard';

interface DashboardStarterStripProps {
  starters: DashboardStarter[];
  onOpenPlayer: (player: DashboardStarter) => void;
}

export function DashboardStarterStrip({ starters, onOpenPlayer }: DashboardStarterStripProps) {
  const sortedStarters = [...starters].sort((a, b) => {
    const getRank = (player: DashboardStarter) => (player.is_captain ? 0 : player.is_vice_captain ? 1 : 2);
    return getRank(a) - getRank(b);
  });

  return (
    <>
      <p id="starting-five-scroll-help" className="sr-only">
        Scroll horizontally to view all Starting Five players.
      </p>
      <p aria-hidden="true" className="mb-2 text-[10px] text-[var(--text-muted)] xl:hidden">
        Swipe horizontally to view all starters
      </p>
      <div
        role="region"
        aria-label="Starting Five player cards"
        aria-describedby="starting-five-scroll-help"
        tabIndex={0}
        className="-mx-5 overflow-x-auto px-5 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] xl:mx-0 xl:overflow-visible xl:px-0"
      >
        <div className="flex w-max snap-x snap-mandatory gap-3 xl:grid xl:w-full xl:grid-cols-5 xl:snap-none">
          {sortedStarters.map((player, index) => (
            <div key={`${player.slot}-${player.id}`} className="w-[220px] shrink-0 snap-start xl:w-auto">
              <DashboardStarterCard
                player={player}
                index={index}
                onOpenPlayer={onOpenPlayer}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
