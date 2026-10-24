import GameweeksPageClient from './GameweeksPageClient';
import { getInitialGameweeks } from '@/lib/gameweeks-initial-data';
export type { GameweekRow } from '@/types/fantasy';

export const revalidate = 60;

export default async function GameweeksPage() {
  const { gameweeks } = await getInitialGameweeks();
  return <GameweeksPageClient initialGameweeks={gameweeks} />;
}
