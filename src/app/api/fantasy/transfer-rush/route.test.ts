import { NextRequest } from 'next/server';

const mockSupabaseServer = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

import { GET } from './route';

describe('GET /api/fantasy/transfer-rush', () => {
  const mockGameweeks = [
    {
      id: 10,
      gameweek_number: 5,
      deadline: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour ahead
      status: 'upcoming',
    },
  ];

  const mockAuditRows = [
    {
      id: 101,
      created_at: new Date(Date.now() - 300 * 1000).toISOString(),
      new_values: {
        transfers_in: [501, 502],
        transfers_out: [503, 504],
        gameweek_id: 10,
      },
    },
    {
      id: 102,
      created_at: new Date(Date.now() - 600 * 1000).toISOString(),
      new_values: {
        transfers_in: [501],
        transfers_out: [505],
        gameweek_id: 10,
      },
    },
  ];

  const mockPlayers = [
    {
      id: 501,
      name: 'Wang Chunyu',
      in_game_name: 'Ame',
      role: 'Carry',
      current_price: 6.2,
      professional_teams: { name: 'Xtreme Gaming', logo_url: 'https://cdn.example.com/xtreme.png' },
    },
    {
      id: 502,
      name: 'Stanislav Potorak',
      in_game_name: 'Malr1ne',
      role: 'Mid',
      current_price: 5.8,
      professional_teams: { name: 'Team Falcons', logo_url: 'https://cdn.example.com/falcons.png' },
    },
    {
      id: 503,
      name: 'Alan Galliamov',
      in_game_name: 'Satanic',
      role: 'Carry',
      current_price: 5.1,
      professional_teams: { name: 'Team Spirit', logo_url: 'https://cdn.example.com/spirit.png' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('aggregates transfer in and out counts correctly and reports rush active within 2 hours', async () => {
    mockSupabaseServer.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'gameweeks') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: mockGameweeks, error: null }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: mockAuditRows, error: null }),
          };
        }
        if (table === 'professional_players') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: mockPlayers, error: null }),
          };
        }
        return { select: jest.fn().mockReturnThis() };
      }),
    });

    const req = new NextRequest('http://localhost:3000/api/fantasy/transfer-rush?windowMinutes=60');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.gameweek.gameweekNumber).toBe(5);
    expect(json.isRushActive).toBe(true);
    expect(json.gameweek.isLocked).toBe(false);
    expect(json.topTransferredIn.length).toBeGreaterThan(0);
    // Player 501 (Ame) should have count 2
    expect(json.topTransferredIn[0].id).toBe(501);
    expect(json.topTransferredIn[0].inGameName).toBe('Ame');
    expect(json.topTransferredIn[0].transferCount).toBe(2);
    // Activity pulses should reflect Ame milestone
    expect(json.activityPulses.some((p: { message: string }) => p.message.includes('Ame'))).toBe(true);
  });

  it('handles empty audit records cleanly', async () => {
    mockSupabaseServer.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'gameweeks') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: mockGameweeks, error: null }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return { select: jest.fn().mockReturnThis() };
      }),
    });

    const req = new NextRequest('http://localhost:3000/api/fantasy/transfer-rush');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.totalTransfersInWindow).toBe(0);
    expect(json.topTransferredIn).toEqual([]);
    expect(json.topTransferredOut).toEqual([]);
    expect(json.activityPulses.length).toBeGreaterThan(0);
  });
});
