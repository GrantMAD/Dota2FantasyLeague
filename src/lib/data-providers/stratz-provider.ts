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
  id: number | string | null;
  name?: string | null;
  isPro?: boolean;
  fantasyRole?: number | null;
  team?: {
    id: number | string;
    name: string;
    tag?: string | null;
    countryCode?: string | null;
    logo?: string | null;
  } | null;
  countries?: string | string[] | null;
  steam?: { avatar?: string | null; profileUrl?: string | null } | null;
}

interface StratzRosterTeam {
  id: number | string;
  name?: string;
  joinedDate: string;
  leftDate?: string | null;
}

interface StratzTeamMember {
  steamAccountId: number | string;
  firstMatchDateTime?: number | string | null;
}

interface StratzTeamDetailRecord {
  id: number | string;
  name: string;
  tag?: string | null;
  countryCode?: string | null;
  logo?: string | null;
  members?: StratzTeamMember[] | null;
}

interface StratzLeagueRecord {
  id: number | string;
  name?: string | null;
  displayName?: string | null;
  region?: string | null;
  prizePool?: number | null;
  tier?: string | null;
  startDateTime: number | string;
  endDateTime?: number | string | null;
  hasLiveMatches?: boolean | null;
}

const PROFESSIONAL_LEAGUE_TIERS = new Set([
  'PROFESSIONAL',
  'MINOR',
  'MAJOR',
  'INTERNATIONAL',
  'DPC_QUALIFIER',
  'DPC_LEAGUE_QUALIFIER',
  'DPC_LEAGUE',
  'DPC_LEAGUE_FINALS',
]);

export function mapStratzTournamentStatus(
  hasLiveMatches: boolean,
  startDateTime: number | string,
  endDateTime: number | string | null | undefined,
  now = Date.now()
): 'upcoming' | 'active' | 'concluded' {
  if (hasLiveMatches) return 'active';
  const start = Number(startDateTime) * 1000;
  const end = endDateTime == null ? Number.NaN : Number(endDateTime) * 1000;
  if (Number.isFinite(end) && end > 0 && end < now) return 'concluded';
  if (Number.isFinite(start) && start > now) return 'upcoming';
  return 'active';
}

interface StratzMatchRecord {
  id: number | string;
  leagueId: number | string;
  seriesId?: number | string | null;
  radiantTeamId: number | string;
  direTeamId: number | string;
  startDateTime: number | string;
  endDateTime?: number | string | null;
  durationSeconds?: number | null;
  didRadiantWin?: boolean | null;
  series?: { teamOneWinCount: number; teamTwoWinCount: number } | null;
}

interface StratzLiveMatchRecord {
  matchId: number | string;
  leagueId: number | string;
  radiantTeamId: number | string;
  direTeamId: number | string;
  completed: boolean;
  createdDateTime: number | string;
}

interface StratzLeagueNode {
  id: number | string;
  nodeGroupId: number | string;
  seriesId?: number | string | null;
  scheduledTime?: number | string | null;
  teamOneId?: number | string | null;
  teamTwoId?: number | string | null;
  hasStarted?: boolean | null;
  isCompleted?: boolean | null;
}

export function mapStratzMatchStatus(
  match: Pick<StratzMatchRecord, 'startDateTime' | 'endDateTime' | 'durationSeconds' | 'didRadiantWin'>,
  isLive = false,
  now = Date.now()
): 'scheduled' | 'live' | 'concluded' {
  if (isLive) return 'live';
  if (
    (match.endDateTime != null && Number(match.endDateTime) > 0) ||
    (match.durationSeconds != null && match.durationSeconds > 0)
  ) {
    return 'concluded';
  }
  return Number(match.startDateTime) * 1000 > now ? 'scheduled' : 'live';
}

interface StratzMatchPlayerRecord {
  steamAccountId: number | string;
  heroId?: number | string | null;
  isRadiant: boolean;
  kills: number;
  deaths: number;
  assists: number;
  goldPerMinute: number;
  experiencePerMinute: number;
  numLastHits: number;
  numDenies: number;
  heroDamage: number;
  towerDamage: number;
  heroHealing: number;
  hero?: { displayName?: string | null; shortName?: string | null } | null;
}

interface StratzDetailedMatchRecord {
  id: number | string;
  durationSeconds: number;
  radiantTeamId: number | string;
  direTeamId: number | string;
  didRadiantWin: boolean;
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
      // STRATZ API schema: bulk pro player data is via constants.proSteamAccounts.
      // The account identifier is `id`; player() requires steamAccountId for
      // single-player lookups only.
      const query = `
        query GetProPlayers {
          constants {
            proSteamAccounts {
              id
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
        }
      `;

