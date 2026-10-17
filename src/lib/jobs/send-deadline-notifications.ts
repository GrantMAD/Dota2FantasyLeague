import { createClient } from '@supabase/supabase-js';
import { deliverPushNotifications, type PushNotificationCandidate } from '@/lib/push-notifications';

interface JobResult {
  success: boolean;
  gameweeksProcessed: number;
  notificationsGenerated: number;
  pushNotificationsSent: number;
  errors: string[];
  duration: number;
}

interface DeadlineGameweekRow {
  id: number;
  gameweek_number: number;
  season_id: number;
  deadline: string;
}

interface FantasySeasonOwnerRow {
  id: number;
  user_id: string | null;
}

interface FantasyLineupRow {
  carry_id: number | null;
  mid_id: number | null;
  offlane_id: number | null;
  support_id: number | null;
  hard_support_id: number | null;
  captain_player_id: number | null;
}

interface DeadlineNotificationInsert {
  user_id: string;
  type: 'deadline_reminder';
  title: string;
  message: string;
  metadata: {
    gameweek_id: number;
    gameweek_number: number;
    reminder_stage?: 'lineup_2h';
  };
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function hasCompleteLineup(lineup: FantasyLineupRow | null): boolean {
  return Boolean(
    lineup?.carry_id &&
    lineup.mid_id &&
    lineup.offlane_id &&
    lineup.support_id &&
    lineup.hard_support_id &&
    lineup.captain_player_id
  );
}

class SendDeadlineNotifications {
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
      gameweeksProcessed: 0,
      notificationsGenerated: 0,
      pushNotificationsSent: 0,
      errors: [],
      duration: 0,
    };
    const pushCandidates: PushNotificationCandidate[] = [];

    try {
      // 1. Find upcoming gameweeks within 24 hours of deadline
      const now = new Date();
      const tomorrow = new Date(now.getTime() + TWENTY_FOUR_HOURS_MS);
      
      const { data: gameweeks, error: gwError } = await this.supabase
        .from('gameweeks')
        .select('id, gameweek_number, season_id, deadline')
        .eq('status', 'upcoming')
        .gte('deadline', now.toISOString())
        .lte('deadline', tomorrow.toISOString());

      if (gwError) throw gwError;

      const deadlineGameweeks = (gameweeks ?? []) as DeadlineGameweekRow[];
      if (deadlineGameweeks.length === 0) {
        result.duration = Date.now() - startTime;
        return result;
      }

      for (const gw of deadlineGameweeks) {
        result.gameweeksProcessed++;

        // 2. Find users who are playing this season
        const { data: fantasySeasons, error: fsError } = await this.supabase
          .from('fantasy_seasons')
          .select('id, user_id')
          .eq('season_id', gw.season_id);

        if (fsError || !fantasySeasons) {
          result.errors.push(`Failed to fetch fantasy seasons for GW ${gw.id}: ${fsError?.message}`);
          result.success = false;
          continue;
        }

        const timeUntilDeadlineMs = new Date(gw.deadline).getTime() - now.getTime();
        for (const season of fantasySeasons as FantasySeasonOwnerRow[]) {
          const userId = season.user_id;
          if (!userId) continue;

          if (timeUntilDeadlineMs <= TWO_HOURS_MS) {
            const { data: lineupData, error: lineupError } = await this.supabase
              .from('fantasy_lineups')
              .select('carry_id, mid_id, offlane_id, support_id, hard_support_id, captain_player_id')
              .eq('fantasy_season_id', season.id)
              .eq('gameweek_id', gw.id)
              .maybeSingle();

            if (lineupError) {
              result.errors.push(`Failed to check lineup for user ${userId} in GW ${gw.id}: ${lineupError.message}`);
              result.success = false;
              continue;
            }
            if (hasCompleteLineup((lineupData ?? null) as FantasyLineupRow | null)) continue;

            const { data: existingLineupReminder, error: reminderCheckError } = await this.supabase
              .from('user_notifications')
              .select('id')
              .eq('user_id', userId)
              .eq('type', 'deadline_reminder')
              .contains('metadata', { gameweek_id: gw.id, reminder_stage: 'lineup_2h' })
              .limit(1)
              .maybeSingle();

            if (reminderCheckError) {
              result.errors.push(`Failed to check lineup reminder for user ${userId}: ${reminderCheckError.message}`);
              result.success = false;
              continue;
            }
            if (existingLineupReminder) continue;

            const title = `Gameweek ${gw.gameweek_number} lineup deadline within 2 hours`;
            const message = `Your Gameweek ${gw.gameweek_number} lineup is not set or is incomplete. The deadline is within 2 hours. Set your lineup now.`;
            const notificationTable = this.supabase.from('user_notifications') as unknown as {
              insert(values: DeadlineNotificationInsert): PromiseLike<{ error: { message: string } | null }>;
            };
            const { error: insertError } = await notificationTable.insert({
              user_id: userId,
              type: 'deadline_reminder',
              title,
              message,
              metadata: {
                gameweek_id: gw.id,
                gameweek_number: gw.gameweek_number,
                reminder_stage: 'lineup_2h',
              },
            });

            if (insertError) {
              result.errors.push(`Failed to create lineup reminder for user ${userId}: ${insertError.message}`);
              result.success = false;
              continue;
            }

            result.notificationsGenerated++;
            pushCandidates.push({
              userId,
              type: 'deadline_reminder',
              metadata: { gameweek_id: gw.id, gameweek_number: gw.gameweek_number },
              title,
              body: message,
            });
            continue;
          }

          // The regular reminder is sent once per gameweek before the targeted two-hour lineup check.
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
            result.success = false;
            continue;
          }

          if (existingNotif) {
            // Already notified
            continue;
          }

          // 4. Create Notification
          const title = `Gameweek ${gw.gameweek_number} Deadline Approaching!`;
          const message = `The deadline for Gameweek ${gw.gameweek_number} is less than 24 hours away. Finalize your transfers and set your captain!`;
          
          const notificationTable = this.supabase.from('user_notifications') as unknown as {
            insert(values: DeadlineNotificationInsert): PromiseLike<{ error: { message: string } | null }>;
          };
          const { error: insertError } = await notificationTable.insert({
            user_id: userId,
            type: 'deadline_reminder',
            title,
            message,
            metadata: { gameweek_id: gw.id, gameweek_number: gw.gameweek_number },
          });

          if (insertError) {
            result.errors.push(`Failed to create notification for user ${userId}: ${insertError.message}`);
            result.success = false;
            continue;
          }

          result.notificationsGenerated++;
          pushCandidates.push({
            userId,
            type: 'deadline_reminder',
            metadata: { gameweek_id: gw.id, gameweek_number: gw.gameweek_number },
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

export async function sendDeadlineNotifications(): Promise<JobResult> {
  const job = new SendDeadlineNotifications();
  return await job.execute();
}
