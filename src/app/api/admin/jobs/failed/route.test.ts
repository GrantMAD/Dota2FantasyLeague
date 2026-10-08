const mockVerifyAdminAuth = jest.fn();
const mockCreateClient = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAdminAuth: (...args: unknown[]) => mockVerifyAdminAuth(...args),
  createErrorResponse: (error: Error) => Response.json({ error: error.message }, { status: 500 }),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { GET } from './route';

interface FailedRecord {
  id: number;
  job_name: string;
  error_message: string;
  retry_count: number;
  next_retry_at: string | null;
  is_dead_letter: boolean;
  started_at: string;
}

interface LatestRecord {
  id: number;
  status: string;
}

interface LatestExecutionQuery {
  select(columns: string): LatestExecutionQuery;
  eq(column: string, value: string): LatestExecutionQuery;
  order(column: string, options: { ascending: boolean }): LatestExecutionQuery;
  limit(count: number): LatestExecutionQuery;
  maybeSingle(): Promise<{ data: LatestRecord | null; error: null }>;
}

function latestExecutionQuery(result: { data: LatestRecord | null; error: null }): LatestExecutionQuery {
  const query: LatestExecutionQuery = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    maybeSingle: () => Promise.resolve(result),
  };
  return query;
}

interface FailedRowsQuery {
  select(columns: string): FailedRowsQuery;
  eq(column: string, value: string): FailedRowsQuery;
  order(column: string, options: { ascending: boolean }): FailedRowsQuery;
  limit(count: number): Promise<{ data: FailedRecord[]; error: null }>;
}

function failedRowsQuery(result: { data: FailedRecord[]; error: null }): FailedRowsQuery {
  const query: FailedRowsQuery = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => Promise.resolve(result),
  };
  return query;
}

function request() {
  return new Request('http://localhost/api/admin/jobs/failed');
}

describe('GET /api/admin/jobs/failed', () => {
  beforeEach(() => {
    mockVerifyAdminAuth.mockReset().mockResolvedValue('admin-1');
    mockCreateClient.mockReset();
  });

  it('does not report a failed execution after the same job has succeeded', async () => {
    const oldFailure: FailedRecord = {
      id: 10,
      job_name: 'sync-teams',
      error_message: 'Previous attempt failed',
      retry_count: 1,
      next_retry_at: null,
      is_dead_letter: false,
      started_at: '2026-10-08T10:00:00.000Z',
    };
    const failedQuery = failedRowsQuery({ data: [oldFailure], error: null });
    const latestQuery = latestExecutionQuery({
      data: { id: 11, status: 'completed' },
      error: null,
    });
    const from = jest.fn()
      .mockReturnValueOnce(failedQuery)
      .mockReturnValueOnce(latestQuery);
    mockCreateClient.mockReturnValue({ from });

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ failedJobs: [] });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('retains the latest failure for a job that has not recovered', async () => {
    const latestFailure: FailedRecord = {
      id: 12,
      job_name: 'sync-teams',
      error_message: 'Current attempt failed',
      retry_count: 2,
      next_retry_at: null,
      is_dead_letter: false,
      started_at: '2026-10-08T11:00:00.000Z',
    };
    const failedQuery = failedRowsQuery({ data: [latestFailure], error: null });
    const latestQuery = latestExecutionQuery({
      data: { id: 12, status: 'failed' },
      error: null,
    });
    mockCreateClient.mockReturnValue({
      from: jest.fn()
        .mockReturnValueOnce(failedQuery)
        .mockReturnValueOnce(latestQuery),
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ failedJobs: [latestFailure] });
  });
});
