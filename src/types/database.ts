// User Types
export interface User {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
}

// Professional Entities
export interface ProfessionalTeam {
  id: number;
  name: string;
  slug: string;
  region?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export type PlayerRole = 'Carry' | 'Mid' | 'Offlane' | 'Support' | 'Hard Support';

export interface ProfessionalPlayer {
  id: number;
  name: string;
  slug: string;
  in_game_name?: string;
  team_id?: number;
  primary_role: PlayerRole;
  secondary_roles: PlayerRole[];
  profile_image_url?: string;
  country?: string;
  data_provider_id?: string;
  availability_status?: string;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

// Season Types
export type SeasonStatus = 'planning' | 'active' | 'ended' | 'archived';

export interface Season {
  id: number;
  name: string;
  slug: string;
  status: SeasonStatus;
  start_date: string;
  end_date: string;
  starting_budget: number;
  max_players_per_team: number;
  squad_size: number;
  starters_required: number;
  bench_size: number;
  created_at: string;
  updated_at: string;
}

export type GameweekStatus = 'upcoming' | 'active' | 'closed' | 'locked';

export interface Gameweek {
  id: number;
  season_id: number;
  gameweek_number: number;
  status: GameweekStatus;
  start_date: string;
  end_date: string;
  deadline: string;
  is_international_break: boolean;
  created_at: string;
  updated_at: string;
}

export type TournamentStatus = 'eligible' | 'excluded' | 'provisional' | 'archived';

export interface Tournament {
  id: number;
  season_id: number;
  name: string;
  slug: string;
  status: TournamentStatus;
  tier?: string;
  start_date: string;
  end_date: string;
  eligible: boolean;
  created_at: string;
  updated_at: string;
}

export type MatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';

export interface Match {
  id: number;
  series_id: number;
  gameweek_id: number;
  team_a_id: number;
  team_b_id: number;
  match_number?: number;
  status: MatchStatus;
  scheduled_time: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  winner_team_id?: number;
  external_match_id?: string;
  created_at: string;
  updated_at: string;
}

// Fantasy Season Types
export interface FantasySeason {
  id: number;
  user_id: string;
  season_id: number;
  budget: number;
  total_points: number;
  global_rank?: number;
  created_at: string;
  updated_at: string;
}

export interface FantasySquad {
  id: number;
  fantasy_season_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface FantasySquadMember {
  id: number;
  squad_id: number;
  player_id: number;
  cost: number;
  acquired_date: string;
  removed_date?: string;
  created_at: string;
  updated_at: string;
}

export interface FantasyLineup {
  id: number;
  fantasy_season_id: number;
  gameweek_id: number;
  captain_player_id: number;
  vice_captain_player_id?: number;
  carry_id: number;
  mid_id: number;
  offlane_id: number;
  support_id: number;
  hard_support_id: number;
  bench_1_id?: number;
  bench_2_id?: number;
  bench_3_id?: number;
  locked: boolean;
  locked_at?: string;
  total_points: number;
  created_at: string;
  updated_at: string;
}

// Scoring Types
export interface ScoringRule {
  id: number;
  season_id: number;
  rule_name: string;
  rule_key: string;
  value: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface PlayerPerformance {
  id: number;
  player_id: number;
  match_id: number;
  gameweek_id: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_minute: number;
  experience_per_minute: number;
  last_hits: number;
  denies: number;
  hero_damage: number;
  building_damage: number;
  tower_participation: number;
  roshan_participation: number;
  wards_placed: number;
  wards_destroyed: number;
  healing: number;
  created_at: string;
  updated_at: string;
}

export interface FantasyPointsBreakdown {
  id: number;
  performance_id: number;
  combat_points: number;
  economy_points: number;
  objective_points: number;
  teamfight_points: number;
  win_points: number;
  series_points: number;
  performance_index_points: number;
  consistency_points: number;
  penalty_points: number;
  total_points: number;
  created_at: string;
  updated_at: string;
}

// League Types
export interface League {
  id: number;
  season_id: number;
  creator_id: string;
  name: string;
  league_type: string;
  description?: string;
  privacy_level: string;
  max_participants?: number;
  current_participants: number;
  created_at: string;
  updated_at: string;
}

export interface LeagueParticipant {
  id: number;
  league_id: number;
  user_id: string;
  fantasy_season_id: number;
  points: number;
  rank?: number;
  joined_at: string;
  created_at: string;
}

// Market Types
export interface PlayerPrice {
  id: number;
  season_id: number;
  player_id: number;
  gameweek_id: number;
  price: number;
  price_change: number;
  ownership_percentage: number;
  created_at: string;
}

// Supabase Database Schema Type
// NOTE: these jobs use dynamic table names and a permissive schema so the
// application can interact with multiple tables without a generated type map.
export interface Database {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: Array<Record<string, unknown>>;
      }
    >;
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<
      string,
      {
        Args: Record<string, unknown>;
        Returns: unknown;
      }
    >;
    Enums: Record<string, string>;
    CompositeTypes: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      }
    >;
  };
}

// Match Statistics Types
export interface MatchPlayerStats {
  id: number;
  match_id: number;
  player_id: number;
  team_id: number;
  hero_id: string;
  hero_name: string;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_minute: number;
  experience_per_minute: number;
  last_hits: number;
  denies: number;
  hero_damage: number;
  tower_damage: number;
  healing: number;
  wards_placed: number;
  wards_destroyed: number;
  first_blood_achieved: boolean;
  roshan_kills: number;
  created_at: string;
  updated_at: string;
}

export interface GameweekScore {
  id: number;
  fantasy_lineup_id: number;
  player_id: number;
  match_id: number;
  gameweek_id: number;
  fantasy_points: number;
  created_at: string;
  updated_at: string;
}

export interface TeamRosterHistory {
  id: number;
  team_id: number;
  player_id: number;
  change_type: string;
  changed_at: string;
  previous_team_id?: number;
  role?: string;
  created_at: string;
  updated_at: string;
}

export interface JobExecutionLog {
  id: string;
  job_name: string;
  status: 'started' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
