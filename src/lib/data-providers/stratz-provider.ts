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

interface GraphQLError {
  message: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

interface StratzPlayerRecord {
  id: number | string;
  steamId?: number | string | null;
  name?: string | null;
  realName?: string | null;
  countryCode?: string | null;
  roles?: string[] | null;
  isPro?: boolean;
  fantasyRole?: number | null;
  tag?: string | null;
  countries?: string | string[] | null;
  team?: { id: number | string; name: string; tag?: string | null } | null;
  avatar?: string | null;
  profileUri?: string | null;
  profileUrl?: string | null;
  steam?: { avatar?: string | null; profileUrl?: string | null } | null;
  teams?: StratzRosterTeam[] | null;
}

interface StratzProSteamAccountRecord {
  steamAccountId: number | string | null;
  name?: string | null;
  isPro?: boolean;
  fantasyRole?: number | null;
  team?: { id: number | string; name: string; tag?: string | null } | null;
  countries?: string | string[] | null;
  steam?: { avatar?: string | null; profileUrl?: string | null } | null;
}

interface StratzRosterTeam {
  id: number | string;
  name?: string;
  joinedDate: string;
  leftDate?: string | null;
}

interface StratzTeamRecord {
  id: number | string;
  name: string;
  tag?: string | null;
  countryCode?: string | null;
  founded?: string | null;
  logo?: string | null;
  players?: Array<{ id: number | string; joinedDate?: string | null }> | null;
}

interface StratzLeagueRecord {
  id: number | string;
  name: string;
  region?: string | null;
  prizePool?: number | null;
  startDate: string;
  endDate?: string | null;
  status: string;
  teams?: Array<{ id: number | string }> | null;
  matches?: Array<{ id: number | string }> | null;
}

interface StratzMatchRecord {
  id: number | string;
  leagueId: number | string;
  radiantTeamId: number | string;
  direTeamId: number | string;
  startDateTime: string;
  endDateTime?: string | null;
  status: string;
  series?: { radiantWins: number; direWins: number } | null;
}

interface StratzMatchPlayerRecord {
  id: number | string;
  heroId?: number | string | null;
  isRadiant: boolean;
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
  hero?: { displayName?: string | null; shortName?: string | null } | null;
}

interface StratzDetailedMatchRecord {
  id: number | string;
  durationSeconds: number;
  radiantTeamId: number | string;
  direTeamId: number | string;
  isRadiantVictory: boolean;
  players: StratzMatchPlayerRecord[];
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
  private requestQueue: Array<() => Promise<unknown>> = [];
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
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'STRATZ_API',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ query: 'query { constants { gameVersions { id name } } }' }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return false;

