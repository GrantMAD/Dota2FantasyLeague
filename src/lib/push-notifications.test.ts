import { createClient } from '@supabase/supabase-js';
import {
  deliverPushNotifications,
  isExpoPushToken,
  processExpoPushReceipts,
  pushRouteForNotification,
} from './push-notifications';

function createQuery(result: { data?: unknown; error: { message: string } | null }) {
  const query: {
    select: jest.Mock;
    in: jest.Mock;
    delete: jest.Mock;
    upsert: jest.Mock;
    lt: jest.Mock;
    order: jest.Mock;
    limit: jest.Mock;
    then: (
      onfulfilled?: ((value: unknown) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null,
    ) => Promise<unknown>;
  } = {} as {
    select: jest.Mock;
    in: jest.Mock;
    delete: jest.Mock;
    upsert: jest.Mock;
    lt: jest.Mock;
    order: jest.Mock;
    limit: jest.Mock;
    then: (
      onfulfilled?: ((value: unknown) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null,
    ) => Promise<unknown>;
  };
  const chain = () => query;
  query.select = jest.fn(chain);
  query.in = jest.fn(chain);
  query.delete = jest.fn(chain);
  query.upsert = jest.fn(() => Promise.resolve(result));
  query.lt = jest.fn(chain);
  query.order = jest.fn(chain);
  query.limit = jest.fn(chain);
  query.then = (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected);
  return query;
}

function createSupabase(results: Record<string, { data?: unknown; error: { message: string } | null }>) {
  const queries = new Map<string, ReturnType<typeof createQuery>>();
  const from = jest.fn((table: string) => {
    const query = createQuery(results[table] ?? { data: null, error: null });
    queries.set(table, query);
    return query;
  });
  return {
    client: { from } as unknown as ReturnType<typeof createClient>,
    from,
    queries,
  };
}

function expoResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => payload,
  } as Response;
}

describe('push notification delivery', () => {
  afterEach(() => jest.restoreAllMocks());

  it('validates Expo tokens and maps notification metadata to safe app routes', () => {
    expect(isExpoPushToken('ExponentPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('https://example.test')).toBe(false);
    expect(pushRouteForNotification('price_change', { player_id: '8' })).toBe('/player/8');
    expect(pushRouteForNotification('rank_update', { gameweek_id: 12 })).toBe('/gameweek/12');
    expect(pushRouteForNotification('unknown', { league_id: -1 })).toBe('/notifications');
  });

  it('sends generic payloads only to enabled users and queues Expo receipts', async () => {
    const token = 'ExponentPushToken[device-123]';
    const { client, queries } = createSupabase({
      users: { data: [{ id: 'user-1', push_notifications: true }], error: null },
      user_push_tokens: {
        data: [{ user_id: 'user-1', expo_push_token: token }],
        error: null,
      },
      push_notification_receipts: { data: null, error: null },
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      expoResponse({ data: [{ status: 'ok', id: 'receipt-1' }] }),
    );

    const result = await deliverPushNotifications(client, [{
      userId: 'user-1',
      type: 'rank_update',
      metadata: { gameweek_id: 12, rank: 1 },
    }]);

    expect(result).toEqual({ accepted: 1, errors: [] });
    const requestBody = JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body)) as {
      body: string;
      data: { route: string };
      title: string;
    }[];
    expect(requestBody[0]).toMatchObject({
      title: 'Fantasy Dota 2',
      body: 'You have a new fantasy update.',
      data: { route: '/gameweek/12' },
    });
    expect(JSON.stringify(requestBody)).not.toContain('rank');
    expect(queries.get('push_notification_receipts')?.upsert).toHaveBeenCalledWith(
      [{ receipt_id: 'receipt-1', expo_push_token: token }],
      { onConflict: 'receipt_id', ignoreDuplicates: true },
    );
  });

  it('does not contact Expo when the account preference is disabled', async () => {
    const { client } = createSupabase({
      users: { data: [{ id: 'user-1', push_notifications: false }], error: null },
      user_push_tokens: { data: [], error: null },
    });
    const fetch = jest.spyOn(globalThis, 'fetch');

    await expect(deliverPushNotifications(client, [{
      userId: 'user-1',
      type: 'league_invite',
      metadata: { league_id: 3 },
    }])).resolves.toEqual({ accepted: 0, errors: [] });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('removes device tokens reported as permanently unregistered', async () => {
    const token = 'ExponentPushToken[device-123]';
    const { client, queries } = createSupabase({
      users: { data: [{ id: 'user-1', push_notifications: true }], error: null },
      user_push_tokens: { data: [{ user_id: 'user-1', expo_push_token: token }], error: null },
      push_notification_receipts: { data: null, error: null },
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      expoResponse({
        data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
      }),
    );

    const result = await deliverPushNotifications(client, [{
      userId: 'user-1',
      type: 'system',
      metadata: null,
    }]);

    expect(result.errors).toEqual([]);
    expect(queries.get('user_push_tokens')?.delete).toHaveBeenCalled();
    expect(queries.get('user_push_tokens')?.in).toHaveBeenCalledWith('expo_push_token', [token]);
  });

  it('removes tokens reported invalid by delivery receipts', async () => {
    const token = 'ExponentPushToken[device-123]';
    const { client, queries } = createSupabase({
      push_notification_receipts: {
        data: [{ receipt_id: 'receipt-1', expo_push_token: token }],
        error: null,
      },
      user_push_tokens: { data: null, error: null },
    });
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      expoResponse({
        data: {
          'receipt-1': { status: 'error', details: { error: 'DeviceNotRegistered' } },
        },
      }),
    );

    const result = await processExpoPushReceipts(client, new Date('2026-10-07T12:00:00.000Z'));

    expect(result).toMatchObject({ receiptsProcessed: 1, invalidTokensRemoved: 1, errors: [] });
    expect(queries.get('user_push_tokens')?.in).toHaveBeenCalledWith('expo_push_token', [token]);
    expect(queries.get('push_notification_receipts')?.in).toHaveBeenCalledWith('receipt_id', ['receipt-1']);
  });
});
