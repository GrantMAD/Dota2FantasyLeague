import { deliverPushNotifications, type PushNotificationCandidate } from '@/lib/push-notifications';
import { getEquivalentProviderIds, getPlayerIdentityKeys } from './player-identity';

export interface LiveMatchNotificationCandidate {
  id: number;
  externalMatchId: string;
  playerAccountIds: string[];
}

interface ProfessionalPlayerRow {
  id: number;
  name: string;
  in_game_name: string | null;
  data_provider_id: string | null;
}

interface SquadMemberOwnerRow {
  player_id: number;
  fantasy_squads: {
    fantasy_seasons: { user_id: string | null } | { user_id: string | null }[] | null;
  } | { fantasy_seasons: { user_id: string | null } | { user_id: string | null }[] | null }[] | null;
}

interface LiveSquadNotificationInsert {
  user_id: string;
  type: 'live_squad_match';
  title: string;
  message: string;
  metadata: {
    match_id: number;
    external_match_id: string;
    player_ids: number[];
    player_names: string[];
  };
}

const QUERY_BATCH_SIZE = 500;

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function getUserId(row: SquadMemberOwnerRow): string | null {
  const squad = Array.isArray(row.fantasy_squads)
    ? row.fantasy_squads[0]
    : row.fantasy_squads;
  const season = Array.isArray(squad?.fantasy_seasons)
    ? squad.fantasy_seasons[0]
    : squad?.fantasy_seasons;
  return season?.user_id ?? null;
}

export async function notifyLiveSquadMembers(
  supabase: ReturnType<typeof import('@/lib/db/supabase-server').getSupabaseServerClient>,
  candidates: LiveMatchNotificationCandidate[],
): Promise<{ notificationsCreated: number; pushNotificationsSent: number; errors: string[] }> {
  const result = { notificationsCreated: 0, pushNotificationsSent: 0, errors: [] as string[] };
  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()];
  const providerIds = [...new Set(uniqueCandidates.flatMap((candidate) =>
    getEquivalentProviderIds(...candidate.playerAccountIds)
  ))];
  if (providerIds.length === 0) return result;

  const { data: rawPlayers, error: playerError } = await supabase
    .from('professional_players')
    .select('id, name, in_game_name, data_provider_id')
    .in('data_provider_id', providerIds);
  if (playerError) throw new Error(`Unable to resolve live match players: ${playerError.message}`);

  const players = (rawPlayers ?? []) as ProfessionalPlayerRow[];
  const playerIdsByMatch = new Map<number, Set<number>>();
  const playerNamesById = new Map<number, string>();
  const ownerLookupIds = new Set<number>();

  for (const candidate of uniqueCandidates) {
    const identities = new Set(candidate.playerAccountIds.flatMap((id) => getPlayerIdentityKeys(id)));
    const matchedPlayerIds = new Set<number>();
    for (const player of players) {
      if (!getPlayerIdentityKeys(player.data_provider_id).some((identity) => identities.has(identity))) continue;
      matchedPlayerIds.add(player.id);
      ownerLookupIds.add(player.id);
      playerNamesById.set(player.id, player.in_game_name?.trim() || player.name);
    }
    playerIdsByMatch.set(candidate.id, matchedPlayerIds);
  }

  if (ownerLookupIds.size === 0) return result;

  const { data: rawOwners, error: ownerError } = await supabase
    .from('fantasy_squad_members')
    .select('player_id, fantasy_squads(fantasy_seasons(user_id))')
    .in('player_id', [...ownerLookupIds])
    .is('removed_date', null);
  if (ownerError) throw new Error(`Unable to load owners of live match players: ${ownerError.message}`);

  const playerOwners = new Map<number, Set<string>>();
  const ownerRows = (rawOwners ?? []) as SquadMemberOwnerRow[];
  for (const owner of ownerRows) {
    const userId = getUserId(owner);
    if (!userId) continue;
    const owners = playerOwners.get(owner.player_id) ?? new Set<string>();
    owners.add(userId);
    playerOwners.set(owner.player_id, owners);
  }

  const allOwnerIds = [...new Set([...playerOwners.values()].flatMap((ids) => [...ids]))];
  if (allOwnerIds.length === 0) return result;

  const enabledUsers = new Set<string>();
  for (const batch of chunks(allOwnerIds, QUERY_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .in('id', batch)
      .eq('live_squad_match_notifications', true);
    if (error) throw new Error(`Unable to load live match notification preferences: ${error.message}`);
    for (const user of (data ?? []) as Array<{ id: string }>) enabledUsers.add(user.id);
  }
  if (enabledUsers.size === 0) return result;

  const pushCandidates: PushNotificationCandidate[] = [];
  for (const candidate of uniqueCandidates) {
    const namesByUser = new Map<string, Map<number, string>>();
    for (const playerId of playerIdsByMatch.get(candidate.id) ?? []) {
      const name = playerNamesById.get(playerId);
      if (!name) continue;
      for (const userId of playerOwners.get(playerId) ?? []) {
        if (!enabledUsers.has(userId)) continue;
        const names = namesByUser.get(userId) ?? new Map<number, string>();
        names.set(playerId, name);
        namesByUser.set(userId, names);
      }
    }
    if (namesByUser.size === 0) continue;

    const userIds = [...namesByUser.keys()];
    const alreadyNotified = new Set<string>();
    for (const batch of chunks(userIds, QUERY_BATCH_SIZE)) {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('user_id')
        .eq('type', 'live_squad_match')
        .eq('metadata->>match_id', String(candidate.id))
        .in('user_id', batch);
      if (error) throw new Error(`Unable to check for duplicate live match notifications: ${error.message}`);
      for (const notification of (data ?? []) as Array<{ user_id: string }>) {
        alreadyNotified.add(notification.user_id);
      }
    }

    const notifications: LiveSquadNotificationInsert[] = [];
    for (const [userId, playersById] of namesByUser) {
      if (alreadyNotified.has(userId)) continue;
      const playerIds = [...playersById.keys()];
      const playerNames = [...new Set(playersById.values())].sort((a, b) => a.localeCompare(b));
      const title = 'Your squad is in a live match';
      const message = `${playerNames.join(', ')} ${playerNames.length === 1 ? 'is' : 'are'} playing in a live match.`;
      notifications.push({
        user_id: userId,
        type: 'live_squad_match',
        title,
        message,
        metadata: {
          match_id: candidate.id,
          external_match_id: candidate.externalMatchId,
          player_ids: playerIds,
          player_names: playerNames,
        },
      });
    }

    for (const batch of chunks(notifications, QUERY_BATCH_SIZE)) {
      const { error } = await supabase.from('user_notifications').insert(batch);
      if (error) throw new Error(`Unable to create live squad match notifications: ${error.message}`);
      result.notificationsCreated += batch.length;
      pushCandidates.push(...batch.map((notification) => ({
        userId: notification.user_id,
        type: notification.type,
        metadata: notification.metadata,
        title: notification.title,
        body: notification.message,
      })));
    }
  }

  if (pushCandidates.length > 0) {
    const delivery = await deliverPushNotifications(supabase, pushCandidates);
    result.pushNotificationsSent = delivery.accepted;
    result.errors.push(...delivery.errors);
  }

  return result;
}
