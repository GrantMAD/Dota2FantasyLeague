import { NextRequest } from 'next/server';
import { GET } from './route';

const mockVerifyAuth = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('GET /api/leagues/[id]/activity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'manager-1' });
  });

  it('returns the member-scoped activity feed', async () => {
    const payload = { activities: [] };
    mockRpc.mockResolvedValue({ data: payload, error: null });

    const response = await GET(
      new NextRequest('http://localhost/api/leagues/12/activity'),
      { params: Promise.resolve({ id: '12' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
    expect(mockRpc).toHaveBeenCalledWith('mobile_get_league_activity', {
      p_league_id: 12,
      p_limit: 50,
      p_viewer_id: 'manager-1',
    });
  });

  it('rejects invalid league IDs before querying activity', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/leagues/invalid/activity'),
      { params: Promise.resolve({ id: 'invalid' }) },
    );

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('returns the authentication status when the request is unauthenticated', async () => {
    mockVerifyAuth.mockRejectedValue({ status: 401, message: 'Unauthenticated' });

    const response = await GET(
      new NextRequest('http://localhost/api/leagues/12/activity'),
      { params: Promise.resolve({ id: '12' }) },
    );

    expect(response.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('does not disclose activity to non-members', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '42501' } });

    const response = await GET(
      new NextRequest('http://localhost/api/leagues/12/activity'),
      { params: Promise.resolve({ id: '12' }) },
    );

    expect(response.status).toBe(403);
  });
});
