/// <reference types="jest" />

import { recalculateLeagues } from '../recalculate-leagues';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('Recalculate Leagues Job', () => {
  let mockSupabase: Record<string, jest.Mock>;
  let queryResults: unknown[];

  beforeEach(() => {
    queryResults = [];
    mockSupabase = {
      from: jest.fn(),
      select: jest.fn(),
      eq: jest.fn(),
      in: jest.fn(),
      is: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
      single: jest.fn(),
      then: jest.fn((resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(queryResults.shift()).then(resolve, reject)),
    };
    Object.values(mockSupabase).forEach((method) => method.mockReturnValue(mockSupabase));
    mockSupabase.then.mockImplementation((resolve, reject) =>
      Promise.resolve(queryResults.shift()).then(resolve, reject));
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully execute when no active leagues exist', async () => {
    queryResults.push(
      { data: [], error: null },
      { data: [], error: null },
    );

    const result = await recalculateLeagues();

    expect(result.success).toBe(true);
    expect(result.leaguesProcessed).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  it('should process classic leagues', async () => {
    queryResults.push(
      { data: [{ id: 1, scoring_type: 'total_points' }], error: null },
      { data: [], error: null },
      {
        data: [
          { id: 101, fantasy_seasons: { total_points: 50 } },
          { id: 102, fantasy_seasons: { total_points: 100 } },
        ],
        error: null,
      },
      { data: null, error: null },
      { data: null, error: null },
    );

    const result = await recalculateLeagues();

    expect(result.success).toBe(true);
    expect(result.leaguesProcessed).toBe(1);
    expect(result.classicLeaguesUpdated).toBe(1);
    // Should have updated rank 1 for id 102, rank 2 for id 101
    expect(mockSupabase.update).toHaveBeenCalledWith({ rank: 1, points: 100 });
    expect(mockSupabase.update).toHaveBeenCalledWith({ rank: 2, points: 50 });
  });

  it('should generate H2H fixtures', async () => {
    queryResults.push(
      { data: [{ id: 2, scoring_type: 'weekly_wins' }], error: null },
      { data: [{ id: 5, status: 'active' }], error: null },
      { data: [], error: null },
      { data: [{ id: 201 }, { id: 202 }, { id: 203 }], error: null },
      { data: null, error: null },
    );

    const result = await recalculateLeagues();

    expect(result.success).toBe(true);
    expect(result.leaguesProcessed).toBe(1);
    expect(result.h2hFixturesGenerated).toBeGreaterThan(0);
    expect(mockSupabase.insert).toHaveBeenCalled();
  });

  it('resumes fixture creation for participants not assigned before an interrupted run', async () => {
    queryResults.push(
      { data: [{ id: 2, scoring_type: 'weekly_wins' }], error: null },
      { data: [{ id: 5, status: 'active' }], error: null },
      {
        data: [{ participant_a_id: 201, participant_b_id: 202 }],
        error: null,
      },
      { data: [{ id: 201 }, { id: 202 }, { id: 203 }, { id: 204 }], error: null },
      { data: null, error: null },
    );

    const result = await recalculateLeagues();

    expect(result.success).toBe(true);
    expect(result.h2hFixturesGenerated).toBe(1);
    expect(mockSupabase.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        league_id: 2,
        gameweek_id: 5,
        participant_a_id: expect.any(Number),
        participant_b_id: expect.any(Number),
        is_bye: false,
      }),
    ]);
    const insertedFixture = mockSupabase.insert.mock.calls[0][0][0];
    expect([insertedFixture.participant_a_id, insertedFixture.participant_b_id].sort()).toEqual([203, 204]);
  });
});
