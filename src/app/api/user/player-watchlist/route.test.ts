import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  applyRefreshedTokens: jest.fn(),
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

function makeRequest(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

describe('/api/user/player-watchlist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'user-1', role: 'user' });
  });

  it('returns only the authenticated users saved player IDs', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [{ player_id: 17 }, { player_id: 42 }],
        error: null,
      }),
    };
    mockSupabaseServer.mockReturnValue({ from: jest.fn().mockReturnValue(query) });

    const response = await GET(makeRequest('/api/user/player-watchlist'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ playerIds: [17, 42] });
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('validates player IDs before saving', async () => {
    const response = await POST(makeRequest('/api/user/player-watchlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId: 0 }),
    }));

    expect(response.status).toBe(400);
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });

  it('adds a player idempotently for the authenticated user', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabaseServer.mockReturnValue({ from: jest.fn().mockReturnValue({ upsert }) });

    const response = await POST(makeRequest('/api/user/player-watchlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId: 17 }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ playerId: 17, watchlisted: true });
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', player_id: 17 },
      { onConflict: 'user_id,player_id', ignoreDuplicates: true },
    );
  });

  it('removes only the requested player from the authenticated users list', async () => {
    const query = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
    };
    query.eq.mockReturnValueOnce(query).mockResolvedValueOnce({ error: null });
    mockSupabaseServer.mockReturnValue({ from: jest.fn().mockReturnValue(query) });

    const response = await DELETE(makeRequest('/api/user/player-watchlist?playerId=17'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ playerId: 17, watchlisted: false });
    expect(query.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'player_id', 17);
  });
});
