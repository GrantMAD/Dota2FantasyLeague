import type { SupabaseClient } from '@supabase/supabase-js';

interface LeagueRankActivity {
  league_id: number;
  metadata: unknown;
}

export function parseLeagueRankMovement(metadata: unknown): number | null {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return null;

  const record = metadata as Record<string, unknown>;
  const fromRank = record.from_rank;
  const toRank = record.to_rank;
  if (
    typeof fromRank !== 'number' ||
    !Number.isSafeInteger(fromRank) ||
    typeof toRank !== 'number' ||
    !Number.isSafeInteger(toRank) ||
    fromRank < 1 ||
    toRank < 1 ||
    fromRank === toRank
  ) {
    return null;
  }

  return fromRank - toRank;
}

export async function fetchLeagueRankMovements(
  supabase: SupabaseClient,
  userId: string,
  fantasySeasonId: number,
  leagueIds: number[],
): Promise<Map<number, number>> {
  const movements = new Map<number, number>();
  const validLeagueIds = Array.from(new Set(leagueIds.filter((id) => Number.isSafeInteger(id) && id > 0)));

  await Promise.all(validLeagueIds.map(async (leagueId) => {
    const { data, error } = await supabase
      .from('league_activity')
      .select('league_id, metadata')
      .eq('league_id', leagueId)
      .eq('fantasy_season_id', fantasySeasonId)
      .eq('actor_user_id', userId)
      .eq('activity_type', 'rank_change')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<LeagueRankActivity>();

    if (error) {
      console.warn(`Unable to fetch rank movement for league ${leagueId}:`, error.message);
      return;
    }

    if (!data) return;
    const movement = parseLeagueRankMovement(data.metadata);
    if (movement !== null) movements.set(leagueId, movement);
  }));

  return movements;
}
