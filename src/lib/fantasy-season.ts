import { SupabaseClient } from '@supabase/supabase-js';

export interface EnsureFantasySeasonResult {
  id: number;
  season_id: number;
  budget: number;
  free_transfers: number;
  total_points: number;
  global_rank: number | null;
  created?: boolean;
}

/**
 * Ensures the user has an enrolled fantasy_season record for the currently active season.
 * Defaults to 100M budget and 2 free transfers.
 */
export async function getOrCreateFantasySeason(
  supabase: SupabaseClient,
  userId: string
): Promise<EnsureFantasySeasonResult | null> {
  // 1. Try to fetch existing fantasy_season for this user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('fantasy_seasons') as any)
    .select('id, season_id, budget, free_transfers, total_points, global_rank')
    .eq('user_id', userId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      season_id: existing.season_id,
      budget: Number(existing.budget ?? 100),
      free_transfers: Number(existing.free_transfers ?? 2),
      total_points: Number(existing.total_points ?? 0),
      global_rank: existing.global_rank ?? null,
      created: false,
    };
  }

  // 2. Fetch the active or latest season to bind to
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeSeason } = await (supabase.from('seasons') as any)
    .select('id')
    .in('status', ['active', 'upcoming', 'planning'])
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  // If no active season found, grab any latest season
  let seasonId = activeSeason?.id;
  if (!seasonId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: anySeason } = await (supabase.from('seasons') as any)
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    seasonId = anySeason?.id;
  }

  if (!seasonId) {
    // Return standard defaults even if no season exists
    return {
      id: 0,
      season_id: 0,
      budget: 100.0,
      free_transfers: 2,
      total_points: 0,
      global_rank: null,
      created: false,
    };
  }

  // 3. Create the initial fantasy_seasons record with standard defaults: 100M budget and 2 free transfers
  const initialBudget = 100.0;
  const initialFreeTransfers = 2;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newSeason, error: insertError } = await (supabase.from('fantasy_seasons') as any)
    .insert({
      user_id: userId,
      season_id: seasonId,
      budget: initialBudget,
      free_transfers: initialFreeTransfers,
      total_points: 0,
      global_rank: null,
    })
    .select('id, season_id, budget, free_transfers, total_points, global_rank')
    .maybeSingle();

  if (insertError || !newSeason) {
    console.error('Failed to auto-create fantasy_seasons record:', insertError);
    return {
      id: 0,
      season_id: seasonId,
      budget: initialBudget,
      free_transfers: initialFreeTransfers,
      total_points: 0,
      global_rank: null,
      created: false,
    };
  }

  return {
    id: newSeason.id,
    season_id: newSeason.season_id,
    budget: Number(newSeason.budget ?? initialBudget),
    free_transfers: Number(newSeason.free_transfers ?? initialFreeTransfers),
    total_points: Number(newSeason.total_points ?? 0),
    global_rank: newSeason.global_rank ?? null,
    created: true,
  };
}
