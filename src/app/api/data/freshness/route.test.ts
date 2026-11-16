import { NextRequest } from 'next/server';
import { GET } from './route';

const mockGetJobs = jest.fn();
const mockGetAllJobStatuses = jest.fn();
const mockLimit = jest.fn();

jest.mock('@/lib/jobs/scheduler', () => ({
  getJobs: (...args: unknown[]) => mockGetJobs(...args),
  getAllJobStatuses: (...args: unknown[]) => mockGetAllJobStatuses(...args),
}));

jest.mock('@/lib/db/supabase-server', () => ({
  getSupabaseServerClient: () => ({
    from: () => ({
      select: () => ({
        in: () => ({
          order: () => ({
            limit: (...args: unknown[]) => mockLimit(...args),
          }),
        }),
      }),
    }),
  }),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('GET /api/data/freshness', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-16T12:06:26.000Z'));
    jest.clearAllMocks();
    mockGetJobs.mockReturnValue([
      { name: 'fetch-match-details', schedule: '*/30 * * * *' },
      { name: 'fetch-matches', schedule: '*/15 * * * *' },
      { name: 'process-completed-matches', schedule: '45 * * * *' },
    ]);
    mockGetAllJobStatuses.mockReturnValue([]);
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('identifies the earliest upcoming job and returns its scheduled time', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/data/freshness?page=matches'));
    const body = await response.json();

    expect(body).toMatchObject({
      success: true,
      jobName: 'fetch-matches',
      nextUpdate: '2026-11-16T12:15:00.000Z',
    });
    expect(body.jobs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        jobName: 'fetch-matches',
        schedule: '*/15 * * * *',
        nextRun: '2026-11-16T12:15:00.000Z',
      }),
    ]));
  });
});
