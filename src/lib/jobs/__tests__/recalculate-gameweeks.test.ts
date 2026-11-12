/// <reference types="jest" />

import { createClient } from '@supabase/supabase-js';
import { getLatestGameweekPoints, recalculateGameweeks } from '../recalculate-gameweeks';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('Recalculate gameweeks job', () => {
  it('uses the latest active or closed gameweek instead of a future lineup', () => {
    expect(getLatestGameweekPoints(
      [
        { gameweek_id: 3, total_points: 6157.95 },
        { gameweek_id: 5, total_points: 241.46 },
        { gameweek_id: 12, total_points: 0 },
      ],
      [
        { id: 3, status: 'closed' },
        { id: 5, status: 'active' },
        { id: 12, status: 'upcoming' },
      ],
    )).toBe(241.46);
  });

  it('falls back to the latest closed gameweek when none is active', () => {
    expect(getLatestGameweekPoints(
      [
        { gameweek_id: 3, total_points: 6157.95 },
        { gameweek_id: 12, total_points: 0 },
      ],
      [
        { id: 3, status: 'closed' },
        { id: 12, status: 'upcoming' },
      ],
    )).toBe(6157.95);
  });

  it('does not overwrite season-wide global ranks while recalculating a closed gameweek', async () => {
    const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
    const lineup = {
      id: 100,
      fantasy_season_id: 10,
      gameweek_id: 1,
      carry_id: 1,
      mid_id: 2,
      offlane_id: 3,
      support_id: 4,
      hard_support_id: 5,
      bench_1_id: null,
      bench_2_id: null,
      bench_3_id: null,
      captain_player_id: 1,
      vice_captain_player_id: null,
      fantasy_seasons: {
        triple_captain_gameweek_id: null,
        bench_boost_gameweek_id: null,
      },
    };
    type Query = {
      select: jest.Mock;
      in: jest.Mock;
      eq: jest.Mock;
      order: jest.Mock;
      update: jest.Mock;
      then: jest.Mock;
    };

    const supabase = {
      from: jest.fn((table: string) => {
        let selection = '';
        let updateValues: Record<string, unknown> | null = null;
        const query: Query = {
          select: jest.fn((value: string) => {
            selection = value;
            return query;
          }),
          in: jest.fn(() => query),
          eq: jest.fn(() => query),
          order: jest.fn(() => query),
          update: jest.fn((values: Record<string, unknown>) => {
            updateValues = values;
            updates.push({ table, values });
            return query;
          }),
          then: jest.fn((resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
            const response = updateValues
              ? { error: null }
              : table === 'gameweeks'
                ? { data: [{ id: 1, season_id: 1, status: 'closed' }], error: null }
                : table === 'professional_players' || table === 'player_performances'
                  ? { data: [], error: null }
                  : table === 'fantasy_lineups' && selection.includes('fantasy_seasons')
                    ? { data: [lineup], error: null }
                    : table === 'fantasy_lineups'
                      ? { data: [{ gameweek_id: 1, total_points: 0 }], error: null }
                      : { data: null, error: null };
            return Promise.resolve(response).then(resolve, reject);
          }),
        };
        return query;
      }),
    };
    (createClient as jest.Mock).mockReturnValue(supabase);

    const result = await recalculateGameweeks();

    expect(result.success).toBe(true);
    expect(updates).toContainEqual({
      table: 'fantasy_seasons',
      values: {
        total_points: 0,
        gameweek_points_latest: 0,
      },
    });
    expect(updates.some(({ table, values }) => table === 'fantasy_seasons' && 'global_rank' in values)).toBe(false);
  });
});
