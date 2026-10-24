import MatchesPageClient from './MatchesPageClient';
import { getInitialMatchesData } from '@/lib/matches-initial-data';

export const revalidate = 60;

export default async function MatchesPage() {
  const initialData = await getInitialMatchesData();
  return <MatchesPageClient initialData={initialData} />;
}
