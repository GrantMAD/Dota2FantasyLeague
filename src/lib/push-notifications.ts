import { createClient } from '@supabase/supabase-js';

// The shared client has no generated Supabase table types for the push migration yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceSupabaseClient = ReturnType<typeof createClient<any>>;

export interface PushNotificationCandidate {
  userId: string;
  type: string;
  metadata: Record<string, unknown> | null;
}

export interface PushDeliveryResult {
  accepted: number;
  errors: string[];
}

export interface PushReceiptResult {
  receiptsProcessed: number;
  invalidTokensRemoved: number;
  errors: string[];
}

interface PushMessage {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: { route: string };
  priority: 'high';
  channelId: 'default';
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const expoPushTokenPattern = /^(Expo|Exponent)PushToken\[[^\]]+\]$/;
const expoApiUrl = 'https://exp.host/--/api/v2/push';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveMetadataId(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? String(id) : null;
}

export function isExpoPushToken(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 500 && expoPushTokenPattern.test(value);
}

export function pushRouteForNotification(
  type: string,
  metadata: Record<string, unknown> | null,
): string {
  const matchId = positiveMetadataId(metadata, 'match_id');
  if (matchId) return `/match/${matchId}`;

  const tournamentId = positiveMetadataId(metadata, 'tournament_id');
  if (tournamentId) return `/tournament/${tournamentId}`;

  if (['deadline', 'deadline_reminder', 'gameweek_deadline', 'lineup_deadline'].includes(type)) {
    return '/team';
  }

  if (['price_change', 'transfer_market', 'wildcard_used'].includes(type)) {
    const playerId = positiveMetadataId(metadata, 'player_id');
    return playerId ? `/player/${playerId}` : '/squad-planner';
  }

  if (['score_posted', 'gameweek_result', 'rank_movement', 'rank_update'].includes(type)) {
    const gameweekId = positiveMetadataId(metadata, 'gameweek_id');
    return gameweekId ? `/gameweek/${gameweekId}` : '/gameweeks';
  }

  if (['league_activity', 'league_result', 'h2h_result', 'league_invite'].includes(type)) {
    const leagueId = positiveMetadataId(metadata, 'league_id');
    return leagueId ? `/league/${leagueId}` : '/leagues';
  }

  const leagueId = positiveMetadataId(metadata, 'league_id');
  if (leagueId) return `/league/${leagueId}`;
  const gameweekId = positiveMetadataId(metadata, 'gameweek_id');
  if (gameweekId) return `/gameweek/${gameweekId}`;
  const playerId = positiveMetadataId(metadata, 'player_id');
  if (playerId) return `/player/${playerId}`;
  return '/notifications';
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function postToExpo<T>(path: 'send' | 'getReceipts', payload: unknown): Promise<T> {
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const url = `${expoApiUrl}/${path}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch (error: unknown) {
      if (attempt === 2) {
        const reason = error instanceof Error ? error.message : 'network error';
        throw new Error(`Expo Push API request failed after retries: ${reason}`);
      }
      await wait(250 * (attempt + 1));
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt === 2) {
        throw new Error(`Expo Push API returned a retryable HTTP ${response.status} response.`);
      }
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 5_000)
        : 250 * (attempt + 1);
      await wait(delay);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Expo Push API returned HTTP ${response.status}.`);
    }

    try {
      return await response.json() as T;
    } catch {
      throw new Error('Expo Push API returned an invalid JSON response.');
    }
  }

  throw new Error('Expo Push API request failed after retries.');
}

async function removeTokens(
  supabase: ServiceSupabaseClient,
  tokens: string[],
): Promise<void> {
  for (let index = 0; index < tokens.length; index += 500) {
    const batch = tokens.slice(index, index + 500);
    const { error } = await supabase
      .from('user_push_tokens')
      .delete()
      .in('expo_push_token', batch);
    if (error) throw new Error(`Unable to remove invalid push tokens: ${error.message}`);
  }
}