      const response = await this.graphqlRequest<{ constants?: { proSteamAccounts?: StratzProSteamAccountRecord[] } }>(query);
      const accounts = response.data?.constants?.proSteamAccounts;
      if (!Array.isArray(accounts)) {
        throw new Error('STRATZ proSteamAccounts response is missing or invalid');
      }

      for (const account of accounts) {
        const steamAccountId = String(account.id ?? '').trim();
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
        id: String(a.id),
        steamId: String(a.id),
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
        query GetProTeams {
          constants {
            proSteamAccounts {
              id
              name
              isPro
              team {
                id
                name
                tag
                countryCode
                logo
              }
            }
          }
        }
      `;

      const response = await this.graphqlRequest<{ constants?: { proSteamAccounts?: StratzProSteamAccountRecord[] } }>(query);
      const accounts = response.data?.constants?.proSteamAccounts;
      if (!Array.isArray(accounts)) {
        throw new Error('STRATZ proSteamAccounts response is missing or invalid');
      }

      const teamsById = new Map<string, TeamData>();
      for (const account of accounts) {
        const team = account.team;
        if (!account.isPro || !team?.id || !team.name) continue;

        const id = String(team.id);
        if (!/^\d+$/.test(id)) continue;
        let mappedTeam = teamsById.get(id);
        if (!mappedTeam) {
          mappedTeam = {
            id,
            name: team.name,
            tag: team.tag || team.name.slice(0, 4).toUpperCase(),
            region: team.countryCode || undefined,
            country: team.countryCode || undefined,
            logoUrl: team.logo || undefined,
            roster: [],
            isActive: true,
            lastUpdated: new Date(),
          };
          teamsById.set(id, mappedTeam);
        }

        const playerId = String(account.id ?? '').trim();
        if (/^\d+$/.test(playerId) && !mappedTeam.roster.some((player) => player.playerId === playerId)) {
          mappedTeam.roster.push({ playerId, joinedDate: new Date() });
        }
      }

      const teams = [...teamsById.values()];
      const offset = Math.max(0, filters?.offset ?? 0);
      const limit = Math.min(Math.max(0, filters?.limit ?? teams.length), 500);
      return teams.slice(offset, offset + limit);
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
      const numericTeamId = Number(teamId);
      if (!/^[1-9]\d*$/.test(teamId) || !Number.isSafeInteger(numericTeamId)) {
        throw this.createError(
          'STRATZ_TEAM_NOT_FOUND',
          `Team ${teamId} not found`,
          404,
          false
        );
      }
      const query = `
        query GetTeam($teamId: Int!) {
          team(teamId: $teamId) {
            id
            name
            tag
            countryCode
            logo
            members {
              steamAccountId
              firstMatchDateTime
            }
          }
        }
      `;

      const response = await this.graphqlRequest<{ team?: StratzTeamDetailRecord }>(query, {
        teamId: numericTeamId,
      });
      const t = response.data?.team;

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
        logoUrl: t.logo || undefined,
        roster: (t.members || []).map((member) => ({
          playerId: String(member.steamAccountId),
          joinedDate: member.firstMatchDateTime
            ? new Date(Number(member.firstMatchDateTime) * 1000)
            : new Date(),
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
      const query = `
        query {
          leagues(request: {
            skip: ${filters?.offset || 0}
            take: ${Math.min(filters?.limit || 100, 100)}
            requireStartAndEndDates: true
            tiers: [${[...PROFESSIONAL_LEAGUE_TIERS].join(', ')}]
          }) {
            id
            name
            displayName
            region
            prizePool
            tier
            startDateTime
            endDateTime
            hasLiveMatches
          }
        }
      `;

      const response = await this.graphqlRequest<{ leagues?: Array<StratzLeagueRecord | null> }>(query);
      const leagues = response.data?.leagues;
      if (!Array.isArray(leagues)) {
        throw new Error('STRATZ leagues response is missing or invalid');
      }

      const validLeagues: Array<{ league: StratzLeagueRecord; name: string }> = [];
      const skippedLeagues: Array<{ id: number | string | undefined; reason: string }> = [];
      for (const league of leagues) {
        const name = league?.displayName?.trim() || league?.name?.trim();
        if (!league || !String(league.id ?? '').trim()) {
          skippedLeagues.push({ id: league?.id, reason: 'missing ID' });
          continue;
        }
        if (!name) {
          skippedLeagues.push({ id: league.id, reason: 'missing name and displayName' });
          continue;
        }
        if (!Number.isFinite(Number(league.startDateTime)) || Number(league.startDateTime) <= 0) {
          skippedLeagues.push({ id: league.id, reason: 'missing start date' });
          continue;
        }
        if (!PROFESSIONAL_LEAGUE_TIERS.has(league.tier ?? '')) {
          skippedLeagues.push({ id: league.id, reason: `non-professional tier: ${league.tier ?? 'unset'}` });
          continue;
        }
        validLeagues.push({ league, name });
      }
      if (skippedLeagues.length > 0) {
        this.log('warn', `Skipped ${skippedLeagues.length} STRATZ leagues with incomplete data`, {
          examples: skippedLeagues.slice(0, 10),
        });
      }

      return validLeagues
        .map(({ league, name }) => ({
          id: String(league.id),
          name,
          region: league.region || undefined,
          prizePool: league.prizePool ?? undefined,
          currency: 'USD',
          startDate: new Date(Number(league.startDateTime) * 1000),
          endDate: league.endDateTime == null
            ? undefined
            : new Date(Number(league.endDateTime) * 1000),
          status: mapStratzTournamentStatus(
            league.hasLiveMatches ?? false,
            league.startDateTime,
            league.endDateTime
          ),
          teams: [],
          tier: league.tier || undefined,
          lastUpdated: new Date(),
        }))
        .filter((league) => filters?.status === undefined || league.status === filters.status);
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
      const leagueId = Number(tournamentId);
      if (!Number.isInteger(leagueId) || leagueId <= 0) {
        throw new Error('A valid STRATZ league ID is required to fetch matches.');
      }
      const isFirstPage = (filters?.offset ?? 0) === 0;
      const nodeGroupSelection = isFirstPage
        ? `
          nodeGroups {
            id
            nodes {
              id
              nodeGroupId
              seriesId
              scheduledTime
              teamOneId
              teamTwoId
              hasStarted
              isCompleted
            }
          }
        `
        : '';

      const query = `
        query {
          league(id: ${leagueId}) {
            matches(request: {
              skip: ${filters?.offset || 0}
              take: ${Math.min(filters?.limit || 100, 100)}
            }) {
              id
              leagueId
              seriesId
              radiantTeamId
              direTeamId
              startDateTime
              endDateTime
              durationSeconds
              didRadiantWin
              series {
                teamOneWinCount
                teamTwoWinCount
              }
            }
            ${nodeGroupSelection}
            liveMatches {
              matchId
              leagueId
              radiantTeamId
              direTeamId
              completed
              createdDateTime
            }
          }
        }
      `;

      const response = await this.graphqlRequest<{
        league?: {
          matches?: StratzMatchRecord[];
          nodeGroups?: Array<{ nodes?: StratzLeagueNode[] | null }> | null;
          liveMatches?: StratzLiveMatchRecord[];
        } | null;
      }>(query);
      const matches = response.data?.league?.matches;
      if (!Array.isArray(matches)) {
        throw new Error('STRATZ league match response is missing or invalid');
      }

      const liveMatches = response.data?.league?.liveMatches ?? [];
      const liveMatchById = new Map(liveMatches.map((match) => [String(match.matchId), match]));
      const mappedMatches: MatchData[] = matches.map((match) => {
        const liveMatch = liveMatchById.get(String(match.id));
        const status = mapStratzMatchStatus(match, liveMatch !== undefined && !liveMatch.completed);
        const startTimestamp = Number(match.startDateTime);
        const endTimestamp = match.endDateTime == null ? 0 : Number(match.endDateTime);
        return {
          id: String(match.id),
          tournamentId: String(match.leagueId),
          sourceSeriesId: match.seriesId == null ? undefined : String(match.seriesId),
          team1Id: String(match.radiantTeamId),
          team2Id: String(match.direTeamId),
          scheduledAt: new Date(startTimestamp * 1000),
          startedAt: status !== 'scheduled' ? new Date(startTimestamp * 1000) : undefined,
          endedAt: status === 'concluded' && endTimestamp > 0
            ? new Date(endTimestamp * 1000)
            : undefined,
          status,
          seriesStatus: match.series
            ? {
                team1Wins: match.series.teamOneWinCount,
                team2Wins: match.series.teamTwoWinCount,
              }
            : undefined,
          lastUpdated: new Date(),
        };
      });
      const mappedIds = new Set(mappedMatches.map((match) => match.id));
      if (isFirstPage) {
        for (const liveMatch of liveMatches) {
          const matchId = String(liveMatch.matchId);
          if (mappedIds.has(matchId)) continue;
          const status = liveMatch.completed ? 'concluded' : 'live';
          const startTimestamp = Number(liveMatch.createdDateTime);
          mappedMatches.push({
            id: matchId,
            tournamentId: String(liveMatch.leagueId),
            team1Id: String(liveMatch.radiantTeamId),
            team2Id: String(liveMatch.direTeamId),
            scheduledAt: new Date(startTimestamp * 1000),
            startedAt: new Date(startTimestamp * 1000),
            status,
            lastUpdated: new Date(),
          });
        }
      }

      if (isFirstPage) {
        const currentTime = Date.now();
        const fixtureIds = new Set(mappedMatches.map((match) => match.id));
        for (const nodeGroup of response.data?.league?.nodeGroups ?? []) {
          for (const node of nodeGroup.nodes ?? []) {
            const scheduledTimestamp = Number(node.scheduledTime);
            if (
              node.hasStarted ||
              node.isCompleted ||
              !Number.isFinite(scheduledTimestamp) ||
              scheduledTimestamp * 1000 <= currentTime ||
              node.teamOneId == null ||
              node.teamTwoId == null
            ) {
              continue;
            }

            const seriesId = node.seriesId == null ? undefined : String(node.seriesId);
            const nodeId = `scheduled:${leagueId}:${seriesId ?? `${node.nodeGroupId}:${node.id}`}`;
            if (fixtureIds.has(nodeId)) continue;
            fixtureIds.add(nodeId);
            mappedMatches.push({
              id: nodeId,
              tournamentId: String(leagueId),
              sourceSeriesId: seriesId,
              team1Id: String(node.teamOneId),
              team2Id: String(node.teamTwoId),
              scheduledAt: new Date(scheduledTimestamp * 1000),
              status: 'scheduled',
              lastUpdated: new Date(),
            });
          }
        }
      }

      return mappedMatches.filter((match) => filters?.status === undefined || match.status === filters.status);
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
      const numericMatchId = Number(matchId);
      if (!Number.isSafeInteger(numericMatchId) || numericMatchId <= 0) {
        throw new Error('A valid STRATZ match ID is required to fetch match details.');
      }

      const query = `
        query {
          match(id: ${numericMatchId}) {
            id
            durationSeconds
            radiantTeamId
            direTeamId
            didRadiantWin
            players {
              steamAccountId
              heroId
              isRadiant
              kills
              deaths
              assists
              goldPerMinute
              experiencePerMinute
              numLastHits
              numDenies
              heroDamage
              towerDamage
              heroHealing
              hero {
                displayName
                shortName
              }
            }
          }
        }
      `;

      const response = await this.graphqlRequest<{ match?: StratzDetailedMatchRecord | null }>(query);
      const m = response.data?.match;

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
        winner: m.didRadiantWin ? String(m.radiantTeamId) : String(m.direTeamId),
        teams: [
          {
            teamId: String(m.radiantTeamId),
            players: radiantPlayers.map((p) => ({
              playerId: String(p.steamAccountId),
              heroId: String(p.heroId),
              heroName: p.hero?.displayName || p.hero?.shortName || (p.heroId ? String(p.heroId) : 'Hero'),
              kills: p.kills,
              deaths: p.deaths,
              assists: p.assists,
              goldPerMinute: p.goldPerMinute,
              experiencePerMinute: p.experiencePerMinute,
              lastHits: p.numLastHits,
              denies: p.numDenies,
              heroDamage: p.heroDamage,
              towerDamage: p.towerDamage,
              healing: p.heroHealing,
              wardsPlaced: 0,
              wardsDestroyed: 0,
              firstBloodAchieved: false,
              roshansKilled: 0,
            })),
          },
          {
            teamId: String(m.direTeamId),
            players: direPlayers.map((p) => ({
              playerId: String(p.steamAccountId),
              heroId: String(p.heroId),
              heroName: p.hero?.displayName || p.hero?.shortName || (p.heroId ? String(p.heroId) : 'Hero'),
              kills: p.kills,
              deaths: p.deaths,
              assists: p.assists,
              goldPerMinute: p.goldPerMinute,
              experiencePerMinute: p.experiencePerMinute,
              lastHits: p.numLastHits,
              denies: p.numDenies,
              heroDamage: p.heroDamage,
              towerDamage: p.towerDamage,
              healing: p.heroHealing,
              wardsPlaced: 0,
              wardsDestroyed: 0,
              firstBloodAchieved: false,
              roshansKilled: 0,
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

}
