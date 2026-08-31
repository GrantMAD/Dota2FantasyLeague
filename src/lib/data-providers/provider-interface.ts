/**
 * Data Provider Interface
 * 
 * Defines the contract for all data providers (STRATZ, OpenDota, etc.)
 * Enables pluggable provider implementations with consistent API
 */

export interface PlayerData {
  id: string;
  steamId: string;
  name: string;
  tag?: string;
  country?: string;
  roles: string[]; // e.g., ['carry', 'mid', 'support']
  team?: {
    id: string;
    name: string;
  };
  isActive: boolean;
  profileUrl?: string;
  imageUrl?: string;
  lastUpdated: Date;
}

export interface TeamData {
  id: string;
  name: string;
  tag: string;
  region?: string;
  country?: string;
  foundedDate?: Date;
  logoUrl?: string;
  roster: Array<{
    playerId: string;
    joinedDate: Date;
    position?: string;
  }>;
  isActive: boolean;
  lastUpdated: Date;
}

export interface TournamentData {
  id: string;
  name: string;
  region?: string;
  prizePool?: number;
  currency?: string; // USD, EUR, etc.
  startDate: Date;
  endDate?: Date;
  status: 'upcoming' | 'active' | 'concluded';
  teams: string[]; // Team IDs
  matches?: string[]; // Match IDs
  tier?: string; // Major, Regional, Minor, etc.
  lastUpdated: Date;
}

export interface MatchData {
  id: string;
  tournamentId: string;
  team1Id: string;
  team2Id: string;
  scheduledAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  status: 'scheduled' | 'live' | 'concluded';
  gameweek?: number;
  bestOfSeries?: number;
  seriesStatus?: {
    team1Wins: number;
    team2Wins: number;
  };
  lastUpdated: Date;
}

export interface MatchDetailsData {
  matchId: string;
  duration: number; // seconds
  winner: string; // Team ID
  teams: Array<{
    teamId: string;
    players: Array<{
      playerId: string;
      heroId: string;
      heroName: string;
      kills: number;
      deaths: number;
      assists: number;
      goldPerMinute: number;
      experiencePerMinute: number;
      lastHits: number;
      denies: number;
      heroDamage: number;
      towerDamage: number;
      healing: number;
      wardsPlaced: number;
      wardsDestroyed: number;
      firstBloodAchieved: boolean;
      roshansKilled: number;
    }>;
  }>;
  lastUpdated: Date;
}

export interface RosterChangeData {
  teamId: string;
  playerId: string;
  changeType: 'joined' | 'left' | 'transferred';
  changedAt: Date;
  previousTeam?: string;
  role?: string;
}

export interface DataProviderFilters {
  limit?: number;
  offset?: number;
  activeOnly?: boolean;
  region?: string;
}

export interface DataProviderError extends Error {
  code: string;
  statusCode?: number;
  retryable: boolean;
  originalError?: Error;
}

/**
 * Base interface for all data providers
 */
export interface DataProvider {
  name: string;
  version: string;
  
  /**
   * Verify provider is configured and accessible
   */
  healthCheck(): Promise<boolean>;

  /**
   * Fetch all active players
   */
  fetchPlayers(filters?: DataProviderFilters): Promise<PlayerData[]>;

  /**
   * Fetch specific player by ID
   */
  fetchPlayer(playerId: string): Promise<PlayerData>;

  /**
   * Fetch all professional teams
   */
  fetchTeams(filters?: DataProviderFilters): Promise<TeamData[]>;

  /**
   * Fetch specific team by ID
   */
  fetchTeam(teamId: string): Promise<TeamData>;

  /**
   * Fetch tournaments (active, upcoming, or recent)
   */
  fetchTournaments(
    filters?: DataProviderFilters & {
      status?: 'upcoming' | 'active' | 'concluded';
      minTier?: string;
    }
  ): Promise<TournamentData[]>;

  /**
   * Fetch matches for a tournament or all matches
   */
  fetchMatches(
    tournamentId?: string,
    filters?: DataProviderFilters & {
      status?: 'scheduled' | 'live' | 'concluded';
    }
  ): Promise<MatchData[]>;

  /**
   * Fetch detailed statistics for a specific match
   */
  fetchMatchDetails(matchId: string): Promise<MatchDetailsData>;

  /**
   * Fetch roster history/changes for a player
   */
  fetchRosterHistory(
    playerId: string,
    dateRange?: {
      from: Date;
      to: Date;
    }
  ): Promise<RosterChangeData[]>;

  /**
   * Get provider-specific rate limit info
   */
  getRateLimitStatus(): Promise<{
    remaining: number;
    limit: number;
    resetAt: Date;
  }>;
}

/**
 * Helper class for common data provider operations
 */
export class DataProviderBase {
  protected logger = console; // Can be replaced with proper logger

  protected log(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    if (data) {
      this.logger[level](`[${timestamp}] ${message}`, data);
    } else {
      this.logger[level](`[${timestamp}] ${message}`);
    }
  }

  protected createError(
    code: string,
    message: string,
    statusCode?: number,
    retryable = false,
    originalError?: Error
  ): DataProviderError {
    const error = new Error(message) as DataProviderError;
    error.code = code;
    error.statusCode = statusCode;
    error.retryable = retryable;
    error.originalError = originalError;
    error.name = 'DataProviderError';
    return error;
  }

  protected async retry<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    backoffMs = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const err = error as DataProviderError;
        
        if (!err.retryable || attempt === maxAttempts) {
          throw error;
        }

        const waitTime = backoffMs * Math.pow(2, attempt - 1);
        this.log('warn', `Retry attempt ${attempt}/${maxAttempts} after ${waitTime}ms`, {
          error: err.message
        });
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError;
  }
}
