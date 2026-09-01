import { createClient } from '@supabase/supabase-js';

interface JobResult {
  success: boolean;
  gameweeksProcessed: number;
  notificationsGenerated: number;
  pushNotificationsSent: number;
  errors: string[];
  duration: number;
}

class SendDeadlineNotifications {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  private async dispatchWebPush(subscription: any, payload: any) {
    // In a real implementation, you would use the 'web-push' npm package:
    // webpush.setVapidDetails('mailto:admin@example.com', PUBLIC_VAPID_KEY, PRIVATE_VAPID_KEY);
    // await webpush.sendNotification(subscription, JSON.stringify(payload));
    
    // For now, we simulate the dispatch
    console.log(`[PUSH NOTIFICATION] Sending to ${subscription.endpoint}: ${payload.title}`);
    return true;
  }

  public async execute(): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: true,
      gameweeksProcessed: 0,
      notificationsGenerated: 0,
      pushNotificationsSent: 0,
      errors: [],
      duration: 0,
    };

    try {
      // 1. Find upcoming gameweeks within 24 hours of deadline
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      const { data: gameweeks, error: gwError } = await this.supabase
        .from('gameweeks')
        .select('id, gameweek_number, season_id, deadline')
        .eq('status', 'upcoming')
        .gte('deadline', now.toISOString())
        .lte('deadline', tomorrow.toISOString());

      if (gwError) throw gwError;

      if (!gameweeks || gameweeks.length === 0) {
        result.duration = Date.now() - startTime;
        return result;
      }

      for (const gw of gameweeks as any[]) {
        result.gameweeksProcessed++;

        // 2. Find users who are playing this season
        const { data: fantasySeasons, error: fsError } = await this.supabase
          .from('fantasy_seasons')
          .select('user_id')
          .eq('season_id', gw.season_id);

        if (fsError || !fantasySeasons) {
          result.errors.push(`Failed to fetch fantasy seasons for GW ${gw.id}: ${fsError?.message}`);
          continue;
        }

        for (const season of fantasySeasons as any[]) {
          const userId = season.user_id;

          // 3. Check if user already got a deadline notification for this gameweek
          const { data: existingNotif, error: checkError } = await this.supabase
            .from('user_notifications')
            .select('id')
            .eq('user_id', userId)
            .eq('type', 'deadline_reminder')
            .contains('metadata', { gameweek_id: gw.id })
            .limit(1)
            .maybeSingle();

          if (checkError) {
            result.errors.push(`Failed to check existing notification for user ${userId}: ${checkError.message}`);
            continue;
          }

          if (existingNotif) {
            // Already notified
            continue;
          }

          // 4. Create Notification
          const title = `Gameweek ${gw.gameweek_number} Deadline Approaching!`;
          const message = `The deadline for Gameweek ${gw.gameweek_number} is less than 24 hours away. Finalize your transfers and set your captain!`;
          
          const { error: insertError } = await (this.supabase.from('user_notifications') as any).insert({
            user_id: userId,
            type: 'deadline_reminder',
            title,
            message,
            metadata: { gameweek_id: gw.id, gameweek_number: gw.gameweek_number },
          });

          if (insertError) {
            result.errors.push(`Failed to create notification for user ${userId}: ${insertError.message}`);
            continue;
          }

          result.notificationsGenerated++;

          // 5. Send Web Push
          const { data: pushSubs } = await this.supabase
            .from('user_push_subscriptions')
            .select('*')
            .eq('user_id', userId);

          if (pushSubs && pushSubs.length > 0) {
            for (const sub of pushSubs) {
              try {
                await this.dispatchWebPush(sub, { title, body: message });
                result.pushNotificationsSent++;
              } catch (pushErr) {
                result.errors.push(`Push failed for user ${userId}: ${pushErr}`);
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

export async function sendDeadlineNotifications(): Promise<JobResult> {
  const job = new SendDeadlineNotifications();
  return await job.execute();
}
