import type { FriendActivity } from '@/types/friends';
import { keepLatestGameweekScoreActivities } from './friend-activity';

function activity(
  id: number,
  activityType: FriendActivity['activity_type'],
  gameweekNumber: number,
): FriendActivity {
  return {
    activity_id: `${activityType}:${id}`,
    activity_type: activityType,
    user_id: `friend-${id}`,
    username: `friend${id}`,
    display_name: null,
    avatar_url: null,
    season_id: 1,
    season_name: 'Season',
    gameweek_id: gameweekNumber,
    gameweek_number: gameweekNumber,
    title: activityType === 'gameweek_score'
      ? `Gameweek ${gameweekNumber} scores are in`
      : 'Made fantasy transfers',
    players_in: null,
    players_out: null,
    chip: null,
    gameweek_points: activityType === 'gameweek_score' ? 10 : null,
    total_points: 10,
    gameweek_rank: null,
    previous_gameweek_rank: null,
    global_rank: null,
    updated_at: `2026-10-${String(id).padStart(2, '0')} 12:00:00`,
    lineup_changes: null,
  };
}

describe('keepLatestGameweekScoreActivities', () => {
  it('hides older gameweek score items while preserving latest scores and other friend moves', () => {
    const latestScore = activity(5, 'gameweek_score', 5);
    const olderScore = activity(3, 'gameweek_score', 3);
    const friendMove = activity(4, 'transfer', 4);
    const anotherLatestScore = activity(6, 'gameweek_score', 5);

    expect(keepLatestGameweekScoreActivities([
      latestScore,
      olderScore,
      friendMove,
      anotherLatestScore,
    ])).toEqual([latestScore, friendMove, anotherLatestScore]);
  });
});
