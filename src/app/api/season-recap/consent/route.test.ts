import { NextRequest } from 'next/server';
import { GET, PUT } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockQuery = {
  select: jest.fn(),
  update: jest.fn(),
  eq: jest.fn(),
  maybeSingle: jest.fn(),
};

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _path: string, handler: unknown) => handler,
}));

describe('Season Recap consent API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'user-123' });
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.update.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockSupabaseServer.mockReturnValue({ from: () => mockQuery });
  });

  it('returns the saved consent for the authenticated account', async () => {
    mockQuery.maybeSingle.mockResolvedValue({
      data: { season_recap_sharing_consent: true },
      error: null,
    });

    const response = await GET(new NextRequest('https://example.test/api/season-recap/consent'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ sharingConsent: true });
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'user-123');
  });

  it('saves consent for the authenticated account and supports revocation', async () => {
    mockQuery.maybeSingle.mockResolvedValue({
      data: { season_recap_sharing_consent: false },
      error: null,
    });
    const request = new NextRequest('https://example.test/api/season-recap/consent', {
      method: 'PUT',
      body: JSON.stringify({ sharingConsent: false }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ sharingConsent: false });
    expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      season_recap_sharing_consent: false,
    }));
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'user-123');
  });

  it('rejects invalid consent values', async () => {
    const request = new NextRequest('https://example.test/api/season-recap/consent', {
      method: 'PUT',
      body: JSON.stringify({ sharingConsent: 'yes' }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(400);
    expect(mockQuery.update).not.toHaveBeenCalled();
  });
});
