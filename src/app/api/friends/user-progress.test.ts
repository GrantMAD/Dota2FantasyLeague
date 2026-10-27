import { NextRequest } from 'next/server';
import { GET } from './[userId]/progress/route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockFrom = jest.fn();
const mockMaybeSingle = jest.fn();
const mockEqualFilters: Array<[string, string, unknown]> = [];

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
  applyRefreshedTokens: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('GET /api/friends/:userId/progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEqualFilters.length = 0;
    mockVerifyAuth.mockResolvedValue({ userId: '11111111-1111-4111-8111-111111111111' });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockFrom.mockImplementation((table: string) => {
      const query: Record<string, jest.Mock> = {};
      const chain = () => query;
      query.select = jest.fn(chain);
      query.eq = jest.fn((column: string, value: unknown) => {
        mockEqualFilters.push([table, column, value]);
        return query;
      });
      query.maybeSingle = mockMaybeSingle;
      return query;
    });
    mockSupabaseServer.mockReturnValue({ from: mockFrom });
  });

  it('does not disclose progress for a user the requester does not follow', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/friends/22222222-2222-4222-8222-222222222222/progress'),
      { params: Promise.resolve({ userId: '22222222-2222-4222-8222-222222222222' }) },
    );

    expect(response.status).toBe(404);
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('user_follows');
    expect(mockEqualFilters).toEqual([
      ['user_follows', 'follower_id', '11111111-1111-4111-8111-111111111111'],
      ['user_follows', 'followed_id', '22222222-2222-4222-8222-222222222222'],
    ]);
  });
});
