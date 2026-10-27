export interface FriendProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  followed_at?: string;
  is_following?: boolean;
}

export interface FriendActivity {
  activity_id: string;
  activity_type: 'transfer' | 'chip' | 'lineup' | 'gameweek_score';
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  season_id: number;
  season_name: string;
  gameweek_id: number;
  gameweek_number: number | null;
  title: string;
  players_in: string[] | null;
  players_out: string[] | null;
  chip: string | null;
  gameweek_points: number | string | null;
  total_points: number | string | null;
  gameweek_rank: number | null;
  previous_gameweek_rank: number | null;
  global_rank: number | null;
  updated_at: string;
  lineup_changes: Array<{
    slot: string;
    from: string | null;
    to: string | null;
  }> | null;
}

export interface FriendProgress {
  manager: FriendProfile;
  season: {
    id: number;
    name: string;
    total_points: number;
    global_rank: number | null;
    gameweeks: Array<{
      id: number;
      gameweek_number: number;
      gameweek_points: number;
      total_points: number;
      rank: number;
      updated_at: string;
    }>;
  } | null;
}
