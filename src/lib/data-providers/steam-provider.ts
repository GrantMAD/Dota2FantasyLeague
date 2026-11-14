/**
 * Steam Data Provider
 *
 * Implements real-time match discovery, live game detection, player summaries,
 * and team logo resolution directly from Valve's official Steam Web API.
 *
 * API Docs: https://partner.steamgames.com/doc/webapi/IDOTA2Match_570
 */

import {
  DataProvider,
  DataProviderBase,
  DataProviderFilters,
  PlayerData,
  TeamData,
  TournamentData,
  MatchData,
  MatchDetailsData,
  RosterChangeData,
} from './provider-interface';

interface SteamConfig {
  apiKey: string;
  apiUrl?: string;
}

interface SteamMatchHistoryEntry {
  match_id: number;
  match_seq_num?: number;
  start_time: number;
  lobby_type: number;
  radiant_team_id?: number;
  dire_team_id?: number;
  series_id?: number;
  series_type?: number;
  players?: Array<{
    account_id: number;
    player_slot: number;
    hero_id: number;
  }>;
}

interface SteamLiveGameEntry {
  match_id?: number | string;
  server_steam_id?: string;
  lobby_id?: string;
  league_id?: number;
  lobby_type?: number;
  game_time?: number;
  delay?: number;
  spectators?: number;
  series_id?: number;
  series_type?: number;
  radiant_series_wins?: number;
  dire_series_wins?: number;
  activate_time?: number;
  deactivate_time?: number;
  last_update_time?: number;
  radiant_lead?: number;
  radiant_score?: number;
  dire_score?: number;
  radiant_team_id?: number;
  dire_team_id?: number;
  team_name_radiant?: string;
  team_name_dire?: string;
  team_id_radiant?: number;
  team_id_dire?: number;
  radiant_team?: {
    team_name?: string;
    team_id?: number;
    team_logo?: string | number;
  };
  dire_team?: {
    team_name?: string;
    team_id?: number;
    team_logo?: string | number;
  };
  players?: Array<{
    account_id?: number;
    name?: string;
    hero_id?: number;
    team?: number;
  }>;
}

interface SteamPlayerSummary {
  steamid: string;
  personaname?: string;
  avatarfull?: string;
  avatarmedium?: string;
  avatar?: string;
  profileurl?: string;
}

interface SteamMatchDetailsPlayer {
  account_id?: number | string;
  hero_id?: number | string;
  player_slot?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  gold_per_min?: number;
  xp_per_min?: number;
  last_hits?: number;
  denies?: number;
  hero_damage?: number;
  tower_damage?: number;
  hero_healing?: number;
}

const STEAM_ID_64_OFFSET = BigInt('76561197960265728');

