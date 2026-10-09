const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockRecord = jest.fn();

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
  const originalDetailSampleRate = process.env.TELEMETRY_DETAIL_SAMPLE_RATE;

  beforeEach(() => {
    mockVerifyAuth.mockReset().mockResolvedValue({ userId: 'user-1' });
    mockRecord.mockReset().mockResolvedValue({ error: null });
    mockSupabaseServer.mockReset().mockReturnValue({ rpc: mockRecord });
    process.env.TELEMETRY_DETAIL_SAMPLE_RATE = '1';
  });

  afterAll(() => {
    if (originalDetailSampleRate === undefined) delete process.env.TELEMETRY_DETAIL_SAMPLE_RATE;
    else process.env.TELEMETRY_DETAIL_SAMPLE_RATE = originalDetailSampleRate;
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
    expect(mockRecord).toHaveBeenCalledWith('record_interaction_telemetry', {
      event_batch: [expect.objectContaining({
        event_type: 'page_view',
        route: '/dashboard/squad/:id',
        trace_id: '9f5c95c0-6027-4a22-8a33-7ce34b5fd934',
        metadata: { source: 'browser' },
      })],
      detail_batch: [expect.objectContaining({ event_type: 'page_view' })],
    });
    expect(JSON.stringify(mockRecord.mock.calls[0][1])).not.toContain('must-not-be-stored');
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
    expect(mockRecord).not.toHaveBeenCalled();
  });
});
