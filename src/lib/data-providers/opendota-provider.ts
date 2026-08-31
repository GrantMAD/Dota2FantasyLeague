/**
 * OpenDota Data Provider
 * 
 * Implements data fetching from OpenDota REST API
 * API Docs: https://docs.opendota.com/
 * 
 * NOTE: OpenDota is primarily focused on match statistics and has limited
 * professional tournament data. Consider using alongside STRATZ.
 */

import {
  DataProvider,
  DataProviderBase,
  DataProviderError,
  DataProviderFilters,
  PlayerData,
  TeamData,
  TournamentData,
  MatchData,
  MatchDetailsData,
  RosterChangeData,
} from './provider-interface';

interface OpenDotaConfig {
  apiUrl?: string;
  rateLimit?: {
    requestsPerMinute: number;
  };
}

export class OpenDotaProvider extends DataProviderBase implements DataProvider {
  name = 'OpenDota';
  version = '1.0.0';

  private config: OpenDotaConfig;
  private apiUrl: string;
  private lastRequestTime = 0;
  private minRequestInterval: number;

  constructor(config: OpenDotaConfig = {}) {
    super();
    this.config = config;
    this.apiUrl = config.apiUrl || 'https://api.opendota.com/api';
    this.minRequestInterval = (60 * 1000) / (config.rateLimit?.requestsPerMinute || 60);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request('/health');
      return !!response;
    } catch (error) {
      this.log('error', 'OpenDota health check failed', error);
      return false;
    }
  }

  async fetchPlayers(filters?: DataProviderFilters): Promise<PlayerData[]> {
    try {
      // OpenDota doesn't have a "professional players" endpoint
      // This would need to be implemented via team rosters
      this.log('warn', 'OpenDota fetchPlayers: Using team rosters instead of direct player query');

      const teams = await this.fetchTeams(filters);
      const players: Map<string, PlayerData> = new Map();

      for (const team of teams) {
        for (const member of team.roster) {
          if (!players.has(member.playerId)) {
            try {
              const player = await this.fetchPlayer(member.playerId);
              players.set(member.playerId, player);
            } catch (error) {
              this.log('warn', `Failed to fetch player ${member.playerId}`, error);
            }
          }
        }
      }

      return Array.from(players.values());
    } catch (error) {
      throw this.createError(
        'OPENDOTA_PLAYERS_FETCH_FAILED',
        `Failed to fetch players from OpenDota: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async fetchPlayer(playerId: string): Promise<PlayerData> {
    try {
      const player = await this.request(`/players/${playerId}`);

      if (!player || !player.profile) {
        throw this.createError(
          'OPENDOTA_PLAYER_NOT_FOUND',
          `Player ${playerId} not found`,
          404,
          false
        );
      }

      return {
        id: String(playerId),
        steamId: String(playerId),
        name: player.profile.personaname || 'Unknown',
        tag: player.profile.name,
        country: player.profile.loccountrycode,
        roles: [], // OpenDota doesn't explicitly provide roles
        team: undefined, // Would need separate team lookup
        isActive: player.profile.last_login ? true : false,
        profileUrl: `https://opendota.com/players/${playerId}`,
        imageUrl: player.profile.avatarfull,
        lastUpdated: new Date(),
      };
    } catch (error) {
      if ((error as DataProviderError).code === 'OPENDOTA_PLAYER_NOT_FOUND') {
        throw error;
      }
      throw this.createError(
        'OPENDOTA_PLAYER_FETCH_FAILED',
        `Failed to fetch player ${playerId} from OpenDota: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async fetchTeams(filters?: DataProviderFilters): Promise<TeamData[]> {
    try {
      const teams = await this.request('/teams');

      if (!Array.isArray(teams)) {
        throw this.createError(
          'OPENDOTA_TEAMS_INVALID',
          'Invalid teams response from OpenDota',
          undefined,
          false
        );
      }

      return teams
        .slice(filters?.offset || 0, (filters?.offset || 0) + (filters?.limit || 100))
        .map((t: any) => ({
          id: String(t.team_id),
          name: t.name,
          tag: t.tag,
          region: undefined,
          country: undefined,
          foundedDate: undefined,
          logoUrl: t.logo_url,
          roster: [], // Would need separate API call per team
          isActive: true,
          lastUpdated: new Date(),
        }));
    } catch (error) {
      throw this.createError(
        'OPENDOTA_TEAMS_FETCH_FAILED',
        `Failed to fetch teams from OpenDota: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async fetchTeam(teamId: string): Promise<TeamData> {
    try {
      const team = await this.request(`/teams/${teamId}`);

      if (!team) {
        throw this.createError(
          'OPENDOTA_TEAM_NOT_FOUND',
          `Team ${teamId} not found`,
          404,
          false
        );
      }

      const roster = await this.request(`/teams/${teamId}/players`);

      return {
        id: String(teamId),
        name: team.name,
        tag: team.tag,
        region: undefined,
        country: team.country,
        foundedDate: team.created_at ? new Date(team.created_at * 1000) : undefined,
        logoUrl: team.logo_url,
        roster: (roster || []).map((r: any) => ({
          playerId: String(r.account_id),
          joinedDate: new Date(r.time_joined * 1000),
          position: undefined,
        })),
        isActive: true,
        lastUpdated: new Date(),
      };
    } catch (error) {
      if ((error as DataProviderError).code === 'OPENDOTA_TEAM_NOT_FOUND') {
        throw error;
      }
      throw this.createError(
        'OPENDOTA_TEAM_FETCH_FAILED',
        `Failed to fetch team ${teamId} from OpenDota: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async fetchTournaments(filters?: DataProviderFilters & { status?: 'upcoming' | 'active' | 'concluded'; minTier?: string }): Promise<TournamentData[]> {
    try {
      // OpenDota has limited tournament data via pro_matches
      // This is a simplified implementation
      const response = await this.request('/pro_matches', {
        less_than_match_id: (filters?.offset || 0).toString(),
        limit: Math.min(filters?.limit || 100, 100).toString(),
      });

      // Group matches by tournament/event
      const tournamentsMap = new Map<string, TournamentData>();

      for (const match of response || []) {
        const tournamentKey = match.series_id?.toString() || match.league_id?.toString();

        if (!tournamentKey) continue;

        if (!tournamentsMap.has(tournamentKey)) {
          tournamentsMap.set(tournamentKey, {
            id: tournamentKey,
            name: match.series_name || `Series ${match.series_id}`,
            region: undefined,
            prizePool: undefined,
            currency: 'USD',
            startDate: new Date(match.start_time * 1000),
            endDate: undefined,
            status: match.radiant_win !== undefined ? 'concluded' : 'upcoming',
            teams: [],
            matches: [],
            tier: 'Professional',
            lastUpdated: new Date(),
          });
        }

        const tournament = tournamentsMap.get(tournamentKey)!;
        if (!tournament.teams?.includes(String(match.radiant_team_id))) {
          tournament.teams?.push(String(match.radiant_team_id));
        }
        if (!tournament.teams?.includes(String(match.dire_team_id))) {
          tournament.teams?.push(String(match.dire_team_id));
        }
        tournament.matches?.push(String(match.match_id));
      }

      return Array.from(tournamentsMap.values());
    } catch (error) {
      throw this.createError(
        'OPENDOTA_TOURNAMENTS_FETCH_FAILED',
        `Failed to fetch tournaments from OpenDota: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async fetchMatches(
    tournamentId?: string,
    filters?: DataProviderFilters & { status?: 'scheduled' | 'live' | 'concluded' }
  ): Promise<MatchData[]> {
    try {
      const response = await this.request('/pro_matches', {
        less_than_match_id: (filters?.offset || 0).toString(),
        limit: Math.min(filters?.limit || 100, 100).toString(),
      });

      return (response || []).map((m: any) => ({
        id: String(m.match_id),
        tournamentId: String(m.series_id || m.league_id),
        team1Id: String(m.radiant_team_id),
        team2Id: String(m.dire_team_id),
        scheduledAt: new Date(m.start_time * 1000),
        startedAt: m.start_time ? new Date(m.start_time * 1000) : undefined,
        endedAt: m.start_time && m.duration ? new Date((m.start_time + m.duration) * 1000) : undefined,
        status: m.radiant_win !== undefined ? 'concluded' : 'upcoming',
        seriesStatus: undefined,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      throw this.createError(
        'OPENDOTA_MATCHES_FETCH_FAILED',
        `Failed to fetch matches from OpenDota: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async fetchMatchDetails(matchId: string): Promise<MatchDetailsData> {
    try {
      const match = await this.request(`/matches/${matchId}`);

      if (!match) {
        throw this.createError(
          'OPENDOTA_MATCH_NOT_FOUND',
          `Match ${matchId} not found`,
          404,
          false
        );
      }

      const radiantPlayers = (match.players || [])
        .filter((p: any) => p.isRadiant)
        .map((p: any) => ({
          playerId: String(p.account_id || 'unknown'),
          heroId: String(p.hero_id),
          heroName: p.hero_name || 'Unknown',
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          goldPerMinute: p.gold_per_min,
          experiencePerMinute: p.xp_per_min,
          lastHits: p.last_hits,
          denies: p.denies,
          heroDamage: p.hero_damage,
          towerDamage: p.tower_damage,
          healing: p.healing,
          wardsPlaced: p.obs_placed,
          wardsDestroyed: p.obs_left,
          firstBloodAchieved: false, // Would need to check match events
          roshansKilled: 0, // Would need to check match events
        }));

      const direPlayers = (match.players || [])
        .filter((p: any) => !p.isRadiant)
        .map((p: any) => ({
          playerId: String(p.account_id || 'unknown'),
          heroId: String(p.hero_id),
          heroName: p.hero_name || 'Unknown',
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          goldPerMinute: p.gold_per_min,
          experiencePerMinute: p.xp_per_min,
          lastHits: p.last_hits,
          denies: p.denies,
          heroDamage: p.hero_damage,
          towerDamage: p.tower_damage,
          healing: p.healing,
          wardsPlaced: p.obs_placed,
          wardsDestroyed: p.obs_left,
          firstBloodAchieved: false,
          roshansKilled: 0,
        }));

      return {
        matchId: String(matchId),
        duration: match.duration,
        winner: match.radiant_win ? String(match.radiant_team_id) : String(match.dire_team_id),
        teams: [
          {
            teamId: String(match.radiant_team_id),
            players: radiantPlayers,
          },
          {
            teamId: String(match.dire_team_id),
            players: direPlayers,
          },
        ],
        lastUpdated: new Date(),
      };
    } catch (error) {
      if ((error as DataProviderError).code === 'OPENDOTA_MATCH_NOT_FOUND') {
        throw error;
      }
      throw this.createError(
        'OPENDOTA_MATCH_DETAILS_FETCH_FAILED',
        `Failed to fetch match ${matchId} details from OpenDota: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async fetchRosterHistory(
    playerId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<RosterChangeData[]> {
    try {
      // OpenDota has limited roster change history
      // This would require tracking team rosters over time
      const response = await this.request(`/players/${playerId}/teammates`);

      // This endpoint shows teammates, not roster history
      // Would need a different approach for true roster history
      this.log('warn', 'OpenDota fetchRosterHistory: Limited roster history data available');

      return [];
    } catch (error) {
      throw this.createError(
        'OPENDOTA_ROSTER_HISTORY_FETCH_FAILED',
        `Failed to fetch roster history for player ${playerId} from OpenDota: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async getRateLimitStatus() {
    return {
      remaining: 1000,
      limit: 1000,
      resetAt: new Date(),
    };
  }

  private async request(
    endpoint: string,
    queryParams?: Record<string, string | number | undefined>
  ): Promise<any> {
    return this.retry(async () => {
      // Rate limiting
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve =>
          setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
        );
      }
      this.lastRequestTime = Date.now();

      const url = new URL(this.apiUrl + endpoint);
      if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== undefined) {
            url.searchParams.append(key, String(value));
          }
        });
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        throw this.createError(
          'OPENDOTA_HTTP_ERROR',
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          retryable
        );
      }

      return response.json();
    });
  }
}
