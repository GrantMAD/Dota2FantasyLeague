import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockApplyRefreshedTokens = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
  applyRefreshedTokens: (...args: unknown[]) => mockApplyRefreshedTokens(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('/api/premium/waitlist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'manager-1', email: 'manager@example.test' });
  });

  function setupQuery(result: { data?: unknown; error: { message: string } | null }) {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue(result),
      upsert: jest.fn().mockResolvedValue(result),
      delete: jest.fn().mockReturnThis(),
    };
    mockSupabaseServer.mockReturnValue({ from: jest.fn(() => query) });
    return query;
  }

  it('returns the saved signup status for the authenticated account', async () => {
    const query = setupQuery({ data: { email: 'saved@example.test' }, error: null });

    const response = await GET(new NextRequest('http://localhost:3000/api/premium/waitlist'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      waitlisted: true,
      email: 'saved@example.test',
    });
    expect(query.eq).toHaveBeenCalledWith('user_id', 'manager-1');
    expect(mockApplyRefreshedTokens).toHaveBeenCalled();
  });

  it('requires explicit consent and a valid email before saving', async () => {
    const response = await POST(new NextRequest('http://localhost:3000/api/premium/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'manager@example.test', consent: false }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Consent is required to join the waitlist.',
    });
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });

  it('rejects invalid email addresses', async () => {
    const response = await POST(new NextRequest('http://localhost:3000/api/premium/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', consent: true }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Enter a valid email address.' });
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });

  it('normalizes and saves the email against the authenticated account', async () => {
    const query = setupQuery({ error: null });

    const response = await POST(new NextRequest('http://localhost:3000/api/premium/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: '  Manager@Example.Test ', consent: true }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ waitlisted: true });
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'manager-1',
        email: 'manager@example.test',
        consented_at: expect.any(String),
        updated_at: expect.any(String),
      }),
      { onConflict: 'user_id' },
    );
    expect(mockApplyRefreshedTokens).toHaveBeenCalled();
  });

  it('removes only the authenticated account waitlist entry', async () => {
    const query = setupQuery({ error: null });
    query.delete.mockReturnValue(query);
    query.eq.mockResolvedValue({ error: null });

    const response = await DELETE(new NextRequest('http://localhost:3000/api/premium/waitlist', {
      method: 'DELETE',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ waitlisted: false });
    expect(query.eq).toHaveBeenCalledWith('user_id', 'manager-1');
    expect(mockApplyRefreshedTokens).toHaveBeenCalled();
  });
});
