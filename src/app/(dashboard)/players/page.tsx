import PlayersPageClient from './PlayersPageClient';
import { getPlayersCatalogData, type PlayersCatalogResponse } from '@/lib/players-catalog';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function PlayersPage() {
  let initialData: PlayersCatalogResponse | null = null;

  try {
    initialData = await getPlayersCatalogData(
      supabaseServer(),
      new URLSearchParams({
        limit: '20',
        offset: '0',
        sort: 'price',
        desc: 'true',
      }),
    );
  } catch (error) {
    console.error('Unable to load initial player directory data:', error);
  }

  return <PlayersPageClient initialData={initialData} />;
}
