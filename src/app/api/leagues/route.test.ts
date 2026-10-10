import { NextRequest } from 'next/server';
import { POST } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/push-notifications', () => ({
  deliverPushNotifications: jest.fn(),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('POST /api/leagues season isolation', () => {
  beforeEach(() => {
    mockVerifyAuth.mockResolvedValue({ userId: 'manager-1', email: 'manager@example.test' });
  });

  it('looks up the manager enrollment for the season of the league being joined', async () => {
    const filters: Record<string, string | number> = {};
    const queryFor = (table: string) => {
      const query = {
        select: () => query,
        eq: (column: string, value: string | number) => {
          filters[`${table}.${column}`] = value;
          return query;
        },
        maybeSingle: async () => ({
          data: table === 'leagues'
            ? { id: 5, season_id: 12, name: 'Season League', max_participants: 10, current_participants: 2 }
            : null,
          error: null,
        }),
      };
      return query;
    };
    mockSupabaseServer.mockReturnValue({ from: queryFor });

    const response = await POST(new NextRequest('http://localhost:3000/api/leagues', {
      method: 'POST',
      body: JSON.stringify({ action: 'join', inviteCode: 'LEAGUE-CODE' }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(400);
    expect(filters).toMatchObject({
      'fantasy_seasons.user_id': 'manager-1',
      'fantasy_seasons.season_id': 12,
    });
  });
});
