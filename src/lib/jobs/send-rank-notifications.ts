import { createClient } from '@supabase/supabase-js';

interface JobResult {
  success: boolean;
  usersProcessed: number;
  notificationsGenerated: number;
  pushNotificationsSent: number;
  errors: string[];
  duration: number;
}

interface ClosedGameweekRow {
  id: number;
  gameweek_number: number;
  season_id: number;
}

interface FantasySeasonRankRow {
  user_id: string;
  global_rank: number;
  total_points: number;
}

interface PushSubscriptionRecord {
  endpoint: string;
}

interface RankNotificationInsert {
  user_id: string;
  type: 'rank_update';
  title: string;
  message: string;
  metadata: { gameweek_id: number; rank: number };
}

class SendRankNotifications {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  private async dispatchWebPush(subscription: PushSubscriptionRecord, payload: { title: string; body: string }) {
    console.log(`[PUSH NOTIFICATION] Sending to ${subscription.endpoint}: ${payload.title}`);
    return true;
  }

  public async execute(): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: true,
      usersProcessed: 0,
      notificationsGenerated: 0,
      pushNotificationsSent: 0,
      errors: [],
      duration: 0,
    };

    try {
      // 1. Get recently closed gameweeks (we only send rank notifications after a GW is fully closed and rankings are updated)
      const { data: gameweeks, error: gwError } = await this.supabase
        .from('gameweeks')
        .select('id, gameweek_number, season_id')
        .eq('status', 'closed')
        .order('end_date', { ascending: false })
        .limit(1);

      if (gwError) throw gwError;
      const closedGameweeks = (gameweeks ?? []) as ClosedGameweekRow[];
      if (closedGameweeks.length === 0) {
        return { ...result, duration: Date.now() - startTime };
      }

      const gw = closedGameweeks[0];

      // 2. Fetch users and their current global rank
      const { data: fantasySeasons, error: fsError } = await this.supabase
        .from('fantasy_seasons')
        .select('user_id, global_rank, total_points')
        .eq('season_id', gw.season_id)
        .not('global_rank', 'is', null);

      if (fsError) throw fsError;
      const rankedSeasons = (fantasySeasons ?? []) as FantasySeasonRankRow[];
      if (rankedSeasons.length === 0) {
        return { ...result, duration: Date.now() - startTime };
      }

      // 3. For each user, check if we've notified them about this gameweek's final rank
      for (const season of rankedSeasons) {
        result.usersProcessed++;
        const userId = season.user_id;

        const { data: existingNotif } = await this.supabase
          .from('user_notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'rank_update')
          .contains('metadata', { gameweek_id: gw.id })
          .limit(1)
          .maybeSingle();

        if (existingNotif) continue;

        // Create notification
        const title = `Gameweek ${gw.gameweek_number} Results Are In!`;
        const message = `The gameweek has concluded. You are currently ranked #${season.global_rank} globally with ${season.total_points} total points.`;
        
        const notificationTable = this.supabase.from('user_notifications') as unknown as {
          insert(values: RankNotificationInsert): PromiseLike<{ error: { message: string } | null }>;
        };
        const { error: insertError } = await notificationTable.insert({
          user_id: userId,
          type: 'rank_update',
          title,
          message,
          metadata: { gameweek_id: gw.id, rank: season.global_rank },
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
            } catch {
              // Ignore push failure internally
            }
          }
        }
      }

    } catch (error: unknown) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function sendRankNotifications(): Promise<JobResult> {
  const job = new SendRankNotifications();
  return await job.execute();
}
