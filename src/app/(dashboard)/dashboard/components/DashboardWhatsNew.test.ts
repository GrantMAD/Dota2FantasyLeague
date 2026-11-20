jest.mock('@/lib/supabase', () => ({
  supabaseServer: jest.fn(),
  getSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/fetch-with-auth', () => ({
  fetchWithAuth: jest.fn(),
}));

import type { FriendActivity } from '@/types/friends';
import { keepLatestGameweekScoreActivities } from './friend-activity';
import {
  groupFeedItems,
  getCategoryTheme,
  type FeedItemChild,
  type WhatsNewUpdate,
  type WhatsNewEvent,
} from './DashboardWhatsNew';

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

function update(
  id: number,
  kind: WhatsNewUpdate['kind'],
  title = `Update ${id}`,
  message = `Message ${id}`,
): WhatsNewUpdate {
  return {
    id,
    kind,
    title,
    message,
    createdAt: `2026-11-${String(id).padStart(2, '0')}T10:00:00Z`,
    href: `/transfers?highlight=${id}`,
  };
}

function tournament(id: number, title = `Tournament ${id}`): WhatsNewEvent {
  return {
    kind: 'tournament',
    id,
    title,
    startedAt: `2026-11-${String(id).padStart(2, '0')}T00:00:00Z`,
    href: `/tournaments/${id}`,
    tier: 'Tier 1',
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

describe('groupFeedItems (Accordion UX)', () => {
  it('leaves single items ungrouped as individual items', () => {
    const raw: FeedItemChild[] = [
      { type: 'update', data: update(1, 'price_change', 'Miracle- Price Change') },
      { type: 'tournament', data: tournament(10, 'BLAST SLAM IX') },
    ];

    const result = groupFeedItems(raw, 'all');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: 'update', data: update(1, 'price_change', 'Miracle- Price Change') });
    expect(result[1]).toEqual({ type: 'tournament', data: tournament(10, 'BLAST SLAM IX') });
  });

  it('groups multiple items of the same notification category into an accordion group', () => {
    const raw: FeedItemChild[] = [
      { type: 'update', data: update(1, 'price_change', 'Miracle- Price Change', '+$0.2m') },
      { type: 'update', data: update(2, 'price_change', 'Ame Price Change', '+$0.1m') },
      { type: 'update', data: update(3, 'price_change', 'Yatoro Price Change', '-$0.1m') },
    ];

    const result = groupFeedItems(raw, 'all');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('group');

    if (result[0].type === 'group') {
      expect(result[0].category).toBe('price_change');
      expect(result[0].count).toBe(3);
      expect(result[0].title).toBe('3 Price Changes');
      expect(result[0].items).toHaveLength(3);
      expect(result[0].preview).toContain('Miracle- Price Change');
    }
  });

  it('groups distinct categories separately and preserves single items', () => {
    const raw: FeedItemChild[] = [
      { type: 'friend', data: activity(1, 'transfer', 6) },
      { type: 'friend', data: activity(2, 'transfer', 6) },
      { type: 'update', data: update(1, 'availability', 'Miracle- Doubtful') },
      { type: 'update', data: update(2, 'price_change', 'Ame Up') },
      { type: 'update', data: update(3, 'price_change', 'Yatoro Up') },
      { type: 'tournament', data: tournament(100, 'DreamLeague') },
    ];

    const result = groupFeedItems(raw, 'all');
    expect(result).toHaveLength(4);

    // Friend group (2 items)
    expect(result[0].type).toBe('group');
    if (result[0].type === 'group') {
      expect(result[0].category).toBe('friend');
      expect(result[0].count).toBe(2);
    }

    // Availability alert (1 item - standalone)
    expect(result[1].type).toBe('update');

    // Price change group (2 items)
    expect(result[2].type).toBe('group');
    if (result[2].type === 'group') {
      expect(result[2].category).toBe('price_change');
      expect(result[2].count).toBe(2);
    }

    // Tournament (1 item - standalone)
    expect(result[3].type).toBe('tournament');
  });

  it('groups subcategories in squad filter and excludes friends and tournaments', () => {
    const raw: FeedItemChild[] = [
      { type: 'friend', data: activity(1, 'transfer', 6) },
      { type: 'update', data: update(1, 'price_change', 'Ame') },
      { type: 'update', data: update(2, 'price_change', 'Yatoro') },
      { type: 'update', data: update(3, 'availability', 'Topson') },
      { type: 'tournament', data: tournament(100, 'DreamLeague') },
    ];

    const result = groupFeedItems(raw, 'squad');
    expect(result).toHaveLength(2);

    // Availability single item
    expect(result[0].type).toBe('update');

    // Price change group
    expect(result[1].type).toBe('group');
    if (result[1].type === 'group') {
      expect(result[1].count).toBe(2);
    }
  });

  it('shows individual items directly when filtering by tournaments or friends', () => {
    const raw: FeedItemChild[] = [
      { type: 'friend', data: activity(1, 'transfer', 6) },
      { type: 'friend', data: activity(2, 'transfer', 6) },
      { type: 'tournament', data: tournament(101, 'Tournament A') },
      { type: 'tournament', data: tournament(102, 'Tournament B') },
    ];

    const friendsResult = groupFeedItems(raw, 'friends');
    expect(friendsResult).toHaveLength(2);
    expect(friendsResult.every((r) => r.type === 'friend')).toBe(true);

    const tourneysResult = groupFeedItems(raw, 'tournaments');
    expect(tourneysResult).toHaveLength(2);
    expect(tourneysResult.every((r) => r.type === 'tournament')).toBe(true);
  });
});

describe('getCategoryTheme', () => {
  it('returns appropriate colors and icons for each category', () => {
    expect(getCategoryTheme('price_change').label).toBe('Price Changes');
    expect(getCategoryTheme('availability').label).toBe('Squad Alerts');
    expect(getCategoryTheme('live_match').label).toBe('Live Matches');
    expect(getCategoryTheme('league').label).toBe('League Updates');
    expect(getCategoryTheme('tournament').label).toBe('Active Tournaments');
    expect(getCategoryTheme('friend').label).toBe('Friend Activity');
  });
});
