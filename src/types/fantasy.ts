/**
 * Canonical shared TypeScript interfaces for Fantasy Dota 2.
 * Used across dashboard pages, components, and API routes.
 */

export type LineupSlot =
  | 'carry'
  | 'mid'
  | 'offlane'
  | 'support'
  | 'hard_support'
  | 'bench_1'
  | 'bench_2'
  | 'bench_3';

export const STARTER_SLOTS: LineupSlot[] = [
  'carry',
  'mid',
  'offlane',
  'support',
  'hard_support',
];

export const BENCH_SLOTS: LineupSlot[] = [
  'bench_1',
  'bench_2',
  'bench_3',
];

export type PlayerRole = 'Carry' | 'Mid' | 'Offlane' | 'Support' | 'Hard Support';

export type ChipType = 'triple-captain' | 'bench-boost' | null;

export interface ChipStatus {
  tripleCaptainUsed?: boolean;
  tripleCaptainGameweekId?: number | null;
  benchBoostUsed?: boolean;
  benchBoostGameweekId?: number | null;
}

export interface ProfessionalTeamRef {
  id?: number;
  name?: string | null;
  slug?: string | null;
  region?: string | null;
  logo_url?: string | null;
}

/**
 * Standard fantasy player representation across Squads, Lineups, Transfers, and Market.
 */
export interface FantasyPlayer {
  id: number;
  name: string;
  real_name?: string | null;
  in_game_name?: string | null;
  primary_role?: string | null;
  profile_image_url?: string | null;
  current_price?: number | null;
  availability_status?: string | null;
  availability_reason?: string | null;
  professional_teams?: ProfessionalTeamRef | null;
  // Optional performance/form statistics
  recent_points?: number | null;
  last_gw_points?: number | null;
  gameweek_points?: number | null;
  total_season_points?: number | null;
  ownership_percentage?: number | null;
  form_trend?: 'up' | 'down' | 'flat';
  performances?: PlayerPerformanceRecord[];
}

export interface PlayerPerformanceRecord {
  id: number;
  gameweek_id: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_minute?: number;
  experience_per_minute?: number;
  matches?: { team_b?: { name?: string | null } | null } | null;
  fantasy_points_breakdown?: { total_points?: number | null } | null;
}

/**
 * Slot entry in a user's fantasy lineup.
 */
export interface LineupEntry {
  slot: string;
  player_id: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_starter?: boolean;
  professional_players?: FantasyPlayer | null;
}

/**
 * Starter summary representation used in dashboard widgets.
 */
export interface ScoreBreakdown {
  combat: number;
  economy: number;
  objective: number;
  win: number;
  performance: number;
  total: number;
}

export interface DashboardStarter {
  id: number;
  slot: string;
  name: string;
  in_game_name?: string | null;
  primary_role: string;
  profile_image_url?: string | null;
  current_price?: number | null;
  is_captain?: boolean;
  is_vice_captain?: boolean;
  team_name?: string | null;
  // Gameweek scoring (populated when a closed/active GW has breakdown data)
  gw_points?: number | null;
  score_breakdown?: ScoreBreakdown | null;
}

/**
 * League standing entry.
 */
export interface LeagueStanding {
  rank: number | null;
  points?: number;
  leagues?: { id?: number; name?: string } | null;
}

/**
 * Overall dashboard data returned by /api/dashboard/stats.
 */
export interface DashboardData {
  fantasySeasonId?: number | null;
  activeSquadCount: number;
  squadValue: number;
  bankBalance: number;
  totalPoints: number;
  globalRank: number | null;
  freeTransfers: number;
  squadName?: string;
  gameweek?: { gameweek_number: number; deadline: string; status: string } | null;
  captain?: { name: string; primary_role?: string } | null;
  viceCaptain?: { name: string; primary_role?: string } | null;
  starters?: DashboardStarter[];
  leagueStandings: LeagueStanding[];
}

/**
 * Gameweek row structure with associated metadata, flags, and match counts.
 */
export interface GameweekRow {
  id: number;
  season_id?: number;
  gameweek_number: number;
  start_date: string;
  end_date: string;
  deadline: string;
  status: 'upcoming' | 'active' | 'closed' | 'locked';
  match_count: number;
  tournaments: Array<{ id: number; name: string; slug?: string | null }>;
  flags: Array<{
    flag: string;
    team_id: number;
    professional_teams?: {
      id: number;
      name: string;
      slug?: string | null;
      logo_url?: string | null;
    } | null;
  }>;
  top_scorer: {
    player_id: number;
    total_points: number;
    name: string;
    in_game_name?: string | null;
    primary_role?: string | null;
  } | null;
  user_score: number | null;
}

/**
 * Notification representation.
 */
export interface NotificationRecord {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * League management and standings interfaces.
 */
export interface StandingEntry {
  userId?: string;
  manager: string;
  username?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  points: number;
  gwPoints?: number;
  rank: number | null;
  wins: number;
  losses: number;
  draws: number;
  form: string[];
}

export interface FixtureEntry {
  id: number;
  leagueId?: number;
  leagueName?: string;
  gameweekId: number;
  home: string;
  homeUsername?: string;
  homeAvatarUrl?: string | null;
  away: string;
  awayUsername?: string | null;
  awayAvatarUrl?: string | null;
  homePoints: number;
  awayPoints: number;
  winnerId: number | null;
  isBye: boolean;
}

export interface LeagueRecord {
  id: number;
  name: string;
  type: 'classic' | 'h2h';
  privacyLevel: 'public' | 'private';
  description: string;
  maxParticipants: number;
  currentParticipants: number;
  inviteCode: string;
  standings?: StandingEntry[];
  fixtures?: FixtureEntry[];
}
