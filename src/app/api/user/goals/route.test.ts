import { NextRequest } from 'next/server';
import { GET, PUT } from './route';

const mockVerifyAuth = jest.fn();
const mockGetOrCreateFantasySeason = jest.fn();
const mockSupabaseServer = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
  applyRefreshedTokens: jest.fn(),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

jest.mock('@/lib/fantasy-season', () => ({
  getOrCreateFantasySeason: (...args: unknown[]) => mockGetOrCreateFantasySeason(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: () => mockSupabaseServer(),
}));

describe('User Goals API (/api/user/goals)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'test-user-123' });
  });

  describe('GET /api/user/goals', () => {
    it('returns empty goals when no fantasy season exists', async () => {
      mockGetOrCreateFantasySeason.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/goals', { method: 'GET' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        targetPoints: null,
        targetRank: null,
        totalPoints: 0,
        globalRank: null,
      });
    });

    it('returns goals from active fantasy season', async () => {
      mockGetOrCreateFantasySeason.mockResolvedValue({
        id: 42,
        target_points: 750.5,
        target_rank: 500,
        total_points: 320.0,
        global_rank: 642,
      });

      const request = new NextRequest('http://localhost:3000/api/user/goals', { method: 'GET' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        targetPoints: 750.5,
        targetRank: 500,
        totalPoints: 320.0,
        globalRank: 642,
      });
    });
  });

  describe('PUT /api/user/goals', () => {
    it('rejects negative target points', async () => {
      const request = new NextRequest('http://localhost:3000/api/user/goals', {
        method: 'PUT',
        body: JSON.stringify({ targetPoints: -50 }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toMatch(/Target points must be a positive number/);
    });

    it('rejects non-integer or zero target rank', async () => {
      const request = new NextRequest('http://localhost:3000/api/user/goals', {
        method: 'PUT',
        body: JSON.stringify({ targetRank: 0 }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toMatch(/Target rank must be a positive integer/);
    });

    it('updates targets successfully and clears values when set to null', async () => {
      mockGetOrCreateFantasySeason.mockResolvedValue({ id: 42 });

      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: 42,
          target_points: 800,
          target_rank: null,
          total_points: 400,
          global_rank: 250,
        },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ update: mockUpdate });

      mockSupabaseServer.mockReturnValue({ from: mockFrom });

      const request = new NextRequest('http://localhost:3000/api/user/goals', {
        method: 'PUT',
        body: JSON.stringify({ targetPoints: 800, targetRank: null }),
      });
      const response = await PUT(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({
        success: true,
        targetPoints: 800,
        targetRank: null,
        totalPoints: 400,
        globalRank: 250,
      });
      expect(mockUpdate).toHaveBeenCalledWith({
        target_points: 800,
        target_rank: null,
      });
    });
  });
});
