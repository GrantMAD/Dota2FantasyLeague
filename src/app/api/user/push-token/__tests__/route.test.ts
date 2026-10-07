import { NextRequest } from 'next/server';
import { DELETE, POST } from '../route';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';

jest.mock('@/lib/auth-utils', () => ({
  verifyAuth: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: jest.fn(),
}));

function createRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/user/push-token', {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('push token API', () => {
  const select = jest.fn();
  const maybeSingle = jest.fn();
  const insert = jest.fn();
  const update = jest.fn();
  const eq = jest.fn();
  const remove = jest.fn();
  const table = { select, maybeSingle, insert, update, delete: remove, eq };
  const client = { from: jest.fn(() => table) };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(verifyAuth).mockResolvedValue({ userId: 'user-1' } as Awaited<ReturnType<typeof verifyAuth>>);
    jest.mocked(supabaseServer).mockReturnValue(client as unknown as ReturnType<typeof supabaseServer>);
    select.mockReturnValue(table);
    maybeSingle.mockResolvedValue({ data: null, error: null });
    insert.mockResolvedValue({ error: null });
    update.mockReturnValue(table);
    remove.mockReturnValue(table);
    eq.mockReturnValue(table);
    Object.defineProperty(table, 'then', {
      configurable: true,
      value: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(resolve, reject),
    });
  });

  it('rejects invalid Expo tokens before writing to the database', async () => {
    const response = await POST(createRequest('POST', {
      token: 'not-an-expo-token',
      platform: 'ios',
    }));

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('registers a token for the authenticated account without returning the token', async () => {
    const response = await POST(createRequest('POST', {
      token: 'ExponentPushToken[device-123]',
      platform: 'android',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ registered: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        expo_push_token: 'ExponentPushToken[device-123]',
        platform: 'android',
      }),
    );
  });

  it('does not allow a token to be claimed by a different account', async () => {
    maybeSingle.mockResolvedValue({ data: { user_id: 'another-user' }, error: null });
    const response = await POST(createRequest('POST', {
      token: 'ExponentPushToken[device-123]',
      platform: 'ios',
    }));

    expect(response.status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('refreshes timestamps for a token already owned by the authenticated account', async () => {
    maybeSingle.mockResolvedValue({ data: { user_id: 'user-1' }, error: null });
    const response = await POST(createRequest('POST', {
      token: 'ExponentPushToken[device-123]',
      platform: 'ios',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ registered: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'ios',
      updated_at: expect.any(String),
      last_seen_at: expect.any(String),
    }));
    expect(eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
    expect(eq).toHaveBeenNthCalledWith(3, 'expo_push_token', 'ExponentPushToken[device-123]');
  });

  it('only removes a token owned by the authenticated account', async () => {
    const response = await DELETE(createRequest('DELETE', {
      token: 'ExponentPushToken[device-123]',
    }));

    expect(response.status).toBe(200);
    expect(remove).toHaveBeenCalled();
    expect(eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(eq).toHaveBeenNthCalledWith(2, 'expo_push_token', 'ExponentPushToken[device-123]');
  });
});
