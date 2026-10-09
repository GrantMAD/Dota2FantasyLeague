const mockVerifyAdminAuth = jest.fn();
const mockSupabaseServer = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAdminAuth: (...args: unknown[]) => mockVerifyAdminAuth(...args),
  createErrorResponse: (error: { status?: number; message?: string }) =>
    Response.json({ error: error.message }, { status: error.status ?? 500 }),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: () => mockSupabaseServer(),
}));

import { GET } from './route';

interface TelemetryQueryResult {
  data: unknown[];
  error: null;
  count: number;
}

interface TelemetryQuery {
  select(columns: string): TelemetryQuery;
  gte(column: string, value: string): TelemetryQuery;
  order(column: string, options: { ascending: boolean }): TelemetryQuery;
  eq(column: string, value: string): TelemetryQuery;
  range(start: number, end: number): Promise<TelemetryQueryResult>;
  limit(count: number): Promise<TelemetryQueryResult>;
  rangeArgs: [number, number] | null;
}

function telemetryQuery(result: { data: unknown[]; error: null; count: number }) {
  class Query implements TelemetryQuery {
    rangeArgs: [number, number] | null = null;
    select(columns: string) { void columns; return this; }
    gte(column: string, value: string) { void column; void value; return this; }
    order(column: string, options: { ascending: boolean }) { void column; void options; return this; }
    eq(column: string, value: string) { void column; void value; return this; }
    range(start: number, end: number) {
      this.rangeArgs = [start, end];
      return Promise.resolve(result);
    }
    limit(count: number) { void count; return Promise.resolve(result); }
  }
  return new Query();
}

describe('GET /api/admin/telemetry', () => {
  beforeEach(() => {
    mockVerifyAdminAuth.mockReset().mockResolvedValue('admin-user');
    mockSupabaseServer.mockReset();
  });

  it('requires admin authorization before querying telemetry', async () => {
    mockVerifyAdminAuth.mockRejectedValue({ status: 403, message: 'Admin access required' });

    const response = await GET(new Request('https://example.test/api/admin/telemetry'));

    expect(response.status).toBe(403);
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });

  it('uses minute aggregates for summaries and retained events for detail browsing', async () => {
    const retainedEvent = { id: 7, event_type: 'api_request', status_code: 500, duration_ms: 40 };
    const pageQuery = telemetryQuery({ data: [retainedEvent], error: null, count: 1 });
    const from = jest.fn().mockReturnValueOnce(pageQuery);
    const summary = {
      sampleSize: 12500,
      pageViews: 3000,
      apiRequests: 5000,
      databaseRequests: 4000,
      providerRequests: 500,
      errors: 20,
      averageDurationMs: 60,
      p95DurationMs: 250,
    };
    const rpc = jest.fn().mockResolvedValue({ data: summary, error: null });
    mockSupabaseServer.mockReturnValue({ from, rpc });

    const response = await GET(new Request('https://example.test/api/admin/telemetry?hours=9999&limit=500&page=99999'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.windowHours).toBe(4320);
    expect(body.page).toBe(200);
    expect(body.pageSize).toBe(100);
    expect(body.summary).toEqual(summary);
    expect(body.summaryIsEstimated).toBe(true);
    expect(body.events).toEqual([retainedEvent]);
    expect(rpc).toHaveBeenCalledWith('get_interaction_telemetry_summary', expect.objectContaining({
      p_event_type: null,
      p_route: null,
    }));
    expect(pageQuery.rangeArgs).toEqual([19900, 19999]);
  });

  it('summarizes a trace from retained detail events', async () => {
    const rows = [
      { event_type: 'api_request', status_code: 500, duration_ms: 80, error_class: null },
      { event_type: 'database_request', status_code: 200, duration_ms: 40, error_class: null },
    ];
    const trace = '9f5c95c0-6027-4a22-8a33-7ce34b5fd934';
    const pageQuery = telemetryQuery({ data: rows, error: null, count: 2 });
    const summaryQuery = telemetryQuery({ data: rows, error: null, count: 2 });
    const from = jest.fn().mockReturnValueOnce(pageQuery).mockReturnValueOnce(summaryQuery);
    const rpc = jest.fn();
    mockSupabaseServer.mockReturnValue({ from, rpc });

    const response = await GET(new Request(`https://example.test/api/admin/telemetry?trace_id=${trace}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summaryIsEstimated).toBe(false);
    expect(body.summary).toMatchObject({ sampleSize: 2, errors: 1, averageDurationMs: 60 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
