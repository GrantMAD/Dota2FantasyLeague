/// <reference types="jest" />

import { recalculateLeagues } from '../recalculate-leagues';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('Recalculate Leagues Job', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    };
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully execute when no active leagues exist', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null }); // leagues
    mockSupabase.in.mockResolvedValueOnce({ data: [], error: null }); // gameweeks

    const result = await recalculateLeagues();

    expect(result.success).toBe(true);
    expect(result.leaguesProcessed).toBe(0);
    expect(result.errors.length).toBe(0);
  });

  it('should process classic leagues', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ 
      data: [{ id: 1, scoring_type: 'total_points' }], 
      error: null 
    }); // leagues
    
    mockSupabase.in.mockResolvedValueOnce({ data: [], error: null }); // gameweeks
    
    mockSupabase.eq.mockResolvedValueOnce({
      data: [
        { id: 101, fantasy_seasons: { total_points: 50 } },
        { id: 102, fantasy_seasons: { total_points: 100 } }
      ],
      error: null
    }); // league_participants

    mockSupabase.eq.mockResolvedValue({ data: null, error: null }); // updates

    const result = await recalculateLeagues();

    expect(result.success).toBe(true);
    expect(result.leaguesProcessed).toBe(1);
    expect(result.classicLeaguesUpdated).toBe(1);
    // Should have updated rank 1 for id 102, rank 2 for id 101
    expect(mockSupabase.update).toHaveBeenCalledWith({ rank: 1, points: 100 });
    expect(mockSupabase.update).toHaveBeenCalledWith({ rank: 2, points: 50 });
  });

  it('should generate H2H fixtures', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ 
      data: [{ id: 2, scoring_type: 'weekly_wins' }], 
      error: null 
    }); // leagues
    
    mockSupabase.in.mockResolvedValueOnce({ 
      data: [{ id: 5, status: 'active' }], 
      error: null 
    }); // gameweeks

    // Mock count check for existing fixtures
    mockSupabase.eq.mockResolvedValueOnce({ count: 0, error: null }); 

    // Mock participant fetch
    mockSupabase.eq.mockResolvedValueOnce({
      data: [{ id: 201 }, { id: 202 }, { id: 203 }],
      error: null
    });

    const result = await recalculateLeagues();

    expect(result.success).toBe(true);
    expect(result.leaguesProcessed).toBe(1);
    expect(result.h2hFixturesGenerated).toBeGreaterThan(0);
    expect(mockSupabase.insert).toHaveBeenCalled();
  });
});
