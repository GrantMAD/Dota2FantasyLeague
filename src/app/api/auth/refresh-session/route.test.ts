import { NextRequest } from 'next/server';
import { POST } from './route';

const mockGetClaims = jest.fn();
const mockSupabaseServer = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

function createRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/auth/refresh-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/refresh-session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseServer.mockReturnValue({
      auth: { getClaims: (...args: unknown[]) => mockGetClaims(...args) },
    });
  });

  it('only stores tokens after verifying the access token', async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: 'user-1' } },
      error: null,
    });

    const response = await POST(createRequest({
      access_token: 'valid-access',
      refresh_token: 'refresh-token',
    }));

    expect(response.status).toBe(200);
    expect(mockGetClaims).toHaveBeenCalledWith('valid-access');
    expect(response.headers.get('set-cookie')).toContain('sb-auth-token=valid-access');
    expect(response.headers.get('set-cookie')).toContain('sb-refresh-token=refresh-token');
  });

  it('rejects invalid access tokens without changing auth cookies', async () => {
    mockGetClaims.mockResolvedValue({
      data: null,
      error: { message: 'invalid token' },
    });

    const response = await POST(createRequest({
      access_token: 'invalid-access',
      refresh_token: 'refresh-token',
    }));

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects malformed token payloads', async () => {
    const response = await POST(createRequest({
      access_token: 'valid-access',
      refresh_token: 123,
    }));

    expect(response.status).toBe(400);
    expect(mockGetClaims).not.toHaveBeenCalled();
  });
});
