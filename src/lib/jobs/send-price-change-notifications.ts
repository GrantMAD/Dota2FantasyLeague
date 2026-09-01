import { createClient } from '@supabase/supabase-js';

interface JobResult {
  success: boolean;
  priceChangesProcessed: number;
  notificationsGenerated: number;
  pushNotificationsSent: number;
  errors: string[];
  duration: number;
}

class SendPriceChangeNotifications {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  private async dispatchWebPush(subscription: any, payload: any) {
    console.log(`[PUSH NOTIFICATION] Sending to ${subscription.endpoint}: ${payload.title}`);
    return true;
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

    try {
      // 1. Get the current active/upcoming gameweek ID (assuming prices update for upcoming)
      const { data: gameweek, error: gwError } = await this.supabase
        .from('gameweeks')
        .select('id, season_id')
        .in('status', ['upcoming', 'active'])
        .order('start_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (gwError || !gameweek) {
        throw new Error(`Failed to fetch active gameweek: ${gwError?.message || 'None found'}`);
      }

      // 2. Find players whose price changed significantly this gameweek
      const { data: priceChanges, error: priceError } = await this.supabase
        .from('player_prices')
        .select('player_id, price, price_change, professional_players(name)')
        .eq('gameweek_id', (gameweek as any).id)
        .neq('price_change', 0);

      if (priceError) throw priceError;

      if (!priceChanges || priceChanges.length === 0) {
        result.duration = Date.now() - startTime;
        return result;
      }

      // 3. For each price change, notify users who own the player
      for (const pc of priceChanges as any[]) {
        result.priceChangesProcessed++;
        
        const playerName = (pc.professional_players as any)?.name || `Player ${pc.player_id}`;
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

        for (const ownerRow of owners as any[]) {
          // Navigating the nested joins from Supabase
          const userId = (ownerRow as any).fantasy_squads?.fantasy_seasons?.user_id;
          if (!userId) continue;

          // Check if already notified for this player's price change in this gameweek
          const { data: existingNotif } = await this.supabase
            .from('user_notifications')
            .select('id')
            .eq('user_id', userId)
            .eq('type', 'price_change')
            .contains('metadata', { player_id: pc.player_id, gameweek_id: (gameweek as any).id })
            .limit(1)
            .maybeSingle();

          if (existingNotif) continue;

          // Create notification
          const title = `${playerName} Price ${isRise ? 'Rise' : 'Fall'}!`;
          const message = `${playerName}'s price has ${isRise ? 'risen' : 'fallen'} by ${changeStr}m to $${pc.price}m.`;
          
          const { error: insertError } = await (this.supabase.from('user_notifications') as any).insert({
            user_id: userId,
            type: 'price_change',
            title,
            message,
            metadata: { player_id: pc.player_id, gameweek_id: (gameweek as any).id, price_change: pc.price_change },
          });

          if (insertError) {
            result.errors.push(`Failed to insert notif for user ${userId}: ${insertError.message}`);
            continue;
          }

          result.notificationsGenerated++;

          // Send push
          const { data: pushSubs } = await this.supabase
            .from('user_push_subscriptions')
            .select('*')
            .eq('user_id', userId);

          if (pushSubs && pushSubs.length > 0) {
            for (const sub of pushSubs) {
              try {
                await this.dispatchWebPush(sub, { title, body: message });
                result.pushNotificationsSent++;
              } catch (e) {
                // Ignore push failure internally
              }
            }
          }
        }
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message || String(error));
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function sendPriceChangeNotifications(): Promise<JobResult> {
  const job = new SendPriceChangeNotifications();
  return await job.execute();
}
