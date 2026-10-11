import { NextRequest } from 'next/server';
import { GET } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockCanUsePremiumFeature = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

jest.mock('@/lib/premium', () => ({
  canUsePremiumFeature: (...args: unknown[]) => mockCanUsePremiumFeature(...args),
}));

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRequest(playerId = '42') {
  return new NextRequest(`http://localhost:3000/api/players/${playerId}/analytics`);
}

interface MockQueryBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  in: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  maybeSingle: jest.Mock;
}

function makeQueryBuilder(overrides: Partial<MockQueryBuilder> = {}): MockQueryBuilder {
  const builder: MockQueryBuilder = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    maybeSingle: jest.fn(),
    ...overrides,
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
}

// ─── test suite ─────────────────────────────────────────────────────────────

describe('GET /api/players/:id/analytics — Finding 2: Scoped breakdown query', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'user-1', email: 'test@example.test' });
    mockCanUsePremiumFeature.mockReturnValue(true);
  });

  // ── Finding 2 core fix ───────────────────────────────────────────────────

  it('queries fantasy_points_breakdown only for the player\'s own performance IDs, not the whole table', async () => {
    const capturedInValues: number[] = [];

    const performancesBuilder = makeQueryBuilder();
    performancesBuilder.limit.mockResolvedValue({
      data: [
        { id: 101, gameweek_id: 1 },
        { id: 102, gameweek_id: 2 },
      ],
      error: null,
    });

    const breakdownBuilderFinal = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockImplementation((_col: string, ids: number[]) => {
        capturedInValues.push(...ids);
        return Promise.resolve({
          data: [
            { performance_id: 101, total_points: 30 },
            { performance_id: 102, total_points: 25 },
          ],
          error: null,
        });
      }),
    };

    const pricesBuilder = makeQueryBuilder();
    pricesBuilder.limit.mockResolvedValue({ data: [], error: null });

    const profileBuilder = makeQueryBuilder();
    profileBuilder.maybeSingle.mockResolvedValue({
      data: { is_premium: true, subscription_tier: 'pro' },
      error: null,
    });

    const mockFrom = jest.fn((table: string) => {
      if (table === 'users') return profileBuilder;
      if (table === 'player_performances') return performancesBuilder;
      if (table === 'fantasy_points_breakdown') return breakdownBuilderFinal;
      if (table === 'player_prices') return pricesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockSupabaseServer.mockReturnValue({ from: mockFrom });

    const response = await GET(makeRequest('42'), { params: Promise.resolve({ id: '42' }) });
    expect(response.status).toBe(200);

    // The breakdown was queried with .in('performance_id', [101, 102]) NOT the full table
    expect(capturedInValues).toEqual(expect.arrayContaining([101, 102]));
    expect(capturedInValues).toHaveLength(2);
  });

  it('returns correct points from the scoped breakdown map', async () => {
    const performancesBuilder = makeQueryBuilder();
    performancesBuilder.limit.mockResolvedValue({
      data: [
        { id: 201, gameweek_id: 3 },
        { id: 202, gameweek_id: 4 },
      ],
      error: null,
    });

    const breakdownBuilderFinal = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [
          { performance_id: 201, total_points: 42 },
          { performance_id: 202, total_points: 17 },
        ],
        error: null,
      }),
    };

    const pricesBuilder = makeQueryBuilder();
    pricesBuilder.limit.mockResolvedValue({
      data: [
        { gameweek_id: 3, price: 8.5 },
        { gameweek_id: 4, price: 9.0 },
      ],
      error: null,
    });

    const profileBuilder = makeQueryBuilder();
    profileBuilder.maybeSingle.mockResolvedValue({
      data: { is_premium: true, subscription_tier: 'pro' },
      error: null,
    });

    const mockFrom = jest.fn((table: string) => {
      if (table === 'users') return profileBuilder;
      if (table === 'player_performances') return performancesBuilder;
      if (table === 'fantasy_points_breakdown') return breakdownBuilderFinal;
      if (table === 'player_prices') return pricesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockSupabaseServer.mockReturnValue({ from: mockFrom });

    const response = await GET(makeRequest('7'), { params: Promise.resolve({ id: '7' }) });
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.playerId).toBe(7);
    expect(json.analytics.matches).toBe(2);
    // bestPoints should reflect 42 (not 0 from a missed global lookup)
    expect(json.analytics.bestPoints).toBe(42);
    // averagePoints = (42 + 17) / 2 = 29.5
    expect(json.analytics.averagePoints).toBe(29.5);
    // latestPoints = 17 (last sample)
    expect(json.analytics.latestPoints).toBe(17);
    // latestPrice = 9.0
    expect(json.analytics.latestPrice).toBe(9);
  });

  // ── Empty performances guard ─────────────────────────────────────────────

  it('skips the breakdown query entirely when the player has no performances', async () => {
    const performancesBuilder = makeQueryBuilder();
    performancesBuilder.limit.mockResolvedValue({ data: [], error: null });

    const profileBuilder = makeQueryBuilder();
    profileBuilder.maybeSingle.mockResolvedValue({
      data: { is_premium: true, subscription_tier: 'pro' },
      error: null,
    });

    const pricesBuilder = makeQueryBuilder();
    pricesBuilder.limit.mockResolvedValue({ data: [], error: null });

    const mockFrom = jest.fn((table: string) => {
      if (table === 'users') return profileBuilder;
      if (table === 'player_performances') return performancesBuilder;
      if (table === 'player_prices') return pricesBuilder;
      // fantasy_points_breakdown must NOT be queried at all
      if (table === 'fantasy_points_breakdown') {
        throw new Error('fantasy_points_breakdown must not be queried when there are no performances');
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    mockSupabaseServer.mockReturnValue({ from: mockFrom });

    const response = await GET(makeRequest('99'), { params: Promise.resolve({ id: '99' }) });
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.analytics.matches).toBe(0);
    expect(json.analytics.bestPoints).toBe(0);
    expect(json.analytics.averagePoints).toBe(0);
  });

  // ── Breakdown query error handling ───────────────────────────────────────

  it('returns 500 when the breakdown query fails', async () => {
    const performancesBuilder = makeQueryBuilder();
    performancesBuilder.limit.mockResolvedValue({
      data: [{ id: 301, gameweek_id: 5 }],
      error: null,
    });

    const breakdownBuilderFinal = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB error', code: '500' },
      }),
    };

    const profileBuilder = makeQueryBuilder();
    profileBuilder.maybeSingle.mockResolvedValue({
      data: { is_premium: true, subscription_tier: 'pro' },
      error: null,
    });

    const pricesBuilder = makeQueryBuilder();
    pricesBuilder.limit.mockResolvedValue({ data: [], error: null });

    const mockFrom = jest.fn((table: string) => {
      if (table === 'users') return profileBuilder;
      if (table === 'player_performances') return performancesBuilder;
      if (table === 'fantasy_points_breakdown') return breakdownBuilderFinal;
      if (table === 'player_prices') return pricesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockSupabaseServer.mockReturnValue({ from: mockFrom });

    const response = await GET(makeRequest('5'), { params: Promise.resolve({ id: '5' }) });
    expect(response.status).toBe(500);

    const json = await response.json();
    expect(json.error).toBe('Failed to load player analytics.');
  });

  // ── Performance query error handling ────────────────────────────────────

  it('returns 500 when the player_performances query fails', async () => {
    const performancesBuilder = makeQueryBuilder();
    performancesBuilder.limit.mockResolvedValue({
      data: null,
      error: { message: 'Connection timeout', code: '504' },
    });

    const profileBuilder = makeQueryBuilder();
    profileBuilder.maybeSingle.mockResolvedValue({
      data: { is_premium: true, subscription_tier: 'pro' },
      error: null,
    });

    const mockFrom = jest.fn((table: string) => {
      if (table === 'users') return profileBuilder;
      if (table === 'player_performances') return performancesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockSupabaseServer.mockReturnValue({ from: mockFrom });

    const response = await GET(makeRequest('5'), { params: Promise.resolve({ id: '5' }) });
    expect(response.status).toBe(500);

    const json = await response.json();
    expect(json.error).toBe('Failed to load player analytics.');
  });

  // ── Premium gate ─────────────────────────────────────────────────────────

  it('returns 403 for non-premium users', async () => {
    mockCanUsePremiumFeature.mockReturnValue(false);

    const profileBuilder = makeQueryBuilder();
    profileBuilder.maybeSingle.mockResolvedValue({
      data: { is_premium: false, subscription_tier: null },
      error: null,
    });

    const mockFrom = jest.fn((table: string) => {
      if (table === 'users') return profileBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockSupabaseServer.mockReturnValue({ from: mockFrom });

    const response = await GET(makeRequest('1'), { params: Promise.resolve({ id: '1' }) });
    expect(response.status).toBe(403);

    const json = await response.json();
    expect(json.error).toMatch(/premium/i);
  });

  // ── Query proportionality ─────────────────────────────────────────────────

  it('passes exactly the correct performance IDs to the breakdown query with no extras', async () => {
    const capturedIds: number[] = [];

    const performancesBuilder = makeQueryBuilder();
    performancesBuilder.limit.mockResolvedValue({
      data: [
        { id: 501, gameweek_id: 1 },
        { id: 502, gameweek_id: 2 },
        { id: 503, gameweek_id: 3 },
      ],
      error: null,
    });

    const breakdownBuilderFinal = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockImplementation((_col: string, ids: number[]) => {
        capturedIds.push(...ids);
        return Promise.resolve({
          data: ids.map((id) => ({ performance_id: id, total_points: 10 })),
          error: null,
        });
      }),
    };

    const pricesBuilder = makeQueryBuilder();
    pricesBuilder.limit.mockResolvedValue({ data: [], error: null });

    const profileBuilder = makeQueryBuilder();
    profileBuilder.maybeSingle.mockResolvedValue({
      data: { is_premium: true, subscription_tier: 'pro' },
      error: null,
    });

    const mockFrom = jest.fn((table: string) => {
      if (table === 'users') return profileBuilder;
      if (table === 'player_performances') return performancesBuilder;
      if (table === 'fantasy_points_breakdown') return breakdownBuilderFinal;
      if (table === 'player_prices') return pricesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockSupabaseServer.mockReturnValue({ from: mockFrom });

    const response = await GET(makeRequest('77'), { params: Promise.resolve({ id: '77' }) });
    expect(response.status).toBe(200);

    // Exactly the 3 performance IDs from this player — no global scan
    expect(capturedIds).toHaveLength(3);
    expect(capturedIds).toEqual(expect.arrayContaining([501, 502, 503]));
  });

  // ── Missing breakdown entry returns 0 (graceful default) ─────────────────

  it('defaults to 0 points when a performance ID is absent from the breakdown result', async () => {
    const performancesBuilder = makeQueryBuilder();
    performancesBuilder.limit.mockResolvedValue({
      data: [
        { id: 601, gameweek_id: 1 },
        { id: 602, gameweek_id: 2 }, // no breakdown entry for this one
      ],
      error: null,
    });

    const breakdownBuilderFinal = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [
          { performance_id: 601, total_points: 35 },
          // 602 deliberately absent
        ],
        error: null,
      }),
    };

    const pricesBuilder = makeQueryBuilder();
    pricesBuilder.limit.mockResolvedValue({ data: [], error: null });

    const profileBuilder = makeQueryBuilder();
    profileBuilder.maybeSingle.mockResolvedValue({
      data: { is_premium: true, subscription_tier: 'pro' },
      error: null,
    });

    const mockFrom = jest.fn((table: string) => {
      if (table === 'users') return profileBuilder;
      if (table === 'player_performances') return performancesBuilder;
      if (table === 'fantasy_points_breakdown') return breakdownBuilderFinal;
      if (table === 'player_prices') return pricesBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockSupabaseServer.mockReturnValue({ from: mockFrom });

    const response = await GET(makeRequest('12'), { params: Promise.resolve({ id: '12' }) });
    expect(response.status).toBe(200);

    const json = await response.json();
    // bestPoints = 35 (from perf 601); perf 602 defaults to 0
    expect(json.analytics.bestPoints).toBe(35);
    // averagePoints = (35 + 0) / 2 = 17.5
    expect(json.analytics.averagePoints).toBe(17.5);
    expect(json.analytics.matches).toBe(2);
  });
});
