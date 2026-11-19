import { NextRequest } from 'next/server';

const mockVerifyAdminAuth = jest.fn();
const mockGetSupabaseServerClient = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAdminAuth: (...args: unknown[]) => mockVerifyAdminAuth(...args),
  createErrorResponse: (error: Error) => Response.json({ error: error.message }, { status: 500 }),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _path: string, handler: unknown) => handler,
}));

jest.mock('@/lib/db/supabase-server', () => ({
  getSupabaseServerClient: () => mockGetSupabaseServerClient(),
}));

import { GET } from './route';

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAdminAuth.mockResolvedValue('admin-user-uuid');
  });

  it('fetches users with pagination and enriches fantasy season and counts', async () => {
    const mockUsers = [
      {
        id: 'u1-uuid',
        username: 'dendi_fan',
        display_name: 'Danil',
        avatar_url: '/avatar1.png',
        role: 'user',
        is_premium: false,
        subscription_tier: 'free',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    mockGetSupabaseServerClient.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            range: jest.fn().mockResolvedValue({
              data: mockUsers,
              count: 1,
              error: null,
            }),
          };
        }
        if (table === 'fantasy_seasons') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 10,
                  user_id: 'u1-uuid',
                  total_points: 342.5,
                  global_rank: 4,
                  fantasy_squads: [{ id: 101, name: 'NaVi Forever' }],
                },
              ],
              error: null,
            }),
          };
        }
        if (table === 'league_members') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ user_id: 'u1-uuid' }, { user_id: 'u1-uuid' }],
              error: null,
            }),
          };
        }
        if (table === 'issue_reports') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ user_id: 'u1-uuid' }],
              error: null,
            }),
          };
        }
        return {};
      }),
      auth: {
        admin: {
          listUsers: jest.fn().mockResolvedValue({
            data: { users: [{ id: 'u1-uuid', email: 'danil@example.com' }] },
          }),
        },
      },
    });

    const request = new NextRequest('http://localhost:3000/api/admin/users?limit=10&offset=0');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.users).toHaveLength(1);
    expect(data.users[0].username).toBe('dendi_fan');
    expect(data.users[0].email).toBe('danil@example.com');
    expect(data.users[0].fantasy_team?.squad_name).toBe('NaVi Forever');
    expect(data.users[0].fantasy_team?.total_points).toBe(342.5);
    expect(data.users[0].leagues_count).toBe(2);
    expect(data.users[0].reports_count).toBe(1);
    expect(data.total).toBe(1);
  });
});
