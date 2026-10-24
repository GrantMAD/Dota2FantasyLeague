import React from 'react';
import MatchesPageClient from './MatchesPageClient';
import { getInitialMatchesData } from '@/lib/matches-initial-data';

export const revalidate = 60;

export default async function MatchesPage() {
  let initialData;
  try {
    initialData = await getInitialMatchesData();
  } catch (error) {
    console.error('[Matches] Failed to load prerendered data; the client will retry:', error);
    initialData = {
      matches: [],
      tournaments: [],
      pagination: { page: 1, limit: 24, total: 0, totalPages: 0 },
      counts: { all: 0, live: 0, upcoming: 0, completed: 0 },
      activeGameweekId: null,
    };
  }
  return <MatchesPageClient initialData={initialData} />;
}
