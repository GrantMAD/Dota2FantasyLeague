import { createClient } from '@supabase/supabase-js';
import { deliverPushNotifications, type PushNotificationCandidate } from '@/lib/push-notifications';

export interface JobResult {
  success: boolean;
  unavailablePlayersFound: number;
  notificationsGenerated: number;
  pushNotificationsSent: number;
  errors: string[];
  duration: number;
}

interface UnavailablePlayer {
  id: number;
  name: string;
  in_game_name: string | null;
  availability_status: string;
}

interface OwnerRow {
  fantasy_squads: {
    fantasy_seasons: { user_id: string | null } | { user_id: string | null }[] | null;
  } | { fantasy_seasons: { user_id: string | null } | { user_id: string | null }[] | null }[] | null;
}

export class SendUnavailablePlayerNotifications {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  public async execute(): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: true,
      unavailablePlayersFound: 0,
      notificationsGenerated: 0,
      pushNotificationsSent: 0,
      errors: [],
      duration: 0,
    };
    const pushCandidates: PushNotificationCandidate[] = [];

    try {
      // 1. Get active gameweek to contextualize the alert
      const { data: gameweekData } = await this.supabase
        .from('gameweeks')
        .select('id, gameweek_number')
        .in('status', ['upcoming', 'active'])
        .order('start_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      const currentGwId = (gameweekData as { id?: number } | null)?.id ?? null;

      // 2. Query players that are marked inactive or unavailable
      const { data: unavailablePlayers, error: playersError } = await this.supabase
        .from('professional_players')
        .select('id, name, in_game_name, availability_status')
        .in('availability_status', ['inactive', 'unavailable', 'injured', 'benched']);

      if (playersError) {
        throw new Error(`Failed to fetch unavailable players: ${playersError.message}`);
      }

      if (!unavailablePlayers || unavailablePlayers.length === 0) {
        result.duration = Date.now() - startTime;
        return result;
      }

      result.unavailablePlayersFound = unavailablePlayers.length;

      // 3. For each unavailable player, find squads currently holding them
      for (const player of unavailablePlayers as UnavailablePlayer[]) {
        const playerName = player.in_game_name || player.name || `Player #${player.id}`;
        const statusLabel = player.availability_status || 'unavailable';

        const { data: owners, error: ownersError } = await this.supabase
          .from('fantasy_squad_members')
          .select('fantasy_squads(fantasy_season_id, fantasy_seasons(user_id))')
          .eq('player_id', player.id)
          .is('removed_date', null);

        if (ownersError || !owners) {
          result.errors.push(`Failed to fetch owners for unavailable player ${player.id}`);
          continue;
        }

        for (const ownerRow of owners as unknown as OwnerRow[]) {
          const joinedSquad = Array.isArray(ownerRow.fantasy_squads)
            ? ownerRow.fantasy_squads[0]
            : ownerRow.fantasy_squads;
          const joinedSeason = Array.isArray(joinedSquad?.fantasy_seasons)
            ? joinedSquad.fantasy_seasons[0]
            : joinedSquad?.fantasy_seasons;
          const userId = joinedSeason?.user_id;
          if (!userId) continue;

          // Prevent duplicate notification for this player / status / gameweek
          const { data: existingNotif } = await this.supabase
            .from('user_notifications')
            .select('id')
            .eq('user_id', userId)
            .eq('type', 'system')
            .contains('metadata', { player_id: player.id, status: statusLabel, gameweek_id: currentGwId })
            .limit(1)
            .maybeSingle();

          if (existingNotif) continue;

          const title = `Squad Alert: ${playerName} is ${statusLabel.toUpperCase()}`;
          const message = `${playerName} in your squad is currently ${statusLabel}. Make a transfer or adjust your starting lineup before the next gameweek deadline!`;

          const notificationTable = this.supabase.from('user_notifications') as unknown as {
            insert(values: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
          };

          const { error: insertError } = await notificationTable.insert({
            user_id: userId,
            type: 'system',
            title,
            message,
            metadata: {
              player_id: player.id,
              player_name: playerName,
              status: statusLabel,
              gameweek_id: currentGwId,
              action: 'swap_required',
            },
          });

          if (insertError) {
            result.errors.push(`Failed to insert unavailable alert for user ${userId}: ${insertError.message}`);
            continue;
          }

          result.notificationsGenerated++;
          pushCandidates.push({
            userId,
            type: 'system',
            metadata: {
              player_id: player.id,
              player_name: playerName,
              status: statusLabel,
              gameweek_id: currentGwId,
              action: 'swap_required',
            },
          });
        }
      }

      const delivery = await deliverPushNotifications(this.supabase, pushCandidates);
      result.pushNotificationsSent = delivery.accepted;
      result.errors.push(...delivery.errors);
      if (delivery.errors.length > 0) result.success = false;
    } catch (err: unknown) {
      result.success = false;
      result.errors.push(err instanceof Error ? err.message : 'Unknown error');
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function sendUnavailablePlayerNotifications(): Promise<JobResult> {
  const job = new SendUnavailablePlayerNotifications();
  return job.execute();
}
