import { supabaseServer } from '@/lib/supabase';
import { getLeaderboardData, type LeaderboardData } from '@/lib/leaderboard-data';
import LeaderboardPageClient from './LeaderboardPageClient';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  let initialData: LeaderboardData | null = null;

  try {
    initialData = await getLeaderboardData(supabaseServer(), {
      seasonId: null,
      gameweekId: null,
      country: null,
      page: 1,
      limit: 50,
    });
  } catch (error) {
    console.error('Unable to load initial leaderboard data:', error);
  }

  return <LeaderboardPageClient initialData={initialData} />;
}