export class SteamProvider extends DataProviderBase implements DataProvider {
  public readonly name = 'Steam';
  public readonly version = '1.0.0';

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: SteamConfig) {
    super();
    if (!config.apiKey) {
      throw new Error('SteamProvider requires an apiKey.');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.apiUrl || 'https://api.steampowered.com';
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/IDOTA2Match_570/GetMatchHistory/v1/?key=${this.apiKey}&matches_requested=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return false;
      const data = await res.json();
      return data?.result?.status === 1 || Array.isArray(data?.result?.matches);
    } catch (error) {
      this.log('warn', `Steam health check failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Fetches matches for a tournament.
   * Combines GetLiveLeagueGames (for active games) and GetMatchHistory (for completed games).
   */
  public async fetchMatches(
    tournamentId?: string,
    filters?: DataProviderFilters & { status?: 'scheduled' | 'live' | 'concluded' }
  ): Promise<MatchData[]> {
    if (!tournamentId) {
      return [];
    }

    try {
      const matchesMap = new Map<string, MatchData>();

      // 1. Fetch live games for this league
      if (!filters?.status || filters.status === 'live') {
        try {
          const liveUrl = `${this.baseUrl}/IDOTA2Match_570/GetLiveLeagueGames/v1/?key=${this.apiKey}&league_id=${encodeURIComponent(tournamentId)}`;
          const liveRes = await fetch(liveUrl, { signal: AbortSignal.timeout(8000) });
          if (liveRes.ok) {
            const liveData = await liveRes.json();
            const liveGames = (liveData?.result?.games ?? []) as SteamLiveGameEntry[];
            for (const g of liveGames) {
              const matchId = String(g.match_id ?? '');
              if (!matchId || matchId === '0') continue;

              // If deactivate_time > 0, the game has ended on the server
              const isDeactivated = typeof g.deactivate_time === 'number' && g.deactivate_time > 0;
              const status: 'live' | 'concluded' = isDeactivated ? 'concluded' : 'live';

              const team1Id = String(g.radiant_team?.team_id || g.team_id_radiant || g.radiant_team_id || '0');
              const team2Id = String(g.dire_team?.team_id || g.team_id_dire || g.dire_team_id || '0');
              const team1Name = g.radiant_team?.team_name || g.team_name_radiant || undefined;
              const team2Name = g.dire_team?.team_name || g.team_name_dire || undefined;

              const startTimeSec = g.activate_time && g.activate_time > 0 ? g.activate_time : Math.floor(Date.now() / 1000);
              const scheduledAt = new Date(startTimeSec * 1000);

              const bestOf = g.series_type === 0 ? 1 : g.series_type === 2 ? 5 : 3;
              matchesMap.set(matchId, {
                id: matchId,
                tournamentId,
                team1Id,
                team1Name,
                team2Id,
                team2Name,
                sourceSeriesId: g.series_id ? String(g.series_id) : undefined,
                bestOfSeries: bestOf,
                seriesStatus: (typeof g.radiant_series_wins === 'number' && typeof g.dire_series_wins === 'number')
                  ? {
                      team1Wins: g.radiant_series_wins,
                      team2Wins: g.dire_series_wins,
                    }
                  : undefined,
                scheduledAt,
                startedAt: scheduledAt,
                endedAt: isDeactivated && g.deactivate_time ? new Date(g.deactivate_time * 1000) : undefined,
                status,
                lastUpdated: new Date(),
              });
            }
          }
        } catch (error) {
          this.log('warn', `Failed to fetch live league games from Steam: ${(error as Error).message}`);
        }
      }

      // 2. Fetch completed matches from GetMatchHistory
      if (!filters?.status || filters.status === 'concluded') {
        const historyUrl = `${this.baseUrl}/IDOTA2Match_570/GetMatchHistory/v1/?key=${this.apiKey}&league_id=${encodeURIComponent(tournamentId)}&matches_requested=100`;
        const historyRes = await fetch(historyUrl, { signal: AbortSignal.timeout(10000) });
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          const historyMatches = (historyData?.result?.matches ?? []) as SteamMatchHistoryEntry[];

          for (const m of historyMatches) {
            const matchId = String(m.match_id);
            const team1Id = String(m.radiant_team_id ?? '0');
            const team2Id = String(m.dire_team_id ?? '0');
            const scheduledAt = new Date(m.start_time * 1000);

            // Existing live entry gets promoted to concluded
            matchesMap.set(matchId, {
              id: matchId,
              tournamentId,
              team1Id,
              team1Name: undefined,
              team2Id,
              team2Name: undefined,
              sourceSeriesId: m.series_id ? String(m.series_id) : undefined,
              scheduledAt,
              startedAt: scheduledAt,
              endedAt: undefined,
              status: 'concluded',
              lastUpdated: new Date(),
            });
          }
        } else {
          throw this.createError(
            'STEAM_MATCHES_FETCH_FAILED',
            `Steam GetMatchHistory returned HTTP ${historyRes.status}`,
            historyRes.status,
            true
          );
        }
      }

      let matches = Array.from(matchesMap.values());
      if (filters?.status) {
        matches = matches.filter((m) => m.status === filters.status);
      }

      // Sort descending by scheduledAt
      matches.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());

      const offset = filters?.offset ?? 0;
      const limit = filters?.limit ?? matches.length;
      return matches.slice(offset, offset + limit);
    } catch (error) {
      if ((error as { code?: string }).code === 'STEAM_MATCHES_FETCH_FAILED') throw error;
      throw this.createError(
        'STEAM_MATCHES_FETCH_FAILED',
        `Failed to fetch matches from Steam: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  /**
   * Fetches team metadata and resolves logo CDN URL.
   */
  public async fetchTeam(teamId: string): Promise<TeamData> {
    try {
      const url = `${this.baseUrl}/IDOTA2Match_570/GetTeamInfoByTeamID/v1/?key=${this.apiKey}&start_at_team_id=${encodeURIComponent(teamId)}&teams_requested=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        throw this.createError('STEAM_TEAM_FETCH_FAILED', `Steam GetTeamInfo returned ${res.status}`, res.status, true);
      }

      const text = await res.text();
      // Extract raw logo UGC ID to prevent 64-bit integer precision loss
      const logoMatch = text.match(/"logo":\s*(\d+)/);
      const nameMatch = text.match(/"name":\s*"([^"]+)"/);
      const tagMatch = text.match(/"tag":\s*"([^"]+)"/);
      const countryMatch = text.match(/"country_code":\s*"([^"]+)"/);

      const name = nameMatch ? nameMatch[1] : `Team ${teamId}`;
      const tag = tagMatch ? tagMatch[1] : '';
      const country = countryMatch ? countryMatch[1] : undefined;
      const logoUgcId = logoMatch ? logoMatch[1] : null;

      let logoUrl: string | undefined;
      if (logoUgcId && logoUgcId !== '0') {
        logoUrl = (await this.resolveUgcUrl(logoUgcId)) ?? undefined;
      }

      return {
        id: teamId,
        name,
        tag,
        country,
        logoUrl,
        roster: [],
        isActive: true,
        lastUpdated: new Date(),
      };
    } catch (error) {
      throw this.createError(
        'STEAM_TEAM_FETCH_FAILED',
        `Failed to fetch team ${teamId} from Steam: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  /**
   * Direct helper to resolve a team's logo CDN URL from Steam.
   */
  public async fetchTeamLogo(teamId: string): Promise<string | null> {
    try {
      const team = await this.fetchTeam(teamId);
      return team.logoUrl ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Resolves a raw 64-bit UGC ID to Valve's live static CDN URL.
   */
  public async resolveUgcUrl(ugcId: string): Promise<string | null> {
    if (!ugcId || ugcId === '0') return null;
    try {
      const url = `${this.baseUrl}/ISteamRemoteStorage/GetUGCFileDetails/v1/?key=${this.apiKey}&ugcid=${encodeURIComponent(ugcId)}&appid=570`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data?.data?.url === 'string' ? data.data.url : null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches player profile information (avatar, name) from Steam.
   */
  public async fetchPlayer(playerId: string): Promise<PlayerData> {
    try {
      const steamId64 = this.toSteamId64(playerId);
      const summaries = await this.fetchPlayerSummariesBatch([steamId64]);
      const summary = summaries.get(steamId64);

      if (!summary) {
        throw this.createError('STEAM_PLAYER_NOT_FOUND', `Player ${playerId} not found on Steam`, 404, false);
      }

      return {
        id: playerId,
        steamId: steamId64,
        name: summary.personaname || `Player ${playerId}`,
        profileUrl: summary.profileurl,
        imageUrl: summary.avatarfull || summary.avatarmedium || summary.avatar,
        roles: [],
        isActive: true,
        lastUpdated: new Date(),
      };
    } catch (error) {
      if ((error as { code?: string }).code === 'STEAM_PLAYER_NOT_FOUND') throw error;
      throw this.createError(
        'STEAM_PLAYER_FETCH_FAILED',
        `Failed to fetch player ${playerId} from Steam: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  /**
   * Batch fetches player summaries for up to 100 Steam IDs in a single HTTP request.
   */
  public async fetchPlayerSummariesBatch(steamIds64: string[]): Promise<Map<string, SteamPlayerSummary>> {
    const results = new Map<string, SteamPlayerSummary>();
    if (steamIds64.length === 0) return results;

    const chunk = steamIds64.slice(0, 100);
    try {
      const url = `${this.baseUrl}/ISteamUser/GetPlayerSummaries/v2/?key=${this.apiKey}&steamids=${encodeURIComponent(chunk.join(','))}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        const players = (data?.response?.players ?? []) as SteamPlayerSummary[];
        for (const p of players) {
          if (p.steamid) results.set(p.steamid, p);
        }
      }
    } catch (error) {
      this.log('warn', `Failed to batch fetch player summaries: ${(error as Error).message}`);
    }

    return results;
  }

  /**
   * Converts 32-bit account ID to 64-bit Steam ID string if needed.
   */
  public toSteamId64(accountId: string | number): string {
    const str = String(accountId).trim();
    if (str.length > 10) return str; // Already 64-bit
    try {
      return (BigInt(str) + STEAM_ID_64_OFFSET).toString();
    } catch {
      return str;
    }
  }

  public async fetchTournaments(): Promise<TournamentData[]> {
    // Valve deprecated GetLeagueListing; tournament discovery is handled by STRATZ/OpenDota
    return [];
  }

  public async fetchTeams(): Promise<TeamData[]> {
    return [];
  }

  public async fetchPlayers(): Promise<PlayerData[]> {
    return [];
  }

  public async fetchRosterHistory(): Promise<RosterChangeData[]> {
    return [];
  }

  public async fetchMatchDetails(matchId: string): Promise<MatchDetailsData> {
    try {
      const url = `${this.baseUrl}/IDOTA2Match_570/GetMatchDetails/v1/?key=${this.apiKey}&match_id=${encodeURIComponent(matchId)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        throw this.createError('STEAM_MATCH_DETAILS_FAILED', `Steam GetMatchDetails returned ${res.status}`, res.status, true);
      }
      const data = await res.json();
      const m = data?.result;
      if (!m || !m.players) {
        throw this.createError('STEAM_MATCH_DETAILS_FAILED', 'Invalid response from GetMatchDetails', 500, true);
      }

      const allPlayers = Array.isArray(m.players) ? (m.players as SteamMatchDetailsPlayer[]) : [];
      const radiantPlayers = allPlayers.filter((p) => (p.player_slot ?? 0) < 128);
      const direPlayers = allPlayers.filter((p) => (p.player_slot ?? 0) >= 128);

      const mapPlayer = (p: SteamMatchDetailsPlayer) => ({
        playerId: String(p.account_id ?? 'unknown'),
        heroId: String(p.hero_id ?? '0'),
        heroName: `Hero ${p.hero_id}`,
        kills: Number(p.kills ?? 0),
        deaths: Number(p.deaths ?? 0),
        assists: Number(p.assists ?? 0),
        goldPerMinute: Number(p.gold_per_min ?? 0),
        experiencePerMinute: Number(p.xp_per_min ?? 0),
        lastHits: Number(p.last_hits ?? 0),
        denies: Number(p.denies ?? 0),
        heroDamage: Number(p.hero_damage ?? 0),
        towerDamage: Number(p.tower_damage ?? 0),
        healing: Number(p.hero_healing ?? 0),
        wardsPlaced: 0,
        wardsDestroyed: 0,
        firstBloodAchieved: false,
        roshansKilled: 0,
      });

      return {
        matchId: String(matchId),
        duration: Number(m.duration ?? 0),
        winner: m.radiant_win ? String(m.radiant_team_id ?? '1') : String(m.dire_team_id ?? '2'),
        teams: [
          { teamId: String(m.radiant_team_id ?? '1'), players: radiantPlayers.map(mapPlayer) },
          { teamId: String(m.dire_team_id ?? '2'), players: direPlayers.map(mapPlayer) },
        ],
        lastUpdated: new Date(),
      };
    } catch (error) {
      throw this.createError(
        'STEAM_MATCH_DETAILS_FAILED',
        `Failed to fetch match details from Steam: ${(error as Error).message}`,
        undefined,
        true,
        error as Error
      );
    }
  }

  public async getRateLimitStatus(): Promise<{
    remaining: number | null;
    limit: number | null;
    resetAt: Date | null;
  }> {
    // Valve allows ~100,000 requests/day, not dynamically exposed via headers
    return {
      remaining: null,
      limit: 100000,
      resetAt: null,
    };
  }
}
