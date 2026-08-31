/**
 * STRATZ Data Provider
 * 
 * Implements data fetching from STRATZ GraphQL API
 * API Docs: https://stratz.com/api
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

interface StratzConfig {
  apiUrl: string;
  apiKey: string;
  rateLimit?: {
    requestsPerMinute: number;
    timeout?: number;
  };
}

interface RateLimitState {
  remaining: number;
  limit: number;
  resetAt: Date;
}

export class StratzProvider extends DataProviderBase implements DataProvider {
  name = 'STRATZ';
  version = '1.0.0';

  private config: StratzConfig;
  private rateLimitState: RateLimitState = {
    remaining: 1000,
    limit: 1000,
    resetAt: new Date(),
  };
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;

  constructor(config: StratzConfig) {
    super();
    if (!config.apiKey) {
      throw new Error('STRATZ_API_KEY is required');
    }
    this.config = {
      ...config,
      rateLimit: config.rateLimit || { requestsPerMinute: 60 },
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const query = `query { league(request: {leagueId: 1}) { id name } }`;
      const response = await this.graphqlRequest(query);
      return !!response?.data?.league;
    } catch (error) {
      this.log('error', 'STRATZ health check failed', error);
      return false;
    }
  }

  async fetchPlayers(filters?: DataProviderFilters): Promise<PlayerData[]> {
    try {
      const query = `
        query {
          player(request: {
            skip: ${filters?.offset || 0}
            take: ${Math.min(filters?.limit || 500, 500)}
            isLive: ${filters?.activeOnly !== false}
          }) {
            id
            steamId
            name
            realName
            countryCode
            roles
            team(request: {}) {
              id
              name
              tag
            }
            avatar
            profileUri
          }
        }
      `;

      const response = await this.graphqlRequest(query);
      const players = response?.data?.player || [];

      return players.map((p: any) => ({
        id: String(p.id),
        steamId: String(p.steamId),
        name: p.name || p.realName,
        tag: p.tag,
        country: p.countryCode,
        roles: p.roles || [],
        team: p.team
          ? {
              id: String(p.team.id),
              name: p.team.name,
            }
          : undefined,
        isActive: true,
        profileUrl: p.profileUri ? `https://stratz.com${p.profileUri}` : undefined,
        imageUrl: p.avatar,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      throw this.createError(
        'STRATZ_PLAYERS_FETCH_FAILED',
        `Failed to fetch players from STRATZ: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async fetchPlayer(playerId: string): Promise<PlayerData> {
    try {
      const query = `
        query {
          player(request: { id: ${playerId} }) {
            id
            steamId
            name
            realName
            countryCode
            roles
            team(request: {}) {
              id
              name
              tag
            }
            avatar
            profileUri
          }
        }
      `;

      const response = await this.graphqlRequest(query);
      const p = response?.data?.player?.[0];

      if (!p) {
        throw this.createError(
          'STRATZ_PLAYER_NOT_FOUND',
          `Player ${playerId} not found`,
          404,
          false
        );
      }

      return {
        id: String(p.id),
        steamId: String(p.steamId),
        name: p.name || p.realName,
        tag: p.tag,
        country: p.countryCode,
        roles: p.roles || [],
        team: p.team
          ? {
              id: String(p.team.id),
              name: p.team.name,
            }
          : undefined,
        isActive: true,
        profileUrl: p.profileUri ? `https://stratz.com${p.profileUri}` : undefined,
        imageUrl: p.avatar,
        lastUpdated: new Date(),
      };
    } catch (error) {
      if ((error as DataProviderError).code === 'STRATZ_PLAYER_NOT_FOUND') {
        throw error;
      }
      throw this.createError(
        'STRATZ_PLAYER_FETCH_FAILED',
        `Failed to fetch player ${playerId} from STRATZ: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async fetchTeams(filters?: DataProviderFilters): Promise<TeamData[]> {
    try {
      const query = `
        query {
          team(request: {
            skip: ${filters?.offset || 0}
            take: ${Math.min(filters?.limit || 500, 500)}
            isLive: ${filters?.activeOnly !== false}
          }) {
            id
            name
            tag
            countryCode
            founded
            logo
            players {
              id
              steamId
              name
              joinedDate
            }
          }
        }
      `;

      const response = await this.graphqlRequest(query);
      const teams = response?.data?.team || [];

      return teams.map((t: any) => ({
        id: String(t.id),
        name: t.name,
        tag: t.tag,
        region: t.countryCode,
        country: t.countryCode,
        foundedDate: t.founded ? new Date(t.founded) : undefined,
        logoUrl: t.logo,
        roster: (t.players || []).map((p: any) => ({
          playerId: String(p.id),
          joinedDate: new Date(p.joinedDate),
          position: undefined,
        })),
        isActive: true,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      throw this.createError(
        'STRATZ_TEAMS_FETCH_FAILED',
        `Failed to fetch teams from STRATZ: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async fetchTeam(teamId: string): Promise<TeamData> {
    try {
      const query = `
        query {
          team(request: { id: ${teamId} }) {
            id
            name
            tag
            countryCode
            founded
            logo
            players {
              id
              steamId
              name
              joinedDate
            }
          }
        }
      `;

      const response = await this.graphqlRequest(query);
      const t = response?.data?.team?.[0];

      if (!t) {
        throw this.createError(
          'STRATZ_TEAM_NOT_FOUND',
          `Team ${teamId} not found`,
          404,
          false
        );
      }

      return {
        id: String(t.id),
        name: t.name,
        tag: t.tag,
        region: t.countryCode,
        country: t.countryCode,
        foundedDate: t.founded ? new Date(t.founded) : undefined,
        logoUrl: t.logo,
        roster: (t.players || []).map((p: any) => ({
          playerId: String(p.id),
          joinedDate: new Date(p.joinedDate),
          position: undefined,
        })),
        isActive: true,
        lastUpdated: new Date(),
      };
    } catch (error) {
      if ((error as DataProviderError).code === 'STRATZ_TEAM_NOT_FOUND') {
        throw error;
      }
      throw this.createError(
        'STRATZ_TEAM_FETCH_FAILED',
        `Failed to fetch team ${teamId} from STRATZ: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async fetchTournaments(filters?: DataProviderFilters & { status?: 'upcoming' | 'active' | 'concluded'; minTier?: string }): Promise<TournamentData[]> {
    try {
      // STRATZ doesn't have a direct tournament list, so we fetch recently updated leagues
      const query = `
        query {
          league(request: {
            skip: ${filters?.offset || 0}
            take: ${Math.min(filters?.limit || 100, 100)}
          }) {
            id
            name
            region
            prizePool
            startDate
            endDate
            status
            teams {
              id
            }
            matches {
              id
            }
          }
        }
      `;

      const response = await this.graphqlRequest(query);
      const leagues = response?.data?.league || [];

      return leagues.map((l: any) => ({
        id: String(l.id),
        name: l.name,
        region: l.region,
        prizePool: l.prizePool,
        currency: 'USD',
        startDate: new Date(l.startDate),
        endDate: l.endDate ? new Date(l.endDate) : undefined,
        status: this.mapTournamentStatus(l.status),
        teams: (l.teams || []).map((t: any) => String(t.id)),
        matches: (l.matches || []).map((m: any) => String(m.id)),
        tier: 'Major', // Simplified - STRATZ may have tier info
        lastUpdated: new Date(),
      }));
    } catch (error) {
      throw this.createError(
        'STRATZ_TOURNAMENTS_FETCH_FAILED',
        `Failed to fetch tournaments from STRATZ: ${(error as Error).message}`,
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
      let query = `
        query {
          match(request: {
            ${tournamentId ? `leagueId: ${tournamentId}` : ''}
            skip: ${filters?.offset || 0}
            take: ${Math.min(filters?.limit || 100, 100)}
          }) {
            id
            leagueId
            radiantTeamId
            direTeamId
            startDateTime
            endDateTime
            status
            series {
              radiantWins
              direWins
            }
          }
        }
      `;

      const response = await this.graphqlRequest(query);
      const matches = response?.data?.match || [];

      return matches.map((m: any) => ({
        id: String(m.id),
        tournamentId: String(m.leagueId),
        team1Id: String(m.radiantTeamId),
        team2Id: String(m.direTeamId),
        scheduledAt: new Date(m.startDateTime),
        startedAt: m.startDateTime ? new Date(m.startDateTime) : undefined,
        endedAt: m.endDateTime ? new Date(m.endDateTime) : undefined,
        status: this.mapMatchStatus(m.status),
        seriesStatus: m.series
          ? {
              team1Wins: m.series.radiantWins,
              team2Wins: m.series.direWins,
            }
          : undefined,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      throw this.createError(
        'STRATZ_MATCHES_FETCH_FAILED',
        `Failed to fetch matches from STRATZ: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async fetchMatchDetails(matchId: string): Promise<MatchDetailsData> {
    try {
      const query = `
        query {
          match(request: { id: ${matchId} }) {
            id
            durationSeconds
            radiantTeamId
            direTeamId
            isRadiantVictory
            players {
              id
              heroId
              isRadiant
              kills
              deaths
              assists
              goldPerMinute
              experiencePerMinute
              lastHits
              denies
              heroDamage
              towerDamage
              healing
              wardsPlaced
              wardsDestroyed
              firstBloodAchieved
              roshansKilled
            }
          }
        }
      `;

      const response = await this.graphqlRequest(query);
      const m = response?.data?.match?.[0];

      if (!m) {
        throw this.createError(
          'STRATZ_MATCH_NOT_FOUND',
          `Match ${matchId} not found`,
          404,
          false
        );
      }

      // Group players by team
      const radiantPlayers = m.players.filter((p: any) => p.isRadiant);
      const direPlayers = m.players.filter((p: any) => !p.isRadiant);

      return {
        matchId: String(m.id),
        duration: m.durationSeconds,
        winner: m.isRadiantVictory ? String(m.radiantTeamId) : String(m.direTeamId),
        teams: [
          {
            teamId: String(m.radiantTeamId),
            players: radiantPlayers.map((p: any) => ({
              playerId: String(p.id),
              heroId: String(p.heroId),
              heroName: p.heroId, // TODO: Map hero ID to name
              kills: p.kills,
              deaths: p.deaths,
              assists: p.assists,
              goldPerMinute: p.goldPerMinute,
              experiencePerMinute: p.experiencePerMinute,
              lastHits: p.lastHits,
              denies: p.denies,
              heroDamage: p.heroDamage,
              towerDamage: p.towerDamage,
              healing: p.healing,
              wardsPlaced: p.wardsPlaced,
              wardsDestroyed: p.wardsDestroyed,
              firstBloodAchieved: p.firstBloodAchieved,
              roshansKilled: p.roshansKilled,
            })),
          },
          {
            teamId: String(m.direTeamId),
            players: direPlayers.map((p: any) => ({
              playerId: String(p.id),
              heroId: String(p.heroId),
              heroName: p.heroId, // TODO: Map hero ID to name
              kills: p.kills,
              deaths: p.deaths,
              assists: p.assists,
              goldPerMinute: p.goldPerMinute,
              experiencePerMinute: p.experiencePerMinute,
              lastHits: p.lastHits,
              denies: p.denies,
              heroDamage: p.heroDamage,
              towerDamage: p.towerDamage,
              healing: p.healing,
              wardsPlaced: p.wardsPlaced,
              wardsDestroyed: p.wardsDestroyed,
              firstBloodAchieved: p.firstBloodAchieved,
              roshansKilled: p.roshansKilled,
            })),
          },
        ],
        lastUpdated: new Date(),
      };
    } catch (error) {
      if ((error as DataProviderError).code === 'STRATZ_MATCH_NOT_FOUND') {
        throw error;
      }
      throw this.createError(
        'STRATZ_MATCH_DETAILS_FETCH_FAILED',
        `Failed to fetch match ${matchId} details from STRATZ: ${(error as Error).message}`,
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
      const query = `
        query {
          player(request: { id: ${playerId} }) {
            teams {
              id
              name
              joinedDate
              leftDate
            }
          }
        }
      `;

      const response = await this.graphqlRequest(query);
      const teams = response?.data?.player?.[0]?.teams || [];

      return teams
        .filter((t: any) => {
          if (!dateRange) return true;
          const joinedDate = new Date(t.joinedDate);
          return joinedDate >= dateRange.from && joinedDate <= dateRange.to;
        })
        .map((t: any) => ({
          teamId: String(t.id),
          playerId: playerId,
          changeType: 'joined' as const,
          changedAt: new Date(t.joinedDate),
          previousTeam: undefined,
          role: undefined,
        }));
    } catch (error) {
      throw this.createError(
        'STRATZ_ROSTER_HISTORY_FETCH_FAILED',
        `Failed to fetch roster history for player ${playerId} from STRATZ: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  async getRateLimitStatus() {
    return this.rateLimitState;
  }

  private async graphqlRequest(query: string, variables?: Record<string, any>): Promise<any> {
    return this.retry(async () => {
      // Check rate limit
      if (this.rateLimitState.remaining <= 0) {
        const waitMs = this.rateLimitState.resetAt.getTime() - Date.now();
        if (waitMs > 0) {
          this.log('warn', `Rate limit exceeded. Waiting ${waitMs}ms`, {
            remaining: this.rateLimitState.remaining,
            resetAt: this.rateLimitState.resetAt,
          });
          await new Promise(resolve => setTimeout(resolve, waitMs + 100));
        }
      }

      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ query, variables }),
      });

      // Update rate limit from response headers
      const remaining = response.headers.get('x-ratelimit-remaining');
      const limit = response.headers.get('x-ratelimit-limit');
      const reset = response.headers.get('x-ratelimit-reset');

      if (remaining && limit && reset) {
        this.rateLimitState = {
          remaining: parseInt(remaining),
          limit: parseInt(limit),
          resetAt: new Date(parseInt(reset) * 1000),
        };
      }

      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        throw this.createError(
          'STRATZ_HTTP_ERROR',
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          retryable
        );
      }

      const data = await response.json();

      if (data.errors) {
        const errorMsg = data.errors
          .map((e: any) => e.message)
          .join('; ');
        throw this.createError(
          'STRATZ_GRAPHQL_ERROR',
          `GraphQL error: ${errorMsg}`,
          undefined,
          false
        );
      }

      return data;
    });
  }

  private mapTournamentStatus(
    status: string
  ): 'upcoming' | 'active' | 'concluded' {
    const statusMap: Record<string, 'upcoming' | 'active' | 'concluded'> = {
      upcoming: 'upcoming',
      live: 'active',
      ended: 'concluded',
      active: 'active',
    };
    return statusMap[status.toLowerCase()] || 'upcoming';
  }

  private mapMatchStatus(status: string): 'scheduled' | 'live' | 'concluded' {
    const statusMap: Record<string, 'scheduled' | 'live' | 'concluded'> = {
      scheduled: 'scheduled',
      live: 'live',
      concluded: 'concluded',
      finished: 'concluded',
      ended: 'concluded',
    };
    return statusMap[status.toLowerCase()] || 'scheduled';
  }
}
