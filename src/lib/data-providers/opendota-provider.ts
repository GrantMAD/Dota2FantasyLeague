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

interface OpenDotaProPlayer {
  account_id: number;
  steamid?: string | null;
  name?: string | null;
  personaname?: string | null;
  is_pro?: boolean;
  team_id?: number | null;
  team_name?: string | null;
  team_tag?: string | null;
  fantasy_role?: number | null;
  country_code?: string | null;
  loccountrycode?: string | null;
  profileurl?: string | null;
  avatar?: string | null;
  avatarmedium?: string | null;
  avatarfull?: string | null;
}

interface OpenDotaTeam {
  team_id: number;
  name: string;
  tag?: string | null;
  country?: string | null;
  created_at?: number | null;
  logo_url?: string | null;
}

interface OpenDotaRosterPlayer {
  account_id: number;
  time_joined: number;
}

interface OpenDotaProMatch {
  match_id: number;
  leagueid?: number | null;
  series_id?: number | null;
  league_name?: string | null;
  series_name?: string | null;
  radiant_team_id?: number | null;
  dire_team_id?: number | null;
  start_time: number;
  duration?: number | null;
  radiant_win?: boolean;
}

interface OpenDotaMatchPlayer {
  isRadiant: boolean;
  account_id?: number | null;
  hero_id: number;
  hero_name?: string | null;
  kills?: number | string | null;
  deaths?: number | string | null;
  assists?: number | string | null;
  gold_per_min?: number | string | null;
  xp_per_min?: number | string | null;
  last_hits?: number | string | null;
  denies?: number | string | null;
  hero_damage?: number | string | null;
  tower_damage?: number | string | null;
  hero_healing?: number | string | Record<string, unknown> | null;
  healing?: number | string | Record<string, unknown> | null;
  obs_placed?: number | string | null;
  obs_left?: number | string | null;
}

interface OpenDotaMatchDetails {
  duration: number;
  radiant_win: boolean;
  radiant_team_id: number;
  dire_team_id: number;
  players?: OpenDotaMatchPlayer[] | null;
}

