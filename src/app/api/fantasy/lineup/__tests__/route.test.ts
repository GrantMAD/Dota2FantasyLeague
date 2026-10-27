import { NextRequest } from 'next/server';
import { GET, PUT } from '../route';
import { logAuditAction } from '@/lib/audit-logger';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/audit-logger', () => ({
  logAuditAction: jest.fn(),
}));

const validLineup = [
  { playerId: 1, slot: 'carry', isCaptain: true, isViceCaptain: false },
  { playerId: 2, slot: 'mid', isCaptain: false, isViceCaptain: true },
  { playerId: 3, slot: 'offlane', isCaptain: false, isViceCaptain: false },
  { playerId: 4, slot: 'support', isCaptain: false, isViceCaptain: false },
  { playerId: 5, slot: 'hard_support', isCaptain: false, isViceCaptain: false },
];

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/fantasy/lineup', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('PUT /api/fantasy/lineup boundary validation', () => {
  beforeEach(() => {
    mockVerifyAuth.mockResolvedValue({ userId: 'manager-1', email: 'manager@example.test' });
    mockSupabaseServer.mockReset();
    jest.mocked(logAuditAction).mockClear();
  });

  it('records old and new player assignments so the friends feed can explain lineup changes', async () => {
    const previousLineup = {
      carry_id: 1,
      mid_id: 2,
      offlane_id: 3,
      support_id: 4,
      hard_support_id: 5,
      bench_1_id: null,
      bench_2_id: null,
      bench_3_id: null,
      captain_player_id: 1,
      vice_captain_player_id: 2,
    };
    const updatedLineup = {
      id: 55,
      fantasy_season_id: 9,
      gameweek_id: 7,
      ...previousLineup,
      carry_id: 6,
      captain_player_id: 6,
    };
    const queryFor = (table: string) => {
      const query: Record<string, jest.Mock> = {};
      const chain = () => query;
      query.select = jest.fn(chain);
      query.eq = jest.fn(chain);
      query.in = jest.fn(chain);
      query.limit = jest.fn(chain);
      query.upsert = jest.fn(() => {
        return query;
      });
      query.maybeSingle = jest.fn(async () => {
        if (table === 'gameweeks') return { data: { season_id: 12, status: 'active', deadline: null }, error: null };
        if (table === 'fantasy_seasons') return { data: { id: 9, season_id: 12 }, error: null };
        if (table === 'fantasy_squads') return { data: { id: 88 }, error: null };
        if (table === 'fantasy_lineups') return { data: previousLineup, error: null };
        return { data: null, error: null };
      });
      query.single = jest.fn(async () => ({ data: updatedLineup, error: null }));
      query.then = jest.fn((resolve: (value: unknown) => unknown) => {
        if (table === 'fantasy_squad_members') {
          return resolve({ data: [1, 2, 3, 4, 5, 6].map((player_id) => ({ player_id, removed_date: null })), error: null });
        }
        if (table === 'professional_players') {
          return resolve({ data: [
            { id: 2, primary_role: 'Mid' },
            { id: 3, primary_role: 'Offlane' },
            { id: 4, primary_role: 'Support' },
            { id: 5, primary_role: 'Hard Support' },
            { id: 6, primary_role: 'Carry' },
          ], error: null });
        }
        return resolve({ data: [], error: null });
      });
      return query;
    };
    mockSupabaseServer.mockReturnValue({ from: queryFor });

    const response = await PUT(request({ gameweekId: 7, lineup: [
      { ...validLineup[0], playerId: 6 },
      ...validLineup.slice(1),
    ] }));

    expect(response.status).toBe(200);
    expect(logAuditAction).toHaveBeenCalledWith(expect.objectContaining({
      tableName: 'fantasy_lineups',
      recordId: 55,
      oldValues: {
        gameweek_id: 7,
        slots: {
          carry: 1,
          mid: 2,
          offlane: 3,
          support: 4,
          hard_support: 5,
          bench_1: null,
          bench_2: null,
          bench_3: null,
        },
        captain_player_id: 1,
        vice_captain_player_id: 2,
      },
      newValues: {
        gameweek_id: 7,
        slots: {
          carry: 6,
          mid: 2,
          offlane: 3,
          support: 4,
          hard_support: 5,
          bench_1: null,
          bench_2: null,
          bench_3: null,
        },
        captain_player_id: 6,
        vice_captain_player_id: 2,
      },
    }));
  });

  describe('GET /api/fantasy/lineup season isolation', () => {
    beforeEach(() => {
      mockVerifyAuth.mockResolvedValue({ userId: 'manager-1', email: 'manager@example.test' });
    });

    it('only looks up the fantasy enrollment for the requested gameweek season', async () => {
      const filters: Record<string, string | number> = {};
      const queryFor = (table: string) => {
        const query = {
          select: () => query,
          eq: (column: string, value: string | number) => {
            filters[`${table}.${column}`] = value;
            return query;
          },
          maybeSingle: async () => ({
            data: table === 'gameweeks' ? { season_id: 12 } : null,
            error: null,
          }),
        };
        return query;
      };
      mockSupabaseServer.mockReturnValue({ from: queryFor });

      const response = await GET(new NextRequest(
        'http://localhost:3000/api/fantasy/lineup?gameweekId=91',
      ));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ fantasySeasonId: null, gameweekId: '91', lineup: [] });
      expect(filters).toMatchObject({
        'gameweeks.id': 91,
        'fantasy_seasons.user_id': 'manager-1',
        'fantasy_seasons.season_id': 12,
      });
    });
  });

  it.each([
    {
      name: 'rejects duplicate slot assignments',
      lineup: validLineup.map((entry, index) => index === 1 ? { ...entry, slot: 'carry' } : entry),
      message: 'Each lineup slot can only be assigned once.',
    },
    {
      name: 'rejects assigning one player to multiple slots',
      lineup: validLineup.map((entry, index) => index === 1 ? { ...entry, playerId: 1 } : entry),
      message: 'A player cannot occupy more than one lineup slot.',
    },
    {
      name: 'rejects incomplete starting roles',
      lineup: validLineup.slice(0, 4),
      message: 'Lineup must include all five starters and no more than eight players.',
    },
    {
      name: 'rejects captain selections outside the starting five',
      lineup: [
        ...validLineup.map((entry) => ({ ...entry, isCaptain: false })),
        { playerId: 6, slot: 'bench_1', isCaptain: true, isViceCaptain: false },
      ],
      message: 'Select one different captain and vice-captain from the starting lineup.',
    },
    {
      name: 'rejects the same player as captain and vice-captain',
      lineup: validLineup.map((entry, index) => index === 1
        ? { ...entry, isCaptain: true }
        : entry),
      message: 'Select one different captain and vice-captain from the starting lineup.',
    },
  ])('$name', async ({ lineup, message }) => {
    const response = await PUT(request({ gameweekId: 7, lineup }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: message });
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });
});
