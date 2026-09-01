/// <reference types="jest" />

import { calculateGlobalRankings } from '../calculate-global-rankings';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('Calculate Global Rankings Job', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle no active season', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: null }); // active season

    const result = await calculateGlobalRankings();

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No active season found');
  });

  it('should successfully rank managers', async () => {
    // 1. active season
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 1 }, error: null }); 
    
    // 2. global rankings fetch
    mockSupabase.order.mockResolvedValueOnce({
      data: [
        { id: 10, total_points: 150 },
        { id: 11, total_points: 150 }, // Tie
        { id: 12, total_points: 140 }
      ],
      error: null
    });
    
    // 3. latest gameweek
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 5 }, error: null });
    
    // 4. squad count for ownership
    mockSupabase.select.mockResolvedValueOnce({ count: 10, error: null });
    
    // 5. squad members for ownership
    mockSupabase.is.mockResolvedValueOnce({ data: [], error: null });
    
    // 6. current gameweek for ownership
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 6 }, error: null });

    const result = await calculateGlobalRankings();

    expect(result.success).toBe(true);
    expect(result.managersRanked).toBe(3);
    
    // Check rank assignments (1, 1, 3 for ties)
    expect(mockSupabase.update).toHaveBeenCalledWith({ global_rank: 1 });
    expect(mockSupabase.update).toHaveBeenCalledWith({ global_rank: 3 });
  });
});
