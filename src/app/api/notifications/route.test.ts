import { NextRequest } from 'next/server';
import { GET } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();

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

interface MockBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  in: jest.Mock;
  order: jest.Mock;
  or: jest.Mock;
  limit: jest.Mock;
  then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>;
  countQuery: boolean;
}

const mockBuilders: MockBuilder[] = [];
let notificationRows: Array<Record<string, unknown>> = [];

function makeBuilder(): MockBuilder {
  const builder: MockBuilder = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
    or: jest.fn(),
    limit: jest.fn(),
    countQuery: false,
    then(resolve, reject) {
      const result = this.countQuery
        ? { count: 7, error: null }
        : { data: notificationRows, count: 42, error: null };
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  builder.select.mockImplementation((_columns: string, options?: { head?: boolean }) => {
    builder.countQuery = options?.head === true;
    return builder;
  });
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.or.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  mockBuilders.push(builder);
  return builder;
}

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/notifications${query}`);
}

describe('GET /api/notifications filtering and pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuilders.length = 0;
    notificationRows = [];
    mockVerifyAuth.mockResolvedValue({ userId: 'user-1', email: 'manager@example.test' });
    mockSupabaseServer.mockReturnValue({ from: () => makeBuilder() });
  });

  it('applies category and unread filters in the database before limiting results', async () => {
    const response = await GET(makeRequest('?category=league&unreadOnly=true&limit=10'));
    const body = await response.json();
    const notificationQuery = mockBuilders.find((builder) => !builder.countQuery);

    expect(response.status).toBe(200);
    expect(notificationQuery?.in).toHaveBeenCalledWith(
      'type',
      ['league_invite', 'league_activity', 'league_result', 'h2h_result']
    );
    expect(notificationQuery?.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(notificationQuery?.eq).toHaveBeenCalledWith('is_read', false);
    expect(notificationQuery?.order).toHaveBeenNthCalledWith(1, 'created_at', { ascending: false });
    expect(notificationQuery?.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false });
    expect(notificationQuery?.limit).toHaveBeenCalledWith(11);
    expect(body).toMatchObject({
      notifications: [],
      unreadCount: 7,
      nextCursor: null,
    });
  });

  it.each([
    ['market', ['price_change', 'transfer_market', 'wildcard_used', 'player_removed']],
    ['scoring', ['score_posted', 'gameweek_result', 'rank_movement', 'rank_update']],
  ])('includes supported %s notification types in its category filter', async (category, expectedTypes) => {
    const response = await GET(makeRequest(`?category=${category}`));
    const notificationQuery = mockBuilders.find((builder) => !builder.countQuery);

    expect(response.status).toBe(200);
    expect(notificationQuery?.in).toHaveBeenCalledWith('type', expectedTypes);
  });

  it('returns a cursor based on the last returned row and applies a stable tie-breaker on the next page', async () => {
    notificationRows = [
      { id: 15, type: 'deadline_reminder', created_at: '2026-10-13T12:00:00.000Z' },
      { id: 14, type: 'deadline_reminder', created_at: '2026-10-13T12:00:00.000Z' },
    ];
    const firstResponse = await GET(makeRequest('?category=deadline&limit=1'));
    const firstBody = await firstResponse.json();

    expect(firstBody.notifications).toHaveLength(1);
    expect(firstBody.notifications[0].id).toBe(15);
    expect(firstBody.nextCursor).toEqual(expect.any(String));

    mockBuilders.length = 0;
    notificationRows = [];
    const cursor = encodeURIComponent(firstBody.nextCursor as string);
    const secondResponse = await GET(makeRequest(`?category=deadline&limit=1&cursor=${cursor}`));
    const secondBody = await secondResponse.json();
    const notificationQuery = mockBuilders.find((builder) => !builder.countQuery);

    expect(secondResponse.status).toBe(200);
    expect(notificationQuery?.or).toHaveBeenCalledWith(
      'created_at.lt.2026-10-13T12:00:00.000Z,and(created_at.eq.2026-10-13T12:00:00.000Z,id.lt.15)'
    );
    expect(secondBody.nextCursor).toBeNull();
  });

  it.each([
    '?category=unknown',
    '?limit=0',
    '?limit=1.5',
    '?limit=101',
    '?cursor=not-a-cursor',
  ])('rejects invalid query parameters: %s', async (query) => {
    const response = await GET(makeRequest(query));

    expect(response.status).toBe(400);
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });
});
