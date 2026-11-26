import { NextRequest } from 'next/server';
import { GET } from './route';

const mockSupabaseServer = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseServer: () => mockSupabaseServer(),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('GET /api/teams', () => {
  beforeEach(() => {
    mockSupabaseServer.mockReset();
  });

  it('caches successful public team listings at the CDN', async () => {
    const range = jest.fn().mockResolvedValue({
      data: [{ id: 5, name: 'Radiant' }],
      error: null,
    });
    const select = jest.fn().mockReturnValue({ range });
    mockSupabaseServer.mockReturnValue({
      from: jest.fn().mockReturnValue({ select }),
    });

    const response = await GET(new NextRequest('http://localhost:3000/api/teams?limit=20'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=30');
    expect(range).toHaveBeenCalledWith(0, 19);
    expect((await response.json()).data).toEqual([{ id: 5, name: 'Radiant' }]);
  });

  it('does not cache failed team listings', async () => {
    const range = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });
    mockSupabaseServer.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ range }),
      }),
    });

    const response = await GET(new NextRequest('http://localhost:3000/api/teams'));

    expect(response.status).toBe(500);
    expect(response.headers.get('Cache-Control')).toBeNull();
  });
});
