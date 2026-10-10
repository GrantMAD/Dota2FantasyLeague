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
  userId: string,
  requestedSeasonId?: number
): Promise<EnsureFantasySeasonResult | null> {
  let seasonId = requestedSeasonId;

  if (seasonId === undefined) {
    // Prefer the active season over a newer season that is still being planned.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activeSeason, error: activeSeasonError } = await (supabase.from('seasons') as any)
      .select('id')
      .eq('status', 'active')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeSeasonError) throw new Error('Failed to determine the active fantasy season.');
    seasonId = activeSeason?.id;

    if (!seasonId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: futureSeason, error: futureSeasonError } = await (supabase.from('seasons') as any)
        .select('id')
        .eq('status', 'planning')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (futureSeasonError) throw new Error('Failed to determine the next fantasy season.');
      seasonId = futureSeason?.id;
    }

    if (!seasonId) {
      // Preserve the existing fallback when the database has no active or planned season.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: latestSeason, error: latestSeasonError } = await (supabase.from('seasons') as any)
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestSeasonError) throw new Error('Failed to determine the latest fantasy season.');
      seasonId = latestSeason?.id;
    }
  }

  if (!seasonId) {
    return {
      id: 0,
      season_id: 0,
      budget: 100,
      free_transfers: 2,
      total_points: 0,
      global_rank: null,
      created: false,
    };
  }

  // Find this user's enrollment in the requested season, not an arbitrary prior season.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: existingError } = await (supabase.from('fantasy_seasons') as any)
    .select('id, season_id, budget, free_transfers, total_points, global_rank')
    .eq('user_id', userId)
    .eq('season_id', seasonId)
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error('Failed to load the fantasy season enrollment.');

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

  // Create the initial enrollment for this season.
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

  if (insertError?.code === '23505') {
    // Another request may have created the unique user/season enrollment concurrently.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: concurrentSeason, error: concurrentSeasonError } = await (supabase.from('fantasy_seasons') as any)
      .select('id, season_id, budget, free_transfers, total_points, global_rank')
      .eq('user_id', userId)
      .eq('season_id', seasonId)
      .maybeSingle();
    if (concurrentSeasonError) throw new Error('Failed to load the concurrently created fantasy season.');
    if (concurrentSeason) {
      return {
        id: concurrentSeason.id,
        season_id: concurrentSeason.season_id,
        budget: Number(concurrentSeason.budget ?? 100),
        free_transfers: Number(concurrentSeason.free_transfers ?? 2),
        total_points: Number(concurrentSeason.total_points ?? 0),
        global_rank: concurrentSeason.global_rank ?? null,
        created: false,
      };
    }
  }

  if (insertError || !newSeason) throw new Error('Failed to create the fantasy season enrollment.');

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
