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
  }: {
    wildcardGameweekId: number | null;
    gameweekNumber?: number;
  }) {
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
          data: { fantasy_squad_members: [{ player_id: 22, removed_date: null }] },
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
    const queries = setupTables({ wildcardGameweekId: 91, gameweekNumber: 6 });

    const response = await GET(new NextRequest('http://localhost:3000/api/fantasy/transfer-context'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      wildcardUsed: true,
      wildcardUsedGameweekId: 91,
      wildcardUsedGameweekNumber: 6,
      ownedPlayerIds: [22],
    });
    expect(queries.gameweeks.eq).toHaveBeenCalledWith('id', 91);
    expect(mockGetOrCreateFantasySeason).toHaveBeenCalledWith(expect.anything(), 'manager-1');
  });

  it('does not look up a gameweek for an unused Wildcard', async () => {
    const queries = setupTables({ wildcardGameweekId: null });

    const response = await GET(new NextRequest('http://localhost:3000/api/fantasy/transfer-context'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      wildcardUsed: false,
      wildcardUsedGameweekId: null,
      wildcardUsedGameweekNumber: null,
    });
    expect(queries.gameweeks.maybeSingle).not.toHaveBeenCalled();
  });
});
