import { NextRequest } from 'next/server';

const mockVerifyAdminAuth = jest.fn();
const mockLogAuditAction = jest.fn();
const mockGetSupabaseServerClient = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAdminAuth: (...args: unknown[]) => mockVerifyAdminAuth(...args),
  createErrorResponse: (error: Error) => Response.json({ error: error.message }, { status: 500 }),
}));

jest.mock('@/lib/audit-logger', () => ({
  logAuditAction: (...args: unknown[]) => mockLogAuditAction(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _path: string, handler: unknown) => handler,
}));

jest.mock('@/lib/db/supabase-server', () => ({
  getSupabaseServerClient: () => mockGetSupabaseServerClient(),
}));

import { GET, PATCH } from './route';

describe('GET /api/admin/users/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAdminAuth.mockResolvedValue('admin-user-uuid');
  });

  it('returns full user data including squad, leagues, reports and audit logs', async () => {
    mockGetSupabaseServerClient.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'u-123',
                username: 'miracle_fan',
                display_name: 'Amer',
                role: 'user',
                created_at: '2026-01-01T00:00:00Z',
              },
              error: null,
            }),
          };
        }
        if (table === 'fantasy_seasons') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 1,
                  total_points: 120,
                  fantasy_squads: [
                    {
                      id: 2,
                      name: 'Team Nigma',
                      fantasy_squad_members: [],
                    },
                  ],
                },
              ],
              error: null,
            }),
          };
        }
        if (table === 'league_members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 99,
                  points: 50,
                  leagues: { id: 5, name: 'Pro DPC League' },
                },
              ],
              error: null,
            }),
          };
        }
        if (table === 'leagues') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [{ id: 12, name: 'My Private League' }],
              error: null,
            }),
          };
        }
        if (table === 'issue_reports') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
              data: [{ id: 4, title: 'Bug in lineup' }],
              error: null,
            }),
          };
        }
        if (table === 'audit_logs') {
          return {
            select: jest.fn().mockReturnThis(),
            or: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
        }
        return {};
      }),
      auth: {
        admin: {
          getUserById: jest.fn().mockResolvedValue({
            data: { user: { id: 'u-123', email: 'amer@example.com' } },
          }),
        },
      },
    });

    const request = new NextRequest('http://localhost:3000/api/admin/users/u-123');
    const response = await GET(request, { params: Promise.resolve({ id: 'u-123' }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.id).toBe('u-123');
    expect(data.user.email).toBe('amer@example.com');
    expect(data.fantasy_seasons).toHaveLength(1);
    expect(data.league_memberships).toHaveLength(1);
    expect(data.created_leagues).toHaveLength(1);
    expect(data.issue_reports).toHaveLength(1);
  });
});

describe('PATCH /api/admin/users/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAdminAuth.mockResolvedValue('admin-user-uuid');
  });

  it('updates user role to admin and logs audit action', async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'u-123', role: 'admin' },
            error: null,
          }),
        }),
      }),
    });

    mockGetSupabaseServerClient.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 'u-123', role: 'user', display_name: 'Amer' },
              error: null,
            }),
            update: mockUpdate,
          };
        }
        return {};
      }),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/users/u-123', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'u-123' }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.role).toBe('admin');
    expect(mockLogAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'users',
        recordId: 'u-123',
        action: 'UPDATE',
        changedBy: 'admin-user-uuid',
      })
    );
  });
});
