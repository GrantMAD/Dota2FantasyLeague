import { NextRequest } from 'next/server';
import { POST } from './route';

const mockVerifyAuth = jest.fn();
const mockRpc = jest.fn();
const mockSupabaseServer = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('POST /api/fantasy/wildcard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'manager-1' });
    mockRpc.mockResolvedValue({
      data: { success: true, message: 'Wildcard activated.', gameweek_id: 91 },
      error: null,
    });
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { gameweek_number: 6 },
        error: null,
      }),
    };
    mockFrom.mockReturnValue(query);
    mockSupabaseServer.mockReturnValue({ rpc: mockRpc, from: mockFrom });
  });

  it('returns the gameweek number with successful Wildcard activation', async () => {
    const response = await POST(new NextRequest('http://localhost:3000/api/fantasy/wildcard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fantasySeasonId: 15 }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Wildcard activated.',
      gameweekId: 91,
      gameweekNumber: 6,
    });
    expect(mockRpc).toHaveBeenCalledWith('activate_wildcard', {
      p_user_id: 'manager-1',
      p_fantasy_season_id: 15,
    });
    expect(mockFrom).toHaveBeenCalledWith('gameweeks');
  });
});
