/// <reference types="jest" />

import { calculateGlobalRankings } from '../calculate-global-rankings';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('Calculate Global Rankings Job', () => {
  let mockSupabase: Record<string, jest.Mock>;
  let queryResults: unknown[];

  beforeEach(() => {
    queryResults = [];
    mockSupabase = {
      from: jest.fn(),
      select: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
      limit: jest.fn(),
      is: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
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

  it('should handle no active season', async () => {
    queryResults.push({ data: null, error: null }); // active season

    const result = await calculateGlobalRankings();

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No active season found');
  });

  it('should successfully rank managers', async () => {
    queryResults.push(
      { data: { id: 1 }, error: null },
      {
        data: [
          { id: 10, total_points: 150 },
          { id: 11, total_points: 150 },
          { id: 12, total_points: 140 },
        ],
        error: null,
      },
      { data: null, error: null },
      { count: 0, error: null },
    );

    const result = await calculateGlobalRankings();

    expect(result.success).toBe(true);
    expect(result.managersRanked).toBe(3);
    
    // Check rank assignments (1, 1, 3 for ties)
    expect(mockSupabase.update).toHaveBeenCalledWith({ global_rank: 1 });
    expect(mockSupabase.update).toHaveBeenCalledWith({ global_rank: 3 });
  });
});
