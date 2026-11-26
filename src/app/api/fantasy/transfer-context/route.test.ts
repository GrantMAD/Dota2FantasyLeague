import { NextRequest } from 'next/server';
import { GET } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockGetOrCreateFantasySeason = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/fantasy-season', () => ({
  getOrCreateFantasySeason: (...args: unknown[]) => mockGetOrCreateFantasySeason(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

describe('GET /api/fantasy/transfer-context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'manager-1' });
    mockGetOrCreateFantasySeason.mockResolvedValue({
      id: 15,
      season_id: 2,
      budget: 12.5,
      free_transfers: 1,
    });
  });

  function setupTables({
    wildcardGameweekId,
    gameweekNumber,
    currentMarketPrice = 9.0,
  }: {
    wildcardGameweekId: number | null;
    gameweekNumber?: number;
    currentMarketPrice?: number;
  }) {
    // gameweeks is only queried once: to resolve the wildcard gameweek number (by id).
    // Price resolution now uses player_prices ordered by gameweek_id DESC — no gameweek lookup.
    const queries: Record<string, Record<string, jest.Mock>> = {
      fantasy_seasons: {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { wildcard_used_gameweek_id: wildcardGameweekId },
          error: null,
        }),
      },
      gameweeks: {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: gameweekNumber === undefined ? null : { gameweek_number: gameweekNumber },
          error: null,
        }),
      },
      fantasy_squads: {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 55, fantasy_squad_members: [{ player_id: 22, cost: '8.50', removed_date: null }] },
          error: null,
        }),
      },
      // player_prices: .select().in().order().limit() — returns most recent price rows
      player_prices: {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [{ player_id: 22, price: currentMarketPrice }],
          error: null,
        }),
      },
    };
    mockSupabaseServer.mockReturnValue({
      from: jest.fn((table: string) => queries[table]),
    });
    return queries;
  }

  it('returns the gameweek number where the current season Wildcard was used', async () => {
    const queries = setupTables({ wildcardGameweekId: 91, gameweekNumber: 6, currentMarketPrice: 9.0 });

    const response = await GET(new NextRequest('http://localhost:3000/api/fantasy/transfer-context'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      wildcardUsed: true,
      wildcardUsedGameweekId: 91,
      wildcardUsedGameweekNumber: 6,
      ownedPlayerIds: [22],
      // cost comes from player_prices (current market price), not acquisition cost
      ownedPlayerCosts: [{ playerId: 22, cost: 9.0 }],
    });
    expect(queries.gameweeks.eq).toHaveBeenCalledWith('id', 91);
    expect(mockGetOrCreateFantasySeason).toHaveBeenCalledWith(expect.anything(), 'manager-1');
  });

  it('does not look up a gameweek for an unused Wildcard', async () => {
    const queries = setupTables({ wildcardGameweekId: null, currentMarketPrice: 9.0 });

    const response = await GET(new NextRequest('http://localhost:3000/api/fantasy/transfer-context'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      wildcardUsed: false,
      wildcardUsedGameweekId: null,
      wildcardUsedGameweekNumber: null,
    });
    // No wildcard used → gameweeks should NOT be queried at all
    expect(queries.gameweeks.maybeSingle).not.toHaveBeenCalled();
  });
});
