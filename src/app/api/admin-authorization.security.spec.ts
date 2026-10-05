/// <reference types="jest" />

const mockSupabaseServer = jest.fn();
const mockGetUser = jest.fn();
const mockMaybeSingle = jest.fn();
const mockFrom = jest.fn();
const mockCreateClient = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseServer: () => mockSupabaseServer(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { verifyAdminAuth } from '@/lib/auth-utils';
import { NextRequest } from 'next/server';
import { GET as getFailedJobs } from './admin/jobs/failed/route';
import { GET as getScoringRules, POST as createScoringVersion } from './admin/scoring/rules/route';
import { PATCH as updateScoringRule } from './admin/scoring/rules/[id]/route';
import { POST as publishScoringRules } from './admin/scoring/publish/route';
import { POST as simulateScoring } from './admin/scoring/simulate/route';
import { POST as createTeam } from './teams/route';
import { PATCH as updateTeam } from './teams/[id]/route';
import { POST as createSeason } from './seasons/route';
import { POST as createPlayer } from './players/route';
import { PUT as updateAvailability } from './players/[id]/availability/route';
import { POST as addSubstitution, DELETE as deleteSubstitution } from './matches/[id]/substitutions/route';
import { PATCH as updateGameweek } from './gameweeks/[id]/route';
import { POST as setGameweekFlag, DELETE as removeGameweekFlag } from './gameweeks/[id]/flags/route';

const url = 'http://localhost/api/admin/test';
let authToken: string | undefined;
const request = (method: string) =>
  new NextRequest(url, {
    method,
    headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
    body: method === 'GET' ? undefined : '{}',
  });

const protectedHandlers: Array<[string, () => Promise<Response>]> = [
  ['failed jobs', () => getFailedJobs(request('GET'))],
  ['scoring-rule listing', () => getScoringRules(request('GET'))],
  ['scoring-version creation', () => createScoringVersion(request('POST'))],
  ['scoring-rule update', () => updateScoringRule(request('PATCH'), { params: Promise.resolve({ id: '1' }) })],
  ['scoring-rule publishing', () => publishScoringRules(request('POST'))],
  ['scoring simulation', () => simulateScoring(request('POST'))],
  ['team creation', () => createTeam(request('POST'))],
  ['team update', () => updateTeam(request('PATCH'), { params: Promise.resolve({ id: '1' }) })],
  ['season creation', () => createSeason(request('POST'))],
  ['player creation', () => createPlayer(request('POST'))],
  ['player availability update', () => updateAvailability(request('PUT'), { params: Promise.resolve({ id: '1' }) })],
  ['match substitution creation', () => addSubstitution(request('POST'), { params: Promise.resolve({ id: '1' }) })],
  ['match substitution deletion', () => deleteSubstitution(request('DELETE'), { params: Promise.resolve({ id: '1' }) })],
  ['gameweek update', () => updateGameweek(request('PATCH'), { params: Promise.resolve({ id: '1' }) })],
  ['gameweek flag creation', () => setGameweekFlag(request('POST'), { params: Promise.resolve({ id: '1' }) })],
  ['gameweek flag deletion', () => removeGameweekFlag(request('DELETE'), { params: Promise.resolve({ id: '1' }) })],
];

describe('admin API authorization', () => {
  beforeEach(() => {
    authToken = 'valid-token';
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetUser.mockReset().mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.test',
          user_metadata: { role: 'admin' },
          app_metadata: {},
        },
      },
      error: null,
    });
    mockMaybeSingle.mockReset().mockResolvedValue({ data: { role: 'user' }, error: null });
    mockFrom.mockReset();
    mockCreateClient.mockReset();
    mockSupabaseServer.mockReset().mockImplementation(() => ({
      auth: { getUser: mockGetUser },
      from: (table: string) => {
        mockFrom(table);
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: () => mockMaybeSingle(),
        };
        return query;
      },
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(protectedHandlers)('rejects unauthenticated access to %s', async (_name, handler) => {
    authToken = undefined;

    const response = await handler();

    expect(response.status).toBe(401);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it.each(protectedHandlers)('rejects non-admin access to %s', async (_name, handler) => {
    const response = await handler();

    expect(response.status).toBe(403);
    expect(mockFrom.mock.calls.map(([table]) => table)).toEqual(['users']);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('accepts an administrator whose profile role is admin', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null });

    await expect(verifyAdminAuth(request('GET'))).resolves.toBe('user-1');
  });
});
