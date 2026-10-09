const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockInsert = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
  createErrorResponse: (error: { status?: number; message?: string }) =>
    Response.json({ error: error.message }, { status: error.status ?? 500 }),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: () => mockSupabaseServer(),
}));

import { POST } from './route';

describe('POST /api/telemetry/events', () => {
  beforeEach(() => {
    mockVerifyAuth.mockReset().mockResolvedValue({ userId: 'user-1' });
    mockInsert.mockReset().mockResolvedValue({ error: null });
    mockSupabaseServer.mockReset().mockReturnValue({
      from: jest.fn(() => ({ insert: mockInsert })),
    });
  });

  it('stores only normalized page-view metadata', async () => {
    const response = await POST(new Request('https://example.test/api/telemetry/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event_type: 'page_view',
        route: '/dashboard/squad/18',
        trace_id: '9f5c95c0-6027-4a22-8a33-7ce34b5fd934',
        password: 'must-not-be-stored',
      }),
    }));

    expect(response.status).toBe(204);
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'page_view',
      route: '/dashboard/squad/:id',
      trace_id: '9f5c95c0-6027-4a22-8a33-7ce34b5fd934',
      metadata: { source: 'browser' },
    }));
    expect(JSON.stringify(mockInsert.mock.calls[0][0])).not.toContain('must-not-be-stored');
  });

  it('rejects unauthenticated and invalid page-view events', async () => {
    mockVerifyAuth.mockRejectedValueOnce({ status: 401, message: 'Unauthorized' });
    const unauthorized = await POST(new Request('https://example.test/api/telemetry/events', { method: 'POST' }));
    expect(unauthorized.status).toBe(401);

    const invalid = await POST(new Request('https://example.test/api/telemetry/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ route: '/api/secret', trace_id: 'invalid' }),
    }));
    expect(invalid.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
