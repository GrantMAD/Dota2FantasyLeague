import { NextRequest } from 'next/server';
import { POST } from '../route';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseServer: jest.fn(() => ({
    rpc: mockRpc,
  })),
}));

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: jest.fn(),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _path: string, handler: (req: NextRequest) => Promise<Response>) => handler,
}));

import { verifyAuth } from '@/lib/auth-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'user-uuid-123';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/fantasy/squad/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockAuth() {
  (verifyAuth as jest.Mock).mockResolvedValue({ userId: TEST_USER_ID });
}

function mockAuthFailure() {
  const err = new Error('Unauthorized') as Error & { status: number };
  err.status = 401;
  (verifyAuth as jest.Mock).mockRejectedValue(err);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/fantasy/squad/add', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Authentication ────────────────────────────────────────────────────────

  it('returns 401 when the request is unauthenticated', async () => {
    mockAuthFailure();
    const res = await POST(makeRequest({ fantasySeasonId: 1, playerIds: [10, 20] }));
    expect(res.status).toBe(401);
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it('returns 400 when fantasySeasonId is missing', async () => {
    mockAuth();
    const res = await POST(makeRequest({ playerIds: [10, 20] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/fantasySeasonId/i);
  });

  it('returns 400 when playerIds is not an array', async () => {
    mockAuth();
    const res = await POST(makeRequest({ fantasySeasonId: 1, playerIds: 'bad' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/playerIds/i);
  });

  it('returns 400 when playerIds is an empty array', async () => {
    mockAuth();
    const res = await POST(makeRequest({ fantasySeasonId: 1, playerIds: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when playerIds contains non-integers', async () => {
    mockAuth();
    const res = await POST(makeRequest({ fantasySeasonId: 1, playerIds: [1, 'abc', 3] }));
    expect(res.status).toBe(400);
  });

  // ── RPC delegation ────────────────────────────────────────────────────────

  it('calls process_initial_squad_draft with correct parameters', async () => {
    mockAuth();
    mockRpc.mockResolvedValue({
      data: { success: true, budget: 80, squad_size: 8, squad_max_size: 8 },
      error: null,
    });

    const req = makeRequest({ fantasySeasonId: 5, playerIds: [10, 20, 30] });
    await POST(req);

    expect(mockRpc).toHaveBeenCalledWith('process_initial_squad_draft', {
      p_user_id: TEST_USER_ID,
      p_fantasy_season_id: 5,
      p_player_ids: [10, 20, 30],
    });
  });

  // ── Success responses ─────────────────────────────────────────────────────

  it('returns 200 with budget and squad size on success', async () => {
    mockAuth();
    mockRpc.mockResolvedValue({
      data: { success: true, budget: 75.5, squad_size: 8, squad_max_size: 8 },
      error: null,
    });

    const res = await POST(makeRequest({ fantasySeasonId: 5, playerIds: [10, 20, 30, 40, 50, 60, 70, 80] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.budget).toBe(75.5);
    expect(body.squadSize).toBe(8);
  });

  // ── Business-logic failures from the RPC ─────────────────────────────────

  it('returns 400 when RPC reports success=false (budget exceeded)', async () => {
    mockAuth();
    mockRpc.mockResolvedValue({
      data: { success: false, message: 'Insufficient budget for the selected players.' },
      error: null,
    });

    const res = await POST(makeRequest({ fantasySeasonId: 5, playerIds: [10, 20] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/budget/i);
  });

  it('returns 400 when RPC reports success=false (team cap exceeded)', async () => {
    mockAuth();
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        message: 'Adding these players would exceed the configured professional team limit of 3.',
      },
      error: null,
    });

    const res = await POST(makeRequest({ fantasySeasonId: 5, playerIds: [10, 20, 30, 40] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/team limit/i);
  });

  it('returns 400 when RPC reports success=false (fantasy season not found)', async () => {
    mockAuth();
    mockRpc.mockResolvedValue({
      data: { success: false, message: 'Fantasy season not found.' },
      error: null,
    });

    const res = await POST(makeRequest({ fantasySeasonId: 99, playerIds: [10] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/fantasy season not found/i);
  });

  it('returns 400 when RPC reports success=false (role composition incomplete)', async () => {
    mockAuth();
    mockRpc.mockResolvedValue({
      data: {
        success: false,
        message: 'A complete squad must cover Carry, Mid, Offlane, and two Support/Hard Support roles.',
      },
      error: null,
    });

    const res = await POST(makeRequest({ fantasySeasonId: 5, playerIds: [10, 20, 30, 40, 50, 60, 70, 80] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/carry/i);
  });

  // ── Supabase-level RPC errors ─────────────────────────────────────────────

  it('returns 500 when the RPC call itself fails (Supabase error)', async () => {
    mockAuth();
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'connection error', code: '08006' },
    });

    const res = await POST(makeRequest({ fantasySeasonId: 5, playerIds: [10, 20] }));
    expect(res.status).toBe(500);
  });
});
