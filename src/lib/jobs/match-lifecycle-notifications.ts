import { deliverPushNotifications, type PushNotificationCandidate } from '@/lib/push-notifications';

export interface MatchLifecycleNotificationCandidate {
  id: number;
  externalMatchId: string;
  playerIds: number[];
}

export interface MatchLifecyclePlayerStat {
  match_id: number;
  player_id: number;
}

export interface MatchLifecycleSubstitution {
  match_id: number;
  rostered_player_id: number;
  stand_in_player_id: number;
}

type MatchNotificationType =
  | 'live_squad_match'
  | 'match_finished'
  | 'match_data_processed'
  | 'fantasy_points_calculated';

type MatchNotificationPreference =
  | 'live_squad_match_notifications'
  | 'match_data_processed_notifications'
  | 'fantasy_points_calculated_notifications';

export type MatchLifecycleMilestone = 'starting' | 'finished' | 'data_processed' | 'fantasy_points_calculated';

interface ProfessionalPlayerRow {
  id: number;
  name: string;
  in_game_name: string | null;
}

interface SquadMemberOwnerRow {
  player_id: number;
  fantasy_squads: {
    fantasy_seasons: { user_id: string | null } | { user_id: string | null }[] | null;
  } | { fantasy_seasons: { user_id: string | null } | { user_id: string | null }[] | null }[] | null;
}

interface UserPreferenceRow {
  id: string;
  live_squad_match_notifications?: boolean;
  match_data_processed_notifications?: boolean;
  fantasy_points_calculated_notifications?: boolean;
}

