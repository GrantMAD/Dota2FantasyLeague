import { NextRequest } from 'next/server';
import { GET, POST } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockDeliverPushNotifications = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/push-notifications', () => ({
  deliverPushNotifications: (...args: unknown[]) => mockDeliverPushNotifications(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('/api/leagues data isolation and atomic joins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'manager-1', email: 'manager@example.test' });
    mockDeliverPushNotifications.mockResolvedValue({ delivered: 1, errors: [] });
  });

  describe('GET /api/leagues SQL-level privacy filtering', () => {
    it('filters private leagues in SQL using user membership when privacy is not specified', async () => {
      let orFilterApplied = '';
      let leaguesQueryCalled = false;

      const mockFrom = jest.fn((table: string) => {
        if (table === 'league_participants') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
              data: [{ league_id: 101 }, { league_id: 102 }],
              error: null,
            }),
          };
        }
        if (table === 'leagues') {
          leaguesQueryCalled = true;
          const query: Record<string, unknown> = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            or: jest.fn((filterStr: string) => {
              orFilterApplied = filterStr;
              return query;
            }),
            then: (resolve: (val: unknown) => void) => {
              resolve({
                data: [
                  {
                    id: 1,
                    name: 'Public League',
                    league_type: 'classic',
                    privacy_level: 'public',
                    description: null,
                    max_participants: 20,
                    current_participants: 5,
                    invite_code: 'PUB-1234',
                    status: 'active',
                    created_at: '2026-09-01T00:00:00Z',
                    league_participants: [],
                    head_to_head_matchups: [],
                  },
                ],
                error: null,
              });
            },
          };
          return query;
        }
        if (table === 'job_execution_log') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            not: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
              data: { completed_at: '2026-10-10T12:00:00Z' },
              error: null,
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      mockSupabaseServer.mockReturnValue({ from: mockFrom });

      const response = await GET(new NextRequest('http://localhost:3000/api/leagues'));
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.leagues).toHaveLength(1);
      expect(json.leagues[0].name).toBe('Public League');
      expect(leaguesQueryCalled).toBe(true);
      expect(orFilterApplied).toBe('privacy_level.neq.private,id.in.(101,102)');
    });

    it('returns empty list immediately without querying leagues if privacy=private and user has no memberships', async () => {
      let leaguesQueryCalled = false;
      const mockFrom = jest.fn((table: string) => {
        if (table === 'league_participants') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }
        if (table === 'leagues') {
          leaguesQueryCalled = true;
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });

      mockSupabaseServer.mockReturnValue({ from: mockFrom });

      const response = await GET(new NextRequest('http://localhost:3000/api/leagues?privacy=private'));
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.leagues).toEqual([]);
      expect(json.count).toBe(0);
      expect(leaguesQueryCalled).toBe(false);
    });
  });

  describe('POST /api/leagues action=join atomic RPC', () => {
    it('requires an invite code', async () => {
      mockSupabaseServer.mockReturnValue({});

      const response = await POST(new NextRequest('http://localhost:3000/api/leagues', {
        method: 'POST',
        body: JSON.stringify({ action: 'join', inviteCode: '   ' }),
        headers: { 'content-type': 'application/json' },
      }));

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('Invite code is required to join a league.');
    });

    it('delegates joining to join_league_atomic RPC and returns serialized league data', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: {
          success: true,
          message: 'Joined Champions League successfully.',
          league: {
            id: 42,
            season_id: 1,
            name: 'Champions League',
            creator_id: 'creator-99',
            max_participants: 16,
            current_participants: 9,
            invite_code: 'CHA-1234',
            league_type: 'classic',
            privacy_level: 'private',
            description: 'Top tier league',
            status: 'active',
          },
        },
        error: null,
      });

      mockSupabaseServer.mockReturnValue({ rpc: mockRpc });

      const response = await POST(new NextRequest('http://localhost:3000/api/leagues', {
        method: 'POST',
        body: JSON.stringify({ action: 'join', inviteCode: 'cha-1234' }),
        headers: { 'content-type': 'application/json' },
      }));

      expect(response.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith('join_league_atomic', {
        p_user_id: 'manager-1',
        p_invite_code: 'CHA-1234',
      });

      const json = await response.json();
      expect(json.data.id).toBe(42);
      expect(json.data.currentParticipants).toBe(9);
      expect(json.data.maxParticipants).toBe(16);
      expect(json.message).toBe('Joined Champions League successfully.');
      expect(mockDeliverPushNotifications).toHaveBeenCalledWith(expect.anything(), [
        {
          userId: 'creator-99',
          type: 'league_invite',
          metadata: { league_id: 42 },
        },
      ]);
    });

    it('surfaces capacity errors returned by the RPC', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: {
          success: false,
          status: 409,
          message: 'This league is full.',
        },
        error: null,
      });

      mockSupabaseServer.mockReturnValue({ rpc: mockRpc });

      const response = await POST(new NextRequest('http://localhost:3000/api/leagues', {
        method: 'POST',
        body: JSON.stringify({ action: 'join', inviteCode: 'FULL-LEAGUE' }),
        headers: { 'content-type': 'application/json' },
      }));

      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error).toBe('This league is full.');
    });

    it('surfaces already-member errors returned by the RPC', async () => {
      const mockRpc = jest.fn().mockResolvedValue({
        data: {
          success: false,
          status: 409,
          message: 'You are already in this league.',
        },
        error: null,
      });

      mockSupabaseServer.mockReturnValue({ rpc: mockRpc });

      const response = await POST(new NextRequest('http://localhost:3000/api/leagues', {
        method: 'POST',
        body: JSON.stringify({ action: 'join', inviteCode: 'JOINED-LEAGUE' }),
        headers: { 'content-type': 'application/json' },
      }));

      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error).toBe('You are already in this league.');
    });
  });
});
