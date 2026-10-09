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

  it('returns bounded summaries and event rows for authorized admins', async () => {
    const rows = [
      { event_type: 'page_view', status_code: null, duration_ms: null, error_class: null },
      { event_type: 'api_request', status_code: 200, duration_ms: 40, error_class: null },
      { event_type: 'database_request', status_code: 500, duration_ms: 80, error_class: null },
    ];
    const pageQuery = telemetryQuery({ data: [rows[0]], error: null, count: 3 });
    const summaryQuery = telemetryQuery({ data: rows, error: null, count: 3 });
    const from = jest.fn().mockReturnValueOnce(pageQuery).mockReturnValueOnce(summaryQuery);
    mockSupabaseServer.mockReturnValue({ from });

    const response = await GET(new Request('https://example.test/api/admin/telemetry?hours=999&limit=500&page=99999'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.windowHours).toBe(168);
    expect(body.page).toBe(200);
    expect(body.pageSize).toBe(100);
    expect(body.summary).toMatchObject({
      pageViews: 1,
      apiRequests: 1,
      databaseRequests: 1,
      errors: 1,
      averageDurationMs: 60,
      p95DurationMs: 80,
    });
    expect(pageQuery.rangeArgs).toEqual([19900, 19999]);
  });
});
