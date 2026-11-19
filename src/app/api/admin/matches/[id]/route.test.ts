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

import { PATCH } from './route';

describe('PATCH /api/admin/matches/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAdminAuth.mockResolvedValue('admin-user-123');
  });

  it('rejects invalid match id', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/matches/abc', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'abc' }) });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid match ID');
  });

  it('rejects invalid status', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/matches/544', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'live' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: '544' }) });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid status');
  });

  it('rejects invalid best_of', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/matches/544', {
      method: 'PATCH',
      body: JSON.stringify({ best_of: 4 }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: '544' }) });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid best_of');
  });

  it('returns 404 when match is not found', async () => {
    mockGetSupabaseServerClient.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      }),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/matches/999', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: '999' }) });
    expect(response.status).toBe(404);
  });

  it('updates status and logs audit action', async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    mockGetSupabaseServerClient.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'matches') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 544, status: 'in_progress', series_id: 484 },
              error: null,
            }),
            update: mockUpdate,
          };
        }
        return {};
      }),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/matches/544', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: '544' }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.matchId).toBe(544);
    expect(data.updated.status).toBe('completed');
    expect(mockLogAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'matches',
        recordId: 544,
        action: 'UPDATE',
        changedBy: 'admin-user-123',
      })
    );
  });

  it('updates series best_of and logs audit action', async () => {
    const mockSeriesUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    mockGetSupabaseServerClient.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'matches') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 544, status: 'completed', series_id: 484 },
              error: null,
            }),
          };
        }
        if (table === 'tournament_series') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 484, best_of: 5 },
              error: null,
            }),
            update: mockSeriesUpdate,
          };
        }
        return {};
      }),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/matches/544', {
      method: 'PATCH',
      body: JSON.stringify({ best_of: 3 }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: '544' }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.updated.best_of).toBe(3);
    expect(mockLogAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'tournament_series',
        recordId: 484,
        action: 'UPDATE',
        changedBy: 'admin-user-123',
      })
    );
  });

  it('moves match to target series and updates gameweek', async () => {
    const mockMatchUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    const mockPerfUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    mockGetSupabaseServerClient.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'matches') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 542, status: 'completed', series_id: 495 },
              error: null,
            }),
            update: mockMatchUpdate,
          };
        }
        if (table === 'tournament_series') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { id: 494, gameweek_id: 12, tournament_id: 3 },
              error: null,
            }),
          };
        }
        if (table === 'player_performances') {
          return {
            update: mockPerfUpdate,
          };
        }
        return {};
      }),
    });

    const request = new NextRequest('http://localhost:3000/api/admin/matches/542', {
      method: 'PATCH',
      body: JSON.stringify({ series_id: 494 }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: '542' }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.updated.series_id).toBe(494);
    expect(mockMatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ series_id: 494, gameweek_id: 12 })
    );
    expect(mockPerfUpdate).toHaveBeenCalledWith({ gameweek_id: 12 });
    expect(mockLogAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'matches',
        recordId: 542,
        action: 'UPDATE',
        changedBy: 'admin-user-123',
      })
    );
  });
});
