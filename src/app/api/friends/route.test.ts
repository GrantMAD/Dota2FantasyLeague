import { NextRequest } from 'next/server';
import { POST } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockInsert = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
  applyRefreshedTokens: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('POST /api/friends', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: '11111111-1111-4111-8111-111111111111' });
    mockInsert.mockResolvedValue({ error: null });
    mockSupabaseServer.mockReturnValue({
      from: (table: string) => {
        expect(table).toBe('user_follows');
        return { insert: mockInsert };
      },
    });
  });

  it('prevents a manager from following themselves', async () => {
    const response = await POST(new NextRequest('http://localhost/api/friends', {
      method: 'POST',
      body: JSON.stringify({ userId: '11111111-1111-4111-8111-111111111111' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('You cannot follow yourself.');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('creates a one-way follow relationship for the authenticated manager', async () => {
    const targetUserId = '22222222-2222-4222-8222-222222222222';
    const response = await POST(new NextRequest('http://localhost/api/friends', {
      method: 'POST',
      body: JSON.stringify({ userId: targetUserId }),
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ following: true });
    expect(mockInsert).toHaveBeenCalledWith({
      follower_id: '11111111-1111-4111-8111-111111111111',
      followed_id: targetUserId,
    });
  });

  it('rejects malformed user IDs before attempting a database write', async () => {
    const response = await POST(new NextRequest('http://localhost/api/friends', {
      method: 'POST',
      body: JSON.stringify({ userId: 'not-a-uuid' }),
    }));

    expect(response.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