interface MatchNotificationInsert {
  user_id: string;
  type: MatchNotificationType;
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

const MILESTONE_CONFIGURATION: Record<
  MatchLifecycleMilestone,
  { type: MatchNotificationType; preference: MatchNotificationPreference; title: string }
> = {
  starting: {
    type: 'live_squad_match',
    preference: 'live_squad_match_notifications',
    title: 'Your squad is in a live match',
  },
  finished: {
    type: 'match_finished',
    preference: 'live_squad_match_notifications',
    title: 'Your squad match has finished',
  },
  data_processed: {
    type: 'match_data_processed',
    preference: 'match_data_processed_notifications',
    title: 'Match data has been processed',
  },
  fantasy_points_calculated: {
    type: 'fantasy_points_calculated',
    preference: 'fantasy_points_calculated_notifications',
    title: 'Fantasy points have been calculated',
  },
};

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export function getMatchLifecyclePlayerIds(
  matchId: number,
  stats: MatchLifecyclePlayerStat[],
  substitutions: MatchLifecycleSubstitution[] = [],
): number[] {
  const playerIds = new Set(
    stats.filter((stat) => stat.match_id === matchId).map((stat) => stat.player_id)
  );
  for (const substitution of substitutions) {
    if (substitution.match_id === matchId && playerIds.has(substitution.stand_in_player_id)) {
      playerIds.add(substitution.rostered_player_id);
    }
  }
  return [...playerIds];
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

function messageFor(milestone: MatchLifecycleMilestone, playerNames: string[]): string {
  const names = playerNames.join(', ');
  const verb = playerNames.length === 1;
  switch (milestone) {
    case 'starting':
      return `${names} ${verb ? 'is' : 'are'} playing in a live match.`;
    case 'finished':
      return `${names} ${verb ? 'has' : 'have'} finished a match.`;
    case 'data_processed':
      return `Player data for ${names} ${verb ? 'has' : 'have'} been processed.`;
    case 'fantasy_points_calculated':
      return `Fantasy points for ${names} have been calculated.`;
  }
}

export async function notifyMatchLifecycleMilestone(
  supabase: ReturnType<typeof import('@/lib/db/supabase-server').getSupabaseServerClient>,
  candidates: MatchLifecycleNotificationCandidate[],
  milestone: MatchLifecycleMilestone,
): Promise<{ notificationsCreated: number; pushNotificationsSent: number; errors: string[] }> {
  const result = { notificationsCreated: 0, pushNotificationsSent: 0, errors: [] as string[] };
  const uniqueCandidates = [...new Map(candidates.map((candidate) => [
    candidate.id,
    { ...candidate, playerIds: [...new Set(candidate.playerIds)] },
  ])).values()];
  const playerIds = [...new Set(uniqueCandidates.flatMap((candidate) => candidate.playerIds))];
  const { data: rawPlayers, error: playerError } = playerIds.length > 0
    ? await supabase
      .from('professional_players')
      .select('id, name, in_game_name')
      .in('id', playerIds)
    : { data: [], error: null };
  if (playerError) throw new Error(`Unable to resolve match notification players: ${playerError.message}`);

  const players = (rawPlayers ?? []) as ProfessionalPlayerRow[];
  const validPlayerIds = new Set(players.map((player) => player.id));
  const playerNamesById = new Map(players.map((player) => [
    player.id,
    player.in_game_name?.trim() || player.name,
  ]));
  const ownerLookupIds = playerIds.filter((id) => validPlayerIds.has(id));
  const { data: rawOwners, error: ownerError } = ownerLookupIds.length > 0
    ? await supabase
      .from('fantasy_squad_members')
      .select('player_id, fantasy_squads(fantasy_seasons(user_id))')
      .in('player_id', ownerLookupIds)
      .is('removed_date', null)
    : { data: [], error: null };
  if (ownerError) throw new Error(`Unable to load owners of match players: ${ownerError.message}`);

  const playerOwners = new Map<number, Set<string>>();
  for (const owner of (rawOwners ?? []) as SquadMemberOwnerRow[]) {
    const userId = getUserId(owner);
    if (!userId) continue;
    const owners = playerOwners.get(owner.player_id) ?? new Set<string>();
    owners.add(userId);
    playerOwners.set(owner.player_id, owners);
  }

  const allOwnerIds = [...new Set([...playerOwners.values()].flatMap((ids) => [...ids]))];

  const configuration = MILESTONE_CONFIGURATION[milestone];
  const enabledUsers = new Set<string>();
  for (const batch of chunks(allOwnerIds, QUERY_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('users')
      .select(`id, ${configuration.preference}`)
      .in('id', batch)
      .eq(configuration.preference, true);
    if (error) {
      throw new Error(`Unable to load ${milestone} match notification preferences: ${error.message}`);
    }
    for (const user of (data ?? []) as UserPreferenceRow[]) {
      if (user[configuration.preference] === true) enabledUsers.add(user.id);
    }
  }

  const pushCandidates: PushNotificationCandidate[] = [];
  for (const candidate of uniqueCandidates) {
    const namesByUser = new Map<string, Map<number, string>>();
    for (const playerId of candidate.playerIds) {
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
    const existingRecipients = new Set<string>();
    for (const batch of chunks(userIds, QUERY_BATCH_SIZE)) {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('user_id')
        .eq('type', configuration.type)
        .eq('metadata->>match_id', String(candidate.id))
        .in('user_id', batch);
      if (error) {
        throw new Error(`Unable to check for duplicate ${milestone} match notifications: ${error.message}`);
      }
      for (const notification of (data ?? []) as Array<{ user_id: string }>) {
        existingRecipients.add(notification.user_id);
      }
    }

    const notifications: MatchNotificationInsert[] = [];
    for (const [userId, playersById] of namesByUser) {
      if (existingRecipients.has(userId)) continue;
      const names = [...new Set(playersById.values())].sort((a, b) => a.localeCompare(b));
      notifications.push({
        user_id: userId,
        type: configuration.type,
        title: configuration.title,
        message: messageFor(milestone, names),
        metadata: {
          match_id: candidate.id,
          external_match_id: candidate.externalMatchId,
          player_ids: [...playersById.keys()],
          player_names: names,
        },
      });
    }

    for (const batch of chunks(notifications, QUERY_BATCH_SIZE)) {
      const { error } = await supabase.from('user_notifications').insert(batch);
      if (error) {
        throw new Error(`Unable to create ${milestone} match notifications: ${error.message}`);
      }
      result.notificationsCreated += batch.length;
      for (const notification of batch) {
        pushCandidates.push({
          userId: notification.user_id,
          type: notification.type,
          metadata: notification.metadata,
          title: notification.title,
          body: notification.message,
        });
      }
    }

  }

  if (milestone === 'finished') {
    for (const candidate of uniqueCandidates) {
      const { data: finishedNotifications, error: finishedError } = await supabase
        .from('user_notifications')
        .select('user_id')
        .eq('type', 'match_finished')
        .eq('metadata->>match_id', String(candidate.id));
      if (finishedError) {
        throw new Error(`Unable to find persisted match-finished notifications for match ${candidate.id}: ${finishedError.message}`);
      }

      const recipients = [...new Set(
        ((finishedNotifications ?? []) as Array<{ user_id: string }>).map((notification) => notification.user_id)
      )];
      for (const userId of recipients) {
        const { error } = await supabase
          .from('user_notifications')
          .delete()
          .eq('user_id', userId)
          .eq('type', 'live_squad_match')
          .eq('metadata->>match_id', String(candidate.id))
          .eq('is_read', false);
        if (error) {
          throw new Error(`Unable to clear unread match-start notification for user ${userId}: ${error.message}`);
        }
      }
    }
  }

  if (pushCandidates.length > 0) {
    const delivery = await deliverPushNotifications(supabase, pushCandidates);
    result.pushNotificationsSent = delivery.accepted;
    result.errors.push(...delivery.errors);
  }

  return result;
}
