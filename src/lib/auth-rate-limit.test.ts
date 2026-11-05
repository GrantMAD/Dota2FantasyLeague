import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';

const mockRpc = jest.fn();
const mockSupabaseServer = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseServer: () => mockSupabaseServer(),
}));

import { enforceAuthRateLimit } from './auth-rate-limit';

describe('enforceAuthRateLimit', () => {
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    mockSupabaseServer.mockReturnValue({ rpc: mockRpc });
  });

  afterAll(() => {
    if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  });

  it('uses the trusted Vercel client address and hashes it before calling the RPC', async () => {
    mockRpc.mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });
    const request = new NextRequest('http://localhost/api/auth/signin', {
      headers: {
        'x-vercel-forwarded-for': '203.0.113.8',
        'x-forwarded-for': '198.51.100.1',
      },
    });

    await expect(enforceAuthRateLimit(request, 'signin')).resolves.toBeNull();

    const expectedHash = createHmac('sha256', 'test-service-role-key')
      .update('203.0.113.8')
      .digest('hex');
    expect(mockRpc).toHaveBeenCalledWith('consume_auth_rate_limit', {
      p_action: 'signin',
      p_identifier_hash: expectedHash,
    });
  });

  it('returns a 429 with Retry-After when the database limit is exceeded', async () => {
    mockRpc.mockResolvedValue({ data: [{ allowed: false, retry_after_seconds: 321 }], error: null });

    const response = await enforceAuthRateLimit(
      new NextRequest('http://localhost/api/auth/signup', {
        headers: { 'x-real-ip': '203.0.113.9' },
      }),
      'signup',
    );

    expect(response?.status).toBe(429);
    expect(response?.headers.get('Retry-After')).toBe('321');
  });

  it('fails closed with 503 when the limiter RPC fails', async () => {
    const logError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC not installed' } });

    const response = await enforceAuthRateLimit(
      new NextRequest('http://localhost/api/auth/signup'),
      'signup',
    );

    expect(response?.status).toBe(503);
    expect(logError).toHaveBeenCalledWith(
      'Auth rate limiting failed; authentication request was rejected.',
      { action: 'signup', error: 'RPC not installed' },
    );
    logError.mockRestore();
  });

  it('fails closed when the service-role key is missing', async () => {
    const logError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await enforceAuthRateLimit(
      new NextRequest('http://localhost/api/auth/signin'),
      'signin',
    );

    expect(response?.status).toBe(503);
    expect(mockSupabaseServer).not.toHaveBeenCalled();
    logError.mockRestore();
  });
});
