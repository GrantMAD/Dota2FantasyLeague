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
import { getHeroNameById } from '@/lib/constants/dota-heroes';

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
      // Use /constants/heroes as a lightweight health check endpoint
      const response = await this.request('/constants/heroes');
      return Array.isArray(response) || typeof response === 'object';
    } catch (error) {
      this.log('error', 'OpenDota health check failed', error);
      return false;
    }
  }

  async fetchPlayers(filters?: DataProviderFilters, rawData?: any[]): Promise<PlayerData[]> {
    try {
      // Use pre-fetched raw data if provided (avoids duplicate HTTP call from sync job),
      // otherwise fetch from OpenDota's dedicated /proPlayers endpoint.
      const rawPlayers = rawData ?? await this.request('/proPlayers');

      if (!Array.isArray(rawPlayers)) {
        throw new Error('Invalid proPlayers response from OpenDota');
      }

      // Filter to genuinely active pro players:
      // - Must have a name
      // - Must be flagged as pro by OpenDota
      // - Must be on an active team (team_id must be a real non-zero value)
      // This excludes retired players who still carry is_pro=true but have no team,
      // and players with a stale team_name string but no team_id.
      const validPlayers = rawPlayers.filter(
        (p: any) => p.name && p.is_pro && p.team_id && p.team_id !== 0
      );

      // Map OpenDota fantasy_role integer to role name
      const roleMap: Record<number, string> = {
        1: 'Carry',
        2: 'Support',
        3: 'Offlane',
        4: 'Mid',
      };

      const mapped: PlayerData[] = validPlayers.map((p: any) => {
        const steamId = p.steamid ? String(p.steamid) : String(p.account_id);
        const primaryRole = roleMap[p.fantasy_role] || 'Carry';

        return {
          id: String(p.account_id),
          steamId,
          name: p.name || p.personaname,
          tag: p.team_tag || undefined,
          country: p.country_code || p.loccountrycode || undefined,
          roles: [primaryRole],
          team: p.team_id
            ? {
                id: String(p.team_id),
                name: p.team_name || 'Independent',
              }
            : undefined,
          isActive: true,
          profileUrl: p.profileurl || `https://opendota.com/players/${p.account_id}`,
          imageUrl: p.avatarfull || p.avatarmedium || p.avatar,
          lastUpdated: new Date(),
        };
      });

      const offset = filters?.offset || 0;
      const limit = filters?.limit || mapped.length;
      return mapped.slice(offset, offset + limit);
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

      // Filter to genuine pro teams with non-empty names and valid IDs
      const validTeams = teams.filter(
        (t: any) => t.team_id && t.name && typeof t.name === 'string' && t.name.trim().length > 0
      );

      return validTeams
        .slice(filters?.offset || 0, (filters?.offset || 0) + (filters?.limit || 100))
        .map((t: any) => ({
          id: String(t.team_id),
          name: t.name.trim(),
          tag: (t.tag ? String(t.tag).trim() : '') || t.name.trim().substring(0, 4).toUpperCase(),
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
      // OpenDota has limited tournament data via proMatches
      // This is a simplified implementation
      const queryParams: Record<string, string | number | undefined> = {};
      if (filters?.offset && filters.offset > 0) {
        queryParams.less_than_match_id = filters.offset.toString();
      }
      const response = await this.request('/proMatches', queryParams);

      // Group matches by tournament/event
      const tournamentsMap = new Map<string, TournamentData>();

      for (const match of response || []) {
        const tournamentKey = match.leagueid ? String(match.leagueid) : (match.series_id ? String(match.series_id) : null);

        if (!tournamentKey) continue;

        if (!tournamentsMap.has(tournamentKey)) {
          tournamentsMap.set(tournamentKey, {
            id: tournamentKey,
            name: match.league_name || match.series_name || `Tournament ${tournamentKey}`,
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
        if (match.radiant_team_id && !tournament.teams?.includes(String(match.radiant_team_id))) {
          tournament.teams?.push(String(match.radiant_team_id));
        }
        if (match.dire_team_id && !tournament.teams?.includes(String(match.dire_team_id))) {
          tournament.teams?.push(String(match.dire_team_id));
        }
        if (match.match_id) {
          tournament.matches?.push(String(match.match_id));
        }
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
      const queryParams: Record<string, string | number | undefined> = {};
      if (filters?.offset && filters.offset > 0) {
        queryParams.less_than_match_id = filters.offset.toString();
      }
      const response = await this.request('/proMatches', queryParams);

      return (response || [])
        .filter((m: any) => !tournamentId || String(m.leagueid) === tournamentId || String(m.series_id) === tournamentId)
        .map((m: any) => ({
          id: String(m.match_id),
          tournamentId: String(m.leagueid || m.series_id || tournamentId || '0'),
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

      const parseNumeric = (val: any): number => {
        if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
        if (typeof val === 'string') {
          const parsed = Number(val);
          return isNaN(parsed) ? 0 : Math.round(parsed);
        }
        if (typeof val === 'object' && val !== null) {
          // OpenDota healing can be a dict mapping hero/npc names to healing values
          return Math.round(
            Object.values(val).reduce((sum: number, cur: any) => {
              const num = Number(cur);
              return sum + (isNaN(num) ? 0 : num);
            }, 0)
          );
        }
        return 0;
      };

      const radiantPlayers = (match.players || [])
        .filter((p: any) => p.isRadiant)
        .map((p: any) => ({
          playerId: String(p.account_id || 'unknown'),
          heroId: String(p.hero_id),
          heroName: p.hero_name || getHeroNameById(p.hero_id),
          kills: parseNumeric(p.kills),
          deaths: parseNumeric(p.deaths),
          assists: parseNumeric(p.assists),
          goldPerMinute: parseNumeric(p.gold_per_min),
          experiencePerMinute: parseNumeric(p.xp_per_min),
          lastHits: parseNumeric(p.last_hits),
          denies: parseNumeric(p.denies),
          heroDamage: parseNumeric(p.hero_damage),
          towerDamage: parseNumeric(p.tower_damage),
          healing: parseNumeric(p.hero_healing ?? p.healing),
          wardsPlaced: parseNumeric(p.obs_placed),
          wardsDestroyed: parseNumeric(p.obs_left),
          firstBloodAchieved: false, // Would need to check match events
          roshansKilled: 0, // Would need to check match events
        }));

      const direPlayers = (match.players || [])
        .filter((p: any) => !p.isRadiant)
        .map((p: any) => ({
          playerId: String(p.account_id || 'unknown'),
          heroId: String(p.hero_id),
          heroName: p.hero_name || getHeroNameById(p.hero_id),
          kills: parseNumeric(p.kills),
          deaths: parseNumeric(p.deaths),
          assists: parseNumeric(p.assists),
          goldPerMinute: parseNumeric(p.gold_per_min),
          experiencePerMinute: parseNumeric(p.xp_per_min),
          lastHits: parseNumeric(p.last_hits),
          denies: parseNumeric(p.denies),
          heroDamage: parseNumeric(p.hero_damage),
          towerDamage: parseNumeric(p.tower_damage),
          healing: parseNumeric(p.hero_healing ?? p.healing),
          wardsPlaced: parseNumeric(p.obs_placed),
          wardsDestroyed: parseNumeric(p.obs_left),
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

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'FantasyDota/1.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

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

/**
 * Fetch the raw /proPlayers array from OpenDota exactly once.
 *
 * Exported so sync-players.ts can pre-fetch the data once at the top of the job
 * and reuse it for both role-lookup building AND fallback player mapping,
 * eliminating the duplicate HTTP call that previously fired on every sync run.
 */
export async function fetchRawOpenDotaProPlayers(): Promise<any[]> {
  try {
    const res = await fetch('https://api.opendota.com/api/proPlayers', {
      headers: { 'User-Agent': 'FantasyDota/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`[fetchRawOpenDotaProPlayers] OpenDota returned status ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn(`[fetchRawOpenDotaProPlayers] Failed: ${(error as Error).message}`);
    return [];
  }
}
