import { NextRequest } from 'next/server';

const mockVerifyAdminAuth = jest.fn();
const mockSupabaseServer = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAdminAuth: (...args: unknown[]) => mockVerifyAdminAuth(...args),
  createErrorResponse: (error: Error) => Response.json({ error: error.message }, { status: 500 }),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _path: string, handler: unknown) => handler,
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: () => mockSupabaseServer(),
}));

import { GET } from './route';

describe('GET /api/admin/series', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAdminAuth.mockResolvedValue('admin-user-123');
  });

  it('fetches series and enriches with teams and tournament', async () => {
    const mockSeries = [
      {
        id: 494,
        tournament_id: 3,
        gameweek_id: 12,
        series_number: 1,
        best_of: 5,
        team_a_id: 1,
        team_b_id: 4,
        source_series_id: 'stratz:123',
        created_at: '2026-03-01T00:00:00Z',
      },
    ];

    mockSupabaseServer.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'tournament_series') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            range: jest.fn().mockResolvedValue({
              data: mockSeries,
              count: 1,
              error: null,
            }),
          };
        }
        if (table === 'professional_teams') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [
                { id: 1, name: 'Team Spirit', logo_url: '/spirit.png' },
                { id: 4, name: 'PARIVISION', logo_url: '/pari.png' },
              ],
              error: null,
            }),
          };
        }
        if (table === 'tournaments') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ id: 3, name: '1win Series Dota 2 Spring', tier: 'tier_1' }],
              error: null,
            }),
          };
        }
        if (table === 'matches') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ series_id: 494 }, { series_id: 494 }],
              error: null,
            }),
          };
        }
        return {};
      }),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/series?gameweek_id=12');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe(494);
    expect(data.data[0].team_a?.name).toBe('Team Spirit');
    expect(data.data[0].team_b?.name).toBe('PARIVISION');
    expect(data.data[0].tournament?.name).toBe('1win Series Dota 2 Spring');
    expect(data.data[0].match_count).toBe(2);
  });
});
