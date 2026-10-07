import { createClient } from '@supabase/supabase-js';
import { deliverPushNotifications, type PushNotificationCandidate } from '@/lib/push-notifications';

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
    const pushCandidates: PushNotificationCandidate[] = [];

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
        pushCandidates.push({
          userId,
          type: 'rank_update',
          metadata: { gameweek_id: gw.id, rank: season.global_rank },
        });
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

export async function sendRankNotifications(): Promise<JobResult> {
  const job = new SendRankNotifications();
  return await job.execute();
}
