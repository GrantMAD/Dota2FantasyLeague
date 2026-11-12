import { createClient } from '@supabase/supabase-js';
import { deliverPushNotifications, type PushNotificationCandidate } from '@/lib/push-notifications';

interface JobResult {
  success: boolean;
  priceChangesProcessed: number;
  notificationsGenerated: number;
  pushNotificationsSent: number;
  errors: string[];
  duration: number;
  hasMore?: boolean;
}

interface PriceChangeRecord {
  player_id: number;
  price: number;
  price_change: number;
  professional_players: { name: string | null } | { name: string | null }[] | null;
}

interface ClosedGameweekRecord {
  id: number;
  season_id: number;
}

interface UserNotificationInsert {
  user_id: string;
  type: 'price_change';
  title: string;
  message: string;
  metadata: { player_id: number; gameweek_id: number; price_change: number };
}

interface OwnerRow {
  fantasy_squads: {
    fantasy_seasons: { user_id: string | null } | { user_id: string | null }[] | null;
  } | { fantasy_seasons: { user_id: string | null } | { user_id: string | null }[] | null }[] | null;
}

class SendPriceChangeNotifications {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  public async execute(options: { playerLimit?: number } = {}): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: true,
      priceChangesProcessed: 0,
      notificationsGenerated: 0,
      pushNotificationsSent: 0,
      errors: [],
      duration: 0,
      hasMore: false,
    };
    const pushCandidates: PushNotificationCandidate[] = [];

    try {
      // Price updates are written against the latest closed gameweek.
      const { data: seasonData, error: seasonError } = await this.supabase
        .from('seasons')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (seasonError) throw new Error(`Failed to fetch pricing season: ${seasonError.message}`);
      const seasonId = Number((seasonData as { id: number } | null)?.id);
      if (!Number.isInteger(seasonId)) {
        throw new Error('No season is available for price notifications.');
      }

      const { data: gameweekData, error: gwError } = await this.supabase
        .from('gameweeks')
        .select('id, season_id')
        .eq('season_id', seasonId)
        .eq('status', 'closed')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      const gameweek = gameweekData as ClosedGameweekRecord | null;

      if (gwError) {
        throw new Error(`Failed to fetch latest closed gameweek: ${gwError.message}`);
      }
      if (!gameweek) {
        result.duration = Date.now() - startTime;
        return result;
      }

      // Find players whose prices changed after the latest completed gameweek.
      const { data: priceChanges, error: priceError } = await this.supabase
        .from('player_prices')
        .select('player_id, price, price_change, professional_players(name)')
        .eq('season_id', gameweek.season_id)
        .eq('gameweek_id', gameweek.id)
        .neq('price_change', 0);

      if (priceError) throw priceError;

      if (!priceChanges || priceChanges.length === 0) {
        result.duration = Date.now() - startTime;
        return result;
      }

      // Apply playerLimit for chunked execution within Vercel's limits (default 15)
      const playerLimit = options.playerLimit ?? 15;
      let changesToProcess = priceChanges as unknown as PriceChangeRecord[];
      if (priceChanges.length > playerLimit) {
        changesToProcess = changesToProcess.slice(0, playerLimit);
        result.hasMore = true;
        console.log(
          `[sendPriceChangeNotifications] playerLimit=${playerLimit}: processing ${changesToProcess.length} of ${priceChanges.length} price changes`
        );
      }

      // Pre-fetch all price_change notifications for this gameweek in ONE query
      const { data: rawExistingNotifs } = await this.supabase
        .from('user_notifications')
        .select('user_id, metadata')
        .eq('type', 'price_change');

      const notifiedUsers = new Set<string>();
      (rawExistingNotifs ?? []).forEach((n: { user_id: string; metadata?: { player_id?: number; gameweek_id?: number } | null }) => {
        const meta = n.metadata;
        if (meta && meta.player_id && meta.gameweek_id === gameweek.id) {
          notifiedUsers.add(`${n.user_id}_${meta.player_id}_${gameweek.id}`);
        }
      });

      const notificationsToInsert: UserNotificationInsert[] = [];

      // 3. For each price change, notify users who own the player
      for (const pc of changesToProcess) {
        result.priceChangesProcessed++;
        
        const joinedPlayer = Array.isArray(pc.professional_players)
          ? pc.professional_players[0]
          : pc.professional_players;
        const playerName = joinedPlayer?.name || `Player ${pc.player_id}`;
        const isRise = pc.price_change > 0;
        const changeStr = (isRise ? '+' : '') + pc.price_change.toFixed(2);
        
        // Find users owning this player
        const { data: owners, error: ownersError } = await this.supabase
          .from('fantasy_squad_members')
          .select('fantasy_squads(fantasy_season_id, fantasy_seasons(user_id))')
          .eq('player_id', pc.player_id)
          .is('removed_date', null);

        if (ownersError || !owners) {
          result.errors.push(`Failed to fetch owners for player ${pc.player_id}`);
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

          const notifKey = `${userId}_${pc.player_id}_${gameweek.id}`;
          if (notifiedUsers.has(notifKey)) continue;
          notifiedUsers.add(notifKey);

          // Queue notification for batch insert
          const title = `${playerName} Price ${isRise ? 'Rise' : 'Fall'}!`;
          const message = `${playerName}'s price has ${isRise ? 'risen' : 'fallen'} by ${changeStr}m to $${pc.price}m.`;
          
          notificationsToInsert.push({
            user_id: userId,
            type: 'price_change',
            title,
            message,
            metadata: { player_id: pc.player_id, gameweek_id: gameweek.id, price_change: pc.price_change },
          });

          pushCandidates.push({
            userId,
            type: 'price_change',
            metadata: { player_id: pc.player_id, gameweek_id: gameweek.id, price_change: pc.price_change },
          });
        }
      }

      // Insert notifications
      for (const notif of notificationsToInsert) {
        const notificationTable = this.supabase.from('user_notifications') as unknown as {
          insert(values: UserNotificationInsert): PromiseLike<{ error: { message: string } | null }>;
        };
        const { error: insertError } = await notificationTable.insert(notif);
        if (insertError) {
          result.errors.push(`Failed to insert notif for user ${notif.user_id}: ${insertError.message}`);
        } else {
          result.notificationsGenerated++;
        }
      }

      const delivery = await deliverPushNotifications(this.supabase, pushCandidates);
      result.pushNotificationsSent = delivery.accepted;
      result.errors.push(...delivery.errors);
      if (delivery.errors.length > 0) result.success = false;
    } catch (error: unknown) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function sendPriceChangeNotifications(
  options: { playerLimit?: number } = {}
): Promise<JobResult> {
  const job = new SendPriceChangeNotifications();
  return await job.execute(options);
}