      const payload = await response.json() as GraphQLResponse<{
        constants?: { gameVersions?: unknown[] };
      }>;
      return Boolean(payload.data?.constants && !payload.errors?.length);
    } catch (error) {
      this.log('error', 'STRATZ health check failed', error);
      return false;
    }
  }

  async fetchPlayers(filters?: DataProviderFilters): Promise<PlayerData[]> {
    try {
      // STRATZ API v2 schema: bulk pro player data is via proSteamAccounts.
      // The old player(request: { isLive: true }) query was removed; player()
      // now requires steamAccountId for single-player lookups only.
      const query = `
        query GetProPlayers {
          proSteamAccounts {
            steamAccountId
            name
            isPro
            fantasyRole
            team {
              id
              name
              tag
            }
            countries
            steam {
              avatar
              profileUrl
            }
          }
        }
      `;

      const response = await this.graphqlRequest<{ proSteamAccounts?: StratzProSteamAccountRecord[] }>(query);
      const accounts = response.data?.proSteamAccounts;
      if (!Array.isArray(accounts)) {
        throw new Error('STRATZ proSteamAccounts response is missing or invalid');
      }

      for (const account of accounts) {
        const steamAccountId = String(account.steamAccountId ?? '').trim();
        if (!/^\d+$/.test(steamAccountId) || !Number.isSafeInteger(Number(steamAccountId)) || Number(steamAccountId) <= 0) {
          throw new Error('STRATZ pro player record is missing a valid steamAccountId');
        }
      }

      const roleMap: Record<number, string> = {
        1: 'Carry',
        2: 'Support',
        3: 'Offlane',
        4: 'Mid',
        5: 'Hard Support',
      };

      // Filter to genuinely active players: must have a name, be flagged pro,
      // and be on a team — mirrors OpenDota new filter logic.
      const activePlayers = accounts.filter((account) => account.name && account.isPro && account.team?.id);

      const offset = filters?.offset || 0;
      const limit = filters?.limit || activePlayers.length;

      return activePlayers.slice(offset, offset + limit).map((a) => ({
        id: String(a.steamAccountId),
        steamId: String(a.steamAccountId),
        name: a.name ?? '',
        tag: a.team?.tag ?? undefined,
        country: Array.isArray(a.countries) ? a.countries[0] : (a.countries ?? undefined),
        roles: a.fantasyRole ? [roleMap[a.fantasyRole] || 'Carry'] : ['Carry'],
        team: a.team
          ? { id: String(a.team.id), name: a.team.name }
          : undefined,
        isActive: true,
        profileUrl: a.steam?.profileUrl ?? undefined,
        imageUrl: a.steam?.avatar ?? undefined,
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

      const response = await this.graphqlRequest<{ player?: StratzPlayerRecord[] }>(query);
      const p = response.data?.player?.[0];

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
        steamId: p.steamId ? String(p.steamId) : String(p.id),
        name: p.name ?? p.realName ?? '',
        tag: p.tag ?? undefined,
        country: p.countryCode ?? undefined,
        roles: p.roles || [],
        team: p.team
          ? {
              id: String(p.team.id),
              name: p.team.name,
            }
          : undefined,
        isActive: true,
        profileUrl: p.profileUri ? `https://stratz.com${p.profileUri}` : undefined,
        imageUrl: p.avatar ?? undefined,
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

      const response = await this.graphqlRequest<{ team?: StratzTeamRecord[] }>(query);
      const teams = response.data?.team;
      if (!Array.isArray(teams)) {
        throw new Error('STRATZ team response is missing or invalid');
      }

      return teams.map((t) => ({
        id: String(t.id),
        name: t.name || `Team ${t.id}`,
        tag: t.tag || t.name?.slice(0, 4) || 'D2',
        region: t.countryCode || undefined,
        country: t.countryCode || undefined,
        foundedDate: t.founded ? new Date(t.founded) : undefined,
        logoUrl: t.logo || undefined,
        roster: (t.players || []).map((p) => ({
          playerId: String(p.id),
          joinedDate: p.joinedDate ? new Date(p.joinedDate) : new Date(),
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

      const response = await this.graphqlRequest<{ team?: StratzTeamRecord[] }>(query);
      const t = response.data?.team?.[0];

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
        name: t.name || `Team ${t.id}`,
        tag: t.tag || t.name?.slice(0, 4) || 'D2',
        region: t.countryCode || undefined,
        country: t.countryCode || undefined,
        foundedDate: t.founded ? new Date(t.founded) : undefined,
        logoUrl: t.logo || undefined,
        roster: (t.players || []).map((p) => ({
          playerId: String(p.id),
          joinedDate: p.joinedDate ? new Date(p.joinedDate) : new Date(),
          position: undefined,
        })),
        isActive: true,
        lastUpdated: new Date(),
      };
    } catch (error) {
      if ((error as DataProviderError).code === 'STRATZ_TEAM_NOT_FOUND') throw error;
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

      const response = await this.graphqlRequest<{ league?: StratzLeagueRecord[] }>(query);
      const leagues = response.data?.league;
      if (!Array.isArray(leagues)) {
        throw new Error('STRATZ league response is missing or invalid');
      }

      return leagues.map((l) => ({
        id: String(l.id),
        name: l.name,
        region: l.region || undefined,
        prizePool: l.prizePool ?? undefined,
        currency: 'USD',
        startDate: new Date(l.startDate),
        endDate: l.endDate ? new Date(l.endDate) : undefined,
        status: this.mapTournamentStatus(l.status),
        teams: (l.teams || []).map((t) => String(t.id)),
        matches: (l.matches || []).map((m) => String(m.id)),
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
      const query = `
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

      const response = await this.graphqlRequest<{ match?: StratzMatchRecord[] }>(query);
      const matches = response.data?.match;
      if (!Array.isArray(matches)) {
        throw new Error('STRATZ match response is missing or invalid');
      }

      return matches.map((m) => ({
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
              hero {
                displayName
                shortName
              }
            }
          }
        }
      `;

      const response = await this.graphqlRequest<{ match?: StratzDetailedMatchRecord[] }>(query);
      const m = response.data?.match?.[0];

      if (!m) {
        throw this.createError(
          'STRATZ_MATCH_NOT_FOUND',
          `Match ${matchId} not found`,
          404,
          false
        );
      }

      // Group players by team
      const radiantPlayers = m.players.filter((player) => player.isRadiant);
      const direPlayers = m.players.filter((player) => !player.isRadiant);

      return {
        matchId: String(m.id),
        duration: m.durationSeconds,
        winner: m.isRadiantVictory ? String(m.radiantTeamId) : String(m.direTeamId),
        teams: [
          {
            teamId: String(m.radiantTeamId),
            players: radiantPlayers.map((p) => ({
              playerId: String(p.id),
              heroId: String(p.heroId),
              heroName: p.hero?.displayName || p.hero?.shortName || (p.heroId ? String(p.heroId) : 'Hero'),
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
            players: direPlayers.map((p) => ({
              playerId: String(p.id),
              heroId: String(p.heroId),
              heroName: p.hero?.displayName || p.hero?.shortName || (p.heroId ? String(p.heroId) : 'Hero'),
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
      if ((error as DataProviderError).code === 'STRATZ_MATCH_NOT_FOUND') throw error;
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

      const response = await this.graphqlRequest<{ player?: StratzPlayerRecord[] }>(query);
      const teams = response.data?.player?.[0]?.teams || [];

      return teams
        .filter((t) => {
          if (!dateRange) return true;
          const joinedDate = new Date(t.joinedDate);
          return joinedDate >= dateRange.from && joinedDate <= dateRange.to;
        })
        .map((t) => ({
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

  private async graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResponse<T>> {
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
          'User-Agent': 'STRATZ_API',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(15000),
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
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch {
          // ignore
        }
        const retryable = response.status >= 500 || response.status === 429;
        throw this.createError(
          'STRATZ_HTTP_ERROR',
          `HTTP ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`,
          response.status,
          retryable
        );
      }

      const data = await response.json() as GraphQLResponse<T>;

      if (data.errors) {
        const errorMsg = data.errors
          .map((error) => error.message)
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