interface OpenDotaPlayerDetails {
  profile?: {
    personaname?: string | null;
    name?: string | null;
    loccountrycode?: string | null;
    last_login?: string | null;
    avatarfull?: string | null;
  } | null;
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
    // OpenDota doesn't require API keys or auth; always treat as available
    return true;
  }

  async fetchPlayers(filters?: DataProviderFilters, rawData?: OpenDotaProPlayer[]): Promise<PlayerData[]> {
    try {
      // Use pre-fetched raw data if provided (avoids duplicate HTTP call from sync job),
      // otherwise fetch from OpenDota's dedicated /proPlayers endpoint.
      const rawPlayers = rawData ?? await this.request<OpenDotaProPlayer[]>('/proPlayers');

      if (!Array.isArray(rawPlayers)) {
        throw new Error('Invalid proPlayers response from OpenDota');
      }

      // Filter to genuinely active pro players:
      // - Must have a name
      // - Must be flagged as pro by OpenDota
      // - Must be on an active team: either a real non-zero team_id OR a valid team_name (e.g. Saberlight, Insania, Fly on Virtus.pro)
      // This excludes retired players who still carry is_pro=true but have no team information at all.
      const validPlayers = rawPlayers.filter(
        (player) =>
          player.name &&
          player.is_pro &&
          ((player.team_id && player.team_id !== 0) || (player.team_name && player.team_name.trim().length > 0))
      );

      // Map OpenDota fantasy_role integer to role name
      const roleMap: Record<number, string> = {
        1: 'Carry',
        2: 'Support',
        3: 'Offlane',
        4: 'Mid',
      };

      const mapped: PlayerData[] = validPlayers.map((p) => {
        const steamId = p.steamid ? String(p.steamid) : String(p.account_id);
        const roleIndex = p.fantasy_role != null ? p.fantasy_role : 0;
        const primaryRole = roleMap[roleIndex] || 'Carry';
        const teamIdStr = p.team_id && p.team_id !== 0 ? String(p.team_id) : undefined;
        const teamNameStr = p.team_name && p.team_name.trim().length > 0 ? p.team_name.trim() : undefined;

        return {
          id: String(p.account_id),
          steamId,
          name: (p.name || p.personaname || `Player ${p.account_id}`).trim(),
          tag: p.team_tag || undefined,
          country: p.country_code || p.loccountrycode || undefined,
          roles: [primaryRole],
          team: (teamIdStr || teamNameStr)
            ? {
                id: teamIdStr || `name-${teamNameStr}`,
                name: teamNameStr || 'Independent',
              }
            : undefined,
          isActive: true,
          profileUrl: p.profileurl || `https://opendota.com/players/${p.account_id}`,
          imageUrl: p.avatarfull || p.avatarmedium || p.avatar || undefined,
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
      const player = await this.request<OpenDotaPlayerDetails>(`/players/${playerId}`);

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
        tag: player.profile.name || undefined,
        country: player.profile.loccountrycode || undefined,
        roles: [], // OpenDota doesn't explicitly provide roles
        team: undefined, // Would need separate team lookup
        isActive: player.profile.last_login ? true : false,
        profileUrl: `https://opendota.com/players/${playerId}`,
        imageUrl: player.profile.avatarfull || undefined,
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
      const teams = await this.request<OpenDotaTeam[]>('/teams');

      if (!Array.isArray(teams)) {
        throw this.createError(
          'OPENDOTA_TEAMS_INVALID',
          'Invalid teams response from OpenDota',
          undefined,
          false
        );
      }

      // Filter to genuine pro teams with non-empty names and valid IDs
      const validTeams = teams.filter((team) => team.team_id && team.name && team.name.trim().length > 0);

      const offset = filters?.offset || 0;
      const limit = filters?.limit !== undefined ? filters.limit : validTeams.length;
      return validTeams
        .slice(offset, offset + limit)
        .map((t) => ({
          id: String(t.team_id),
          name: t.name.trim(),
          tag: (t.tag ? String(t.tag).trim() : '') || t.name.trim().substring(0, 4).toUpperCase(),
          region: undefined,
          country: undefined,
          foundedDate: undefined,
          logoUrl: t.logo_url || undefined,
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
      const team = await this.request<OpenDotaTeam>(`/teams/${teamId}`);

      if (!team) {
        throw this.createError(
          'OPENDOTA_TEAM_NOT_FOUND',
          `Team ${teamId} not found`,
          404,
          false
        );
      }

      const roster = await this.request<OpenDotaRosterPlayer[]>(`/teams/${teamId}/players`);

      return {
        id: String(teamId),
        name: team.name || `Team ${teamId}`,
        tag: team.tag || '',
        region: undefined,
        country: team.country || undefined,
        foundedDate: team.created_at ? new Date(team.created_at * 1000) : undefined,
        logoUrl: team.logo_url || undefined,
        roster: (roster || []).map((r) => ({
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
      const response = await this.request<OpenDotaProMatch[]>('/proMatches', queryParams);

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
      const response = await this.request<OpenDotaProMatch[]>('/proMatches', queryParams);

      return (response || [])
        .filter((match) => !tournamentId || String(match.leagueid) === tournamentId || String(match.series_id) === tournamentId)
        .map((m) => ({
          id: String(m.match_id),
          tournamentId: String(m.leagueid || m.series_id || tournamentId || '0'),
          team1Id: String(m.radiant_team_id),
          team2Id: String(m.dire_team_id),
          scheduledAt: new Date(m.start_time * 1000),
          startedAt: m.start_time ? new Date(m.start_time * 1000) : undefined,
          endedAt: m.start_time && m.duration ? new Date((m.start_time + m.duration) * 1000) : undefined,
          status: m.radiant_win !== undefined ? 'concluded' : 'scheduled',
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
      const match = await this.request<OpenDotaMatchDetails>(`/matches/${matchId}`);

      if (!match) {
        throw this.createError(
          'OPENDOTA_MATCH_NOT_FOUND',
          `Match ${matchId} not found`,
          404,
          false
        );
      }

      const parseNumeric = (val: unknown): number => {
        if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
        if (typeof val === 'string') {
          const parsed = Number(val);
          return isNaN(parsed) ? 0 : Math.round(parsed);
        }
        if (typeof val === 'object' && val !== null) {
          // OpenDota healing can be a dict mapping hero/npc names to healing values
          return Math.round(
            Object.values(val as Record<string, unknown>).reduce((sum: number, cur) => {
              const num = Number(cur);
              return sum + (isNaN(num) ? 0 : num);
            }, 0)
          );
        }
        return 0;
      };

      const radiantPlayers = (match.players || [])
        .filter((player) => player.isRadiant)
        .map((p) => ({
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
        .filter((player) => !player.isRadiant)
        .map((p) => ({
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
    _dateRange?: { from: Date; to: Date }
  ): Promise<RosterChangeData[]> {
    void _dateRange;
    try {
      // OpenDota has limited roster change history
      // This would require tracking team rosters over time
      await this.request<unknown[]>(`/players/${playerId}/teammates`);

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

  private async request<T = unknown>(
    endpoint: string,
    queryParams?: Record<string, string | number | undefined>
  ): Promise<T> {
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
        signal: AbortSignal.timeout(30000),
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

      return await response.json() as T;
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
export async function fetchRawOpenDotaProPlayers(): Promise<OpenDotaProPlayer[]> {
  const response = await fetch('https://api.opendota.com/api/proPlayers', {
    headers: { 'User-Agent': 'FantasyDota/1.0' },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) {
    throw new Error(`OpenDota /proPlayers request failed with status ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('OpenDota /proPlayers returned an invalid response; expected an array');
  }

  const invalidIndex = data.findIndex((player) =>
    typeof player !== 'object' ||
    player === null ||
    !('account_id' in player) ||
    typeof player.account_id !== 'number' ||
    !Number.isSafeInteger(player.account_id) ||
    player.account_id <= 0
  );
  if (invalidIndex !== -1) {
    throw new Error(`OpenDota /proPlayers returned an incomplete player record at index ${invalidIndex}`);
  }

  return data as OpenDotaProPlayer[];
}
