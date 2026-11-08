import { NextRequest } from 'next/server';
import { GET, PUT } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockApplyRefreshedTokens = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
  applyRefreshedTokens: (...args: unknown[]) => mockApplyRefreshedTokens(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('GET /api/user/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({
      userId: 'manager-1',
      email: 'manager@example.test',
      role: 'user',
    });
  });

  it('returns subscription fields used by DashboardNavigation', async () => {
    const userQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: 'manager-1',
          username: 'manager',
          display_name: 'Manager',
          avatar_url: null,
          bio: null,
          country_code: null,
          timezone: null,
          theme_preference: 'dark',
          banner_theme: null,
          email_notifications: true,
          push_notifications: true,
          role: 'user',
          is_premium: true,
          subscription_tier: 'premium',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        error: null,
      }),
    };
    const seasonQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };
    mockSupabaseServer.mockReturnValue({
      from: (table: string) => table === 'users' ? userQuery : seasonQuery,
    });

    const response = await GET(new NextRequest('http://localhost:3000/api/user/profile'));

    expect(userQuery.select).toHaveBeenCalledWith(
      expect.stringContaining('is_premium, subscription_tier'),
    );
    expect(await response.json()).toMatchObject({
      profile: {
        is_premium: true,
        subscription_tier: 'premium',
      },
    });
  });
});

describe('PUT /api/user/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({
      userId: 'manager-1',
      email: 'manager@example.test',
      role: 'user',
    });
  });

  it('updates profile bio and returns updated profile data', async () => {
    const userQuery = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: 'manager-1',
          username: 'manager',
          display_name: 'Manager One',
          avatar_url: null,
          bio: 'Veteran position 5 drafter and fantasy enthusiast.',
          country_code: 'US',
          timezone: 'America/New_York',
          theme_preference: 'dark',
          banner_theme: 'radiant-dawn',
          email_notifications: true,
          push_notifications: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
        error: null,
      }),
    };

    mockSupabaseServer.mockReturnValue({
      from: () => userQuery,
    });

    const request = new NextRequest('http://localhost:3000/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: 'Manager One',
        bio: 'Veteran position 5 drafter and fantasy enthusiast.',
      }),
    });

    const response = await PUT(request);

    expect(userQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: 'Manager One',
        bio: 'Veteran position 5 drafter and fantasy enthusiast.',
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.bio).toBe('Veteran position 5 drafter and fantasy enthusiast.');
  });
});