async function deleteReceipts(
  supabase: ServiceSupabaseClient,
  receiptIds: string[],
): Promise<void> {
  for (let index = 0; index < receiptIds.length; index += 500) {
    const batch = receiptIds.slice(index, index + 500);
    const { error } = await supabase
      .from('push_notification_receipts')
      .delete()
      .in('receipt_id', batch);
    if (error) throw new Error(`Unable to clear processed push receipts: ${error.message}`);
  }
}

export async function deliverPushNotifications(
  supabase: ServiceSupabaseClient,
  candidates: PushNotificationCandidate[],
): Promise<PushDeliveryResult> {
  const result: PushDeliveryResult = { accepted: 0, errors: [] };
  if (candidates.length === 0) return result;

  const userIds = [...new Set(candidates.map((candidate) => candidate.userId))];
  const enabledUsers = new Set<string>();
  for (let index = 0; index < userIds.length; index += 500) {
    const { data, error } = await supabase
      .from('users')
      .select('id, push_notifications')
      .in('id', userIds.slice(index, index + 500));
    if (error) throw new Error(`Unable to load push preferences: ${error.message}`);
    for (const row of (data ?? []) as { id: string; push_notifications: boolean | null }[]) {
      if (row.push_notifications === true) enabledUsers.add(row.id);
    }
  }

  if (enabledUsers.size === 0) return result;

  const tokenRows: { user_id: string; expo_push_token: string }[] = [];
  const enabledUserIds = [...enabledUsers];
  for (let index = 0; index < enabledUserIds.length; index += 500) {
    const { data, error } = await supabase
      .from('user_push_tokens')
      .select('user_id, expo_push_token')
      .in('user_id', enabledUserIds.slice(index, index + 500));
    if (error) throw new Error(`Unable to load registered push devices: ${error.message}`);
    tokenRows.push(...((data ?? []) as { user_id: string; expo_push_token: string }[]));
  }

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokenRows) {
    if (!isExpoPushToken(row.expo_push_token)) {
      result.errors.push('A stored push token has an invalid format.');
      continue;
    }
    const tokens = tokensByUser.get(row.user_id) ?? [];
    tokens.push(row.expo_push_token);
    tokensByUser.set(row.user_id, tokens);
  }

  const messages: PushMessage[] = [];
  for (const candidate of candidates) {
    if (!enabledUsers.has(candidate.userId)) continue;
    for (const token of tokensByUser.get(candidate.userId) ?? []) {
      messages.push({
        to: token,
        sound: 'default',
        title: 'Fantasy Dota 2',
        body: 'You have a new fantasy update.',
        data: { route: pushRouteForNotification(candidate.type, candidate.metadata) },
        priority: 'high',
        channelId: 'default',
      });
    }
  }

  const invalidTokens = new Set<string>();
  const receipts: { receipt_id: string; expo_push_token: string }[] = [];
  for (let index = 0; index < messages.length; index += 100) {
    const batch = messages.slice(index, index + 100);
    try {
      const response = await postToExpo<{ data?: unknown }>('send', batch);
      if (!isRecord(response) || !Array.isArray(response.data) || response.data.length !== batch.length) {
        result.errors.push('Expo returned an unexpected push ticket response.');
        continue;
      }

      for (let ticketIndex = 0; ticketIndex < response.data.length; ticketIndex++) {
        const ticket = response.data[ticketIndex] as ExpoTicket;
        const message = batch[ticketIndex];
        if (!isRecord(ticket) || (ticket.status !== 'ok' && ticket.status !== 'error')) {
          result.errors.push('Expo returned a malformed push ticket.');
          continue;
        }
        if (ticket.status === 'ok') {
          result.accepted++;
          if (typeof ticket.id === 'string' && ticket.id.length > 0) {
            receipts.push({ receipt_id: ticket.id, expo_push_token: message.to });
          } else {
            result.errors.push('Expo accepted a push without returning a receipt ID.');
          }
        } else if (ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.add(message.to);
        } else {
          result.errors.push(`Expo rejected a push${ticket.details?.error ? ` (${ticket.details.error})` : ''}.`);
        }
      }
    } catch (error: unknown) {
      result.errors.push(error instanceof Error ? error.message : 'Unable to send push notifications through Expo.');
    }
  }

  if (invalidTokens.size > 0) {
    try {
      await removeTokens(supabase, [...invalidTokens]);
    } catch (error: unknown) {
      result.errors.push(error instanceof Error ? error.message : 'Unable to remove invalid push tokens.');
    }
  }

  for (let index = 0; index < receipts.length; index += 500) {
    const { error } = await supabase
      .from('push_notification_receipts')
      .upsert(receipts.slice(index, index + 500), { onConflict: 'receipt_id', ignoreDuplicates: true });
    if (error) result.errors.push('Expo accepted pushes, but their delivery receipts could not be queued.');
  }

  return result;
}

