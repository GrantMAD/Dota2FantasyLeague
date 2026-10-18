import { NextRequest } from 'next/server';
import { GET } from './route';

const mockVerifyAuth = jest.fn();
const mockRpc = jest.fn();
const mockSupabaseServer = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('GET /api/fantasy/transfer-suggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'manager-1' });
    mockRpc.mockResolvedValue({
      data: {
        gameweek_number: 7,
        status: 'available',
        completed_gameweeks: 3,
        required_gameweeks: 3,
        priced_role_matched_candidates: 4,
        recommendations: [{ player_out_id: 1, player_in_id: 2 }],
      },
      error: null,
    });
    mockSupabaseServer.mockReturnValue({ rpc: mockRpc });
  });

  it('returns the authenticated manager recommendations from the RPC', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/fantasy/transfer-suggestions'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      gameweek_number: 7,
      status: 'available',
      completed_gameweeks: 3,
      required_gameweeks: 3,
      priced_role_matched_candidates: 4,
      recommendations: [{ player_out_id: 1, player_in_id: 2 }],
    });
    expect(mockRpc).toHaveBeenCalledWith('mobile_get_transfer_suggestions', {
      p_viewer_id: 'manager-1',
    });
  });

  it('returns an explicit error when the recommendation RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'database unavailable' } });

    const response = await GET(new NextRequest('http://localhost:3000/api/fantasy/transfer-suggestions'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Failed to load transfer suggestions.' });
  });

  it('rejects a malformed recommendation response', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'available' }, error: null });

    const response = await GET(new NextRequest('http://localhost:3000/api/fantasy/transfer-suggestions'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'Transfer suggestions were returned in an unexpected format.',
    });
  });
});
