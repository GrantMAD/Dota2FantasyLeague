import type { FriendActivity } from '@/types/friends';

export function keepLatestGameweekScoreActivities(activities: FriendActivity[]): FriendActivity[] {
  const latestGameweekNumber = activities.reduce((latest, activity) => (
    activity.activity_type === 'gameweek_score' && activity.gameweek_number !== null
      ? Math.max(latest, activity.gameweek_number)
      : latest
  ), Number.NEGATIVE_INFINITY);

  if (!Number.isFinite(latestGameweekNumber)) return activities;

  return activities.filter((activity) =>
    activity.activity_type !== 'gameweek_score' ||
    activity.gameweek_number === null ||
    activity.gameweek_number === latestGameweekNumber
  );
}
