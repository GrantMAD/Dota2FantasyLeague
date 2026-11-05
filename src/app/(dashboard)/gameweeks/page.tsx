import React from 'react';
import { Suspense } from 'react';
import GameweeksPageClient from './GameweeksPageClient';
import { getInitialGameweeks } from '@/lib/gameweeks-initial-data';
import type { GameweekRow } from '@/types/fantasy';
export type { GameweekRow };

export const revalidate = 60;

export default async function GameweeksPage() {
  let gameweeks: GameweekRow[] = [];
  try {
    ({ gameweeks } = await getInitialGameweeks());
  } catch (error) {
    console.error('[Gameweeks] Failed to load prerendered data; the client will retry:', error);
    gameweeks = [];
  }
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <GameweeksPageClient initialGameweeks={gameweeks} />
    </Suspense>
  );
}
