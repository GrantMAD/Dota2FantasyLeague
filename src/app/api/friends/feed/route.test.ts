import { NextRequest } from 'next/server';
import { GET } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockRpc = jest.fn();

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

const activity = (id: number) => ({
  activity_id: `score:${String(id).padStart(20, '0')}`,
  activity_type: 'gameweek_score',
  user_id: 'followed-user',
  username: 'manager',
  display_name: 'Manager',
  avatar_url: null,
  season_id: 1,
  season_name: 'Season',
  gameweek_id: id,
  gameweek_number: id,
  title: `Gameweek ${id} scores are in`,
  players_in: null,
  players_out: null,
  chip: null,
  gameweek_points: 10,
  total_points: 30,
  gameweek_rank: 4,
  previous_gameweek_rank: 5,
  global_rank: 4,
  updated_at: `2026-10-${String(id).padStart(2, '0')} 12:00:00`,
  lineup_changes: null,
});

describe('GET /api/friends/feed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'viewer' });
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockSupabaseServer.mockReturnValue({ rpc: mockRpc });
  });

  it('returns a private empty feed for managers who do not follow anyone', async () => {
    const response = await GET(new NextRequest('http://localhost/api/friends/feed'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body).toEqual({ activities: [], nextCursor: null });
    expect(mockRpc).toHaveBeenCalledWith('get_followed_activity_feed', {
      p_viewer_id: 'viewer',
      p_before: null,
      p_before_id: null,
      p_limit: 21,
    });
  });

  it('paginates activity and decodes the timestamp/id cursor for the next page', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: Array.from({ length: 21 }, (_, index) => activity(index + 1)), error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const firstResponse = await GET(new NextRequest('http://localhost/api/friends/feed'));
    const firstBody = await firstResponse.json();
    expect(firstBody.activities).toHaveLength(20);
    expect(firstBody.nextCursor).toEqual(expect.any(String));

    const secondResponse = await GET(new NextRequest(
      `http://localhost/api/friends/feed?cursor=${encodeURIComponent(firstBody.nextCursor)}`,
    ));
    expect(secondResponse.status).toBe(200);
    expect(mockRpc).toHaveBeenLastCalledWith('get_followed_activity_feed', {
      p_viewer_id: 'viewer',
      p_before: '2026-10-20 12:00:00',
      p_before_id: 'score:00000000000000000020',
      p_limit: 21,
    });
  });

  it('rejects malformed cursors without querying the database', async () => {
    const response = await GET(new NextRequest('http://localhost/api/friends/feed?cursor=not-valid'));

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
