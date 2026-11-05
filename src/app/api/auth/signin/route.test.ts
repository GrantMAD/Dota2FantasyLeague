import { NextRequest } from 'next/server';
import { POST } from './route';

const mockSignInWithPassword = jest.fn();
const mockEnforceAuthRateLimit = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args) } },
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

jest.mock('@/lib/auth-rate-limit', () => ({
  enforceAuthRateLimit: (...args: unknown[]) => mockEnforceAuthRateLimit(...args),
}));

function createRequest() {
  return new NextRequest('http://localhost:3000/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager@example.test', password: 'password' }),
  });
}

describe('POST /api/auth/signin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnforceAuthRateLimit.mockResolvedValue(null);
  });

  it('rejects rate-limited requests before calling Supabase Auth', async () => {
    mockEnforceAuthRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many authentication attempts.' }), { status: 429 }),
    );

    const response = await POST(createRequest());

    expect(response.status).toBe(429);
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockEnforceAuthRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      'signin',
    );
  });

  it('continues to authenticate requests allowed by the limiter', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'manager-1' },
        session: { access_token: 'access-token', refresh_token: 'refresh-token' },
      },
      error: null,
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'manager@example.test',
      password: 'password',
    });
    expect(response.headers.get('set-cookie')).toContain('sb-auth-token=access-token');
    expect(response.headers.get('set-cookie')).toContain('sb-refresh-token=refresh-token');
  });
});
