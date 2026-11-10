import { NextRequest } from 'next/server';
import { POST } from './route';

const mockResend = jest.fn();
const mockEnforceAuthRateLimit = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { resend: (...args: unknown[]) => mockResend(...args) } },
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

jest.mock('@/lib/auth-rate-limit', () => ({
  enforceAuthRateLimit: (...args: unknown[]) => mockEnforceAuthRateLimit(...args),
}));

function createRequest(email = 'Manager@Example.test') {
  return new NextRequest('http://localhost:3000/api/auth/resend-confirmation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

describe('POST /api/auth/resend-confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnforceAuthRateLimit.mockResolvedValue(null);
    mockResend.mockResolvedValue({ error: null });
  });

  it('resends signup confirmation with the app callback and a generic response', async () => {
    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(mockResend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'manager@example.test',
      options: { emailRedirectTo: 'http://localhost:3000/auth/callback' },
    });
    expect(await response.json()).toEqual({
      message: 'If an account needs confirmation, a new email will be sent shortly.',
    });
  });

  it('rejects resend attempts when signup rate limited', async () => {
    mockEnforceAuthRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many authentication attempts.' }), { status: 429 }),
    );

    const response = await POST(createRequest());

    expect(response.status).toBe(429);
    expect(mockResend).not.toHaveBeenCalled();
    expect(mockEnforceAuthRateLimit).toHaveBeenCalledWith(expect.any(NextRequest), 'signup');
  });

  it('does not expose provider details when sending fails', async () => {
    const logError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockResend.mockResolvedValue({ error: { message: 'provider detail' } });

    const response = await POST(createRequest());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'Unable to send a confirmation email right now. Please try again later.',
    });
    logError.mockRestore();
  });
});
