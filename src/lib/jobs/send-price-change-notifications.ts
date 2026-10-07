import { createClient } from '@supabase/supabase-js';
import { deliverPushNotifications, type PushNotificationCandidate } from '@/lib/push-notifications';

interface JobResult {
  success: boolean;
  priceChangesProcessed: number;
  notificationsGenerated: number;
  pushNotificationsSent: number;
  errors: string[];
  duration: number;
}

interface PriceChangeRecord {
  player_id: number;
  price: number;
  price_change: number;
  professional_players: { name: string | null } | { name: string | null }[] | null;
}

interface ActiveGameweekRecord {
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

  public async execute(): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: true,
      priceChangesProcessed: 0,
      notificationsGenerated: 0,
      pushNotificationsSent: 0,
      errors: [],
      duration: 0,
    };
    const pushCandidates: PushNotificationCandidate[] = [];

    try {
      // 1. Get the current active/upcoming gameweek ID (assuming prices update for upcoming)
      const { data: gameweekData, error: gwError } = await this.supabase
        .from('gameweeks')
        .select('id, season_id')
        .in('status', ['upcoming', 'active'])
        .order('start_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      const gameweek = gameweekData as ActiveGameweekRecord | null;

      if (gwError || !gameweek) {
        throw new Error(`Failed to fetch active gameweek: ${gwError?.message || 'None found'}`);
      }

      // 2. Find players whose price changed significantly this gameweek
      const { data: priceChanges, error: priceError } = await this.supabase
        .from('player_prices')
        .select('player_id, price, price_change, professional_players(name)')
        .eq('gameweek_id', gameweek.id)
        .neq('price_change', 0);

      if (priceError) throw priceError;

      if (!priceChanges || priceChanges.length === 0) {
        result.duration = Date.now() - startTime;
        return result;
      }

      // 3. For each price change, notify users who own the player
      for (const pc of priceChanges as unknown as PriceChangeRecord[]) {
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

          // Check if already notified for this player's price change in this gameweek
          const { data: existingNotif } = await this.supabase
            .from('user_notifications')
            .select('id')
            .eq('user_id', userId)
            .eq('type', 'price_change')
            .contains('metadata', { player_id: pc.player_id, gameweek_id: gameweek.id })
            .limit(1)
            .maybeSingle();

          if (existingNotif) continue;

          // Create notification
          const title = `${playerName} Price ${isRise ? 'Rise' : 'Fall'}!`;
          const message = `${playerName}'s price has ${isRise ? 'risen' : 'fallen'} by ${changeStr}m to $${pc.price}m.`;
          
          const notificationTable = this.supabase.from('user_notifications') as unknown as {
            insert(values: UserNotificationInsert): PromiseLike<{ error: { message: string } | null }>;
          };
          const { error: insertError } = await notificationTable.insert({
            user_id: userId,
            type: 'price_change',
            title,
            message,
            metadata: { player_id: pc.player_id, gameweek_id: gameweek.id, price_change: pc.price_change },
          });

          if (insertError) {
            result.errors.push(`Failed to insert notif for user ${userId}: ${insertError.message}`);
            continue;
          }

          result.notificationsGenerated++;
          pushCandidates.push({
            userId,
            type: 'price_change',
            metadata: { player_id: pc.player_id, gameweek_id: gameweek.id, price_change: pc.price_change },
          });
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

export async function sendPriceChangeNotifications(): Promise<JobResult> {
  const job = new SendPriceChangeNotifications();
  return await job.execute();
}
