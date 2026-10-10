import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrCreateFantasySeason } from './fantasy-season';

type QueryStub = {
  select: () => QueryStub;
  eq: (column: string, value: string | number) => QueryStub;
  order: () => QueryStub;
  limit: () => QueryStub;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: null }>;
};

function createQuery(
  table: string,
  filters: Record<string, string | number>,
  seasonData: Record<string, unknown> | null,
  fantasyData: Record<string, unknown> | null,
): QueryStub {
  const query: QueryStub = {
    select: () => query,
    eq: (column, value) => {
      filters[`${table}.${column}`] = value;
      return query;
    },
    order: () => query,
    limit: () => query,
    maybeSingle: async () => ({
      data: table === 'seasons' ? seasonData : fantasyData,
      error: null,
    }),
  };
  return query;
}

function createSupabaseStub(
  seasonData: Record<string, unknown> | null,
  fantasyData: Record<string, unknown> | null,
  filters: Record<string, string | number>,
  tablesQueried: string[],
): SupabaseClient {
  return {
    from: (table: string) => {
      tablesQueried.push(table);
      return createQuery(table, filters, seasonData, fantasyData);
    },
  } as unknown as SupabaseClient;
}

describe('getOrCreateFantasySeason season isolation', () => {
  it('loads an enrollment only for the active season, even if older enrollments exist', async () => {
    const filters: Record<string, string | number> = {};
    const tablesQueried: string[] = [];
    const supabase = createSupabaseStub(
      { id: 8 },
      { id: 42, season_id: 8, budget: 90, free_transfers: 1, total_points: 20, global_rank: 3 },
      filters,
      tablesQueried,
    );

    const result = await getOrCreateFantasySeason(supabase, 'manager-1');

    expect(tablesQueried).toEqual(['seasons', 'fantasy_seasons']);
    expect(filters).toMatchObject({
      'seasons.status': 'active',
      'fantasy_seasons.user_id': 'manager-1',
      'fantasy_seasons.season_id': 8,
    });
    expect(result).toMatchObject({ id: 42, season_id: 8, budget: 90, created: false });
  });

  it('uses an explicitly requested season without resolving a different active season', async () => {
    const filters: Record<string, string | number> = {};
    const tablesQueried: string[] = [];
    const supabase = createSupabaseStub(
      null,
      { id: 16, season_id: 3, budget: 100, free_transfers: 2, total_points: 0, global_rank: null },
      filters,
      tablesQueried,
    );

    const result = await getOrCreateFantasySeason(supabase, 'manager-1', 3);

    expect(tablesQueried).toEqual(['fantasy_seasons']);
    expect(filters['fantasy_seasons.season_id']).toBe(3);
    expect(result).toMatchObject({ id: 16, season_id: 3, created: false });
  });
});
