import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { GET, POST } from '../route';

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: jest.fn(),
}));

function createRequest(method: string, url = 'http://localhost/api/squads', body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('squads API route', () => {
  const seasonQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
  };
  const squadQuery = {
    select: jest.fn(),
    eq: jest.fn(),
    insert: jest.fn(),
    then: jest.fn(),
  };
  const client = { from: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(verifyAuth).mockResolvedValue({
      userId: 'user-1',
      email: 'manager@example.com',
    } as Awaited<ReturnType<typeof verifyAuth>>);
    jest.mocked(supabaseServer).mockReturnValue(
      client as unknown as ReturnType<typeof supabaseServer>
    );
    seasonQuery.select.mockReturnValue(seasonQuery);
    seasonQuery.eq.mockReturnValue(seasonQuery);
    seasonQuery.maybeSingle.mockResolvedValue({ data: { id: 12 }, error: null });
    squadQuery.select.mockReturnValue(squadQuery);
    squadQuery.eq.mockReturnValue(squadQuery);
    squadQuery.insert.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [{ id: 5 }], error: null }),
    });
    squadQuery.then.mockImplementation((resolve, reject) =>
      Promise.resolve({ data: [{ id: 5 }], error: null }).then(resolve, reject)
    );
    client.from.mockImplementation((table: string) =>
      table === 'fantasy_seasons' ? seasonQuery : squadQuery
    );
  });

  it('requires authentication before database access', async () => {
    jest.mocked(verifyAuth).mockRejectedValue({ status: 401, message: 'Unauthorized' });
    const response = await POST(createRequest('POST', undefined, {
      fantasy_season_id: 12,
    }));

    expect(response.status).toBe(401);
    expect(supabaseServer).not.toHaveBeenCalled();
  });

  it('creates a squad only after confirming that the season belongs to the caller', async () => {
    const response = await POST(createRequest('POST', undefined, {
      fantasy_season_id: 12,
      name: 'My team',
    }));

    expect(response.status).toBe(201);
    expect(seasonQuery.eq).toHaveBeenNthCalledWith(1, 'id', 12);
    expect(seasonQuery.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
    expect(squadQuery.insert).toHaveBeenCalledWith({
      fantasy_season_id: 12,
      name: 'My team',
    });
  });

  it('does not create a squad for another users fantasy season', async () => {
    seasonQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await POST(createRequest('POST', undefined, {
      fantasy_season_id: 12,
    }));

    expect(response.status).toBe(404);
    expect(squadQuery.insert).not.toHaveBeenCalled();
  });

  it('filters squad reads by the authenticated user and optional season', async () => {
    const response = await GET(createRequest(
      'GET',
      'http://localhost/api/squads?season_id=4'
    ));

    expect(response.status).toBe(200);
    expect(squadQuery.eq).toHaveBeenNthCalledWith(1, 'fantasy_seasons.user_id', 'user-1');
    expect(squadQuery.eq).toHaveBeenNthCalledWith(2, 'fantasy_seasons.season_id', 4);
  });

  it('rejects malformed season filters and creation payloads', async () => {
    const invalidFilter = await GET(createRequest('GET', 'http://localhost/api/squads?season_id=abc'));
    const invalidBody = await POST(createRequest('POST', undefined, { fantasy_season_id: '12' }));

    expect(invalidFilter.status).toBe(400);
    expect(invalidBody.status).toBe(400);
    expect(seasonQuery.maybeSingle).not.toHaveBeenCalled();
  });
});