export async function processExpoPushReceipts(
  supabase: ServiceSupabaseClient,
  now = new Date(),
): Promise<PushReceiptResult> {
  const result: PushReceiptResult = { receiptsProcessed: 0, invalidTokensRemoved: 0, errors: [] };
  const cutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('push_notification_receipts')
    .select('receipt_id, expo_push_token')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(1000);
  if (error) throw new Error(`Unable to load pending push receipts: ${error.message}`);

  const pending = (data ?? []) as { receipt_id: string; expo_push_token: string }[];
  for (let index = 0; index < pending.length; index += 1000) {
    const batch = pending.slice(index, index + 1000);
    let response: { data?: unknown };
    try {
      response = await postToExpo('getReceipts', { ids: batch.map((receipt) => receipt.receipt_id) });
    } catch (receiptError: unknown) {
      result.errors.push(receiptError instanceof Error ? receiptError.message : 'Unable to retrieve Expo push receipts.');
      continue;
    }

    if (!isRecord(response) || !isRecord(response.data)) {
      result.errors.push('Expo returned an unexpected push receipt response.');
      continue;
    }

    const receiptById = new Map(batch.map((receipt) => [receipt.receipt_id, receipt]));
    const receiptIdsToDelete: string[] = [];
    const invalidTokenReceipts = new Map<string, string[]>();

    for (const [receiptId, value] of Object.entries(response.data)) {
      const pendingReceipt = receiptById.get(receiptId);
      if (!pendingReceipt || !isRecord(value) || (value.status !== 'ok' && value.status !== 'error')) continue;

      if (value.status === 'error' && isRecord(value.details) && value.details.error === 'DeviceNotRegistered') {
        const receiptIds = invalidTokenReceipts.get(pendingReceipt.expo_push_token) ?? [];
        receiptIds.push(receiptId);
        invalidTokenReceipts.set(pendingReceipt.expo_push_token, receiptIds);
      } else {
        receiptIdsToDelete.push(receiptId);
        if (value.status === 'error') {
          const code = isRecord(value.details) && typeof value.details.error === 'string'
            ? value.details.error
            : 'unknown';
          result.errors.push(`Expo reported a push delivery error (${code}).`);
        }
      }
    }

    const removedTokens: string[] = [];
    for (const [token, receiptIds] of invalidTokenReceipts) {
      try {
        await removeTokens(supabase, [token]);
        removedTokens.push(token);
        receiptIdsToDelete.push(...receiptIds);
      } catch (removeError: unknown) {
        result.errors.push(removeError instanceof Error ? removeError.message : 'Unable to remove an invalid push token.');
      }
    }

    try {
      await deleteReceipts(supabase, receiptIdsToDelete);
      result.receiptsProcessed += receiptIdsToDelete.length;
      result.invalidTokensRemoved += removedTokens.length;
    } catch (deleteError: unknown) {
      result.errors.push(deleteError instanceof Error ? deleteError.message : 'Unable to clear processed push receipts.');
    }
  }

  return result;
}
