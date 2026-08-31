/**
 * Mock Data Provider for Testing
 * Provides realistic test data without calling external APIs
 */

import {
  DataProvider,
  PlayerData,
  TeamData,
  TournamentData,
  MatchData,
  MatchDetailsData,
  RosterChangeData,
  DataProviderFilters,
} from '@/lib/data-providers/provider-interface';

export class MockDataProvider implements DataProvider {
  name = 'mock-provider';
  version = '1.0.0';

  async healthCheck(): Promise<boolean> {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchPlayers(_filters?: DataProviderFilters): Promise<PlayerData[]> {
    return [
      {
        id: '123456',
        steamId: '123456',
        name: 'Player One',
        roles: ['carry'],
        team: { id: '1', name: 'Team A' },
        isActive: true,
        lastUpdated: new Date(),
      },
      {
        id: '123457',
        steamId: '123457',
        name: 'Player Two',
        roles: ['support'],
        team: { id: '2', name: 'Team B' },
        isActive: true,
        lastUpdated: new Date(),
      },
      {
        id: '123458',
        steamId: '123458',
        name: 'Player Three',
        roles: ['mid'],
        team: undefined,
        isActive: true,
        lastUpdated: new Date(),
      },
    ];
  }

  async fetchPlayer(playerId: string): Promise<PlayerData> {
    const players = await this.fetchPlayers();
    const player = players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    return player;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchTeams(_filters?: DataProviderFilters): Promise<TeamData[]> {
    return [
      {
        id: '1',
        name: 'Team A',
        tag: 'TA',
        region: 'NA',
        isActive: true,
        roster: [
          {
            playerId: '123456',
            joinedDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            position: '1',
          },
        ],
        lastUpdated: new Date(),
      },
      {
        id: '2',
        name: 'Team B',
        tag: 'TB',
        region: 'EU',
        isActive: true,
        roster: [
          {
            playerId: '123457',
            joinedDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            position: '5',
          },
        ],
        lastUpdated: new Date(),
      },
    ];
  }

  async fetchTeam(teamId: string): Promise<TeamData> {
    const teams = await this.fetchTeams();
    const team = teams.find((t) => t.id === teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }
    return team;
  }

  async fetchTournaments(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _filters?: DataProviderFilters & { status?: 'upcoming' | 'active' | 'concluded'; minTier?: string }
  ): Promise<TournamentData[]> {
    const now = new Date();
    const startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);

    return [
      {
        id: 'tour-001',
        name: 'International Championship',
        startDate,
        endDate,
        tier: 'S',
        status: 'upcoming',
        prizePool: 1000000,
        teams: ['1', '2'],
        lastUpdated: new Date(),
      },
      {
        id: 'tour-002',
        name: 'Regional Qualifier',
        startDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
        tier: 'A',
        status: 'upcoming',
        prizePool: 100000,
        teams: ['1'],
        lastUpdated: new Date(),
      },
    ];
  }

  async fetchMatches(
    tournamentId?: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _filters?: DataProviderFilters & { status?: 'scheduled' | 'live' | 'concluded' }
  ): Promise<MatchData[]> {
    const now = new Date();
    const scheduledAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const concludedAt = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

    return [
      {
        id: 'match-001',
        tournamentId: tournamentId || 'tour-001',
        team1Id: '1',
        team2Id: '2',
        scheduledAt,
        status: 'scheduled',
        gameweek: 1,
        lastUpdated: new Date(),
      },
      {
        id: 'match-002',
        tournamentId: tournamentId || 'tour-001',
        team1Id: '1',
        team2Id: '2',
        scheduledAt: concludedAt,
        status: 'concluded',
        seriesStatus: { team1Wins: 2, team2Wins: 1 },
        gameweek: 1,
        lastUpdated: new Date(),
      },
    ];
  }

  async fetchMatchDetails(matchId: string): Promise<MatchDetailsData> {
    return {
      matchId,
      duration: 2400,
      winner: '1',
      teams: [
        {
          teamId: '1',
          players: [
            {
              playerId: '123456',
              heroId: 'hero-1',
              heroName: 'Antimage',
              kills: 15,
              deaths: 2,
              assists: 8,
              goldPerMinute: 650,
              experiencePerMinute: 580,
              heroDamage: 25000,
              towerDamage: 5000,
              lastHits: 380,
              denies: 12,
              healing: 0,
              wardsPlaced: 2,
              wardsDestroyed: 3,
              firstBloodAchieved: true,
              roshansKilled: 1,
            },
          ],
        },
        {
          teamId: '2',
          players: [
            {
              playerId: '123457',
              heroId: 'hero-2',
              heroName: 'Crystal Maiden',
              kills: 5,
              deaths: 8,
              assists: 12,
              goldPerMinute: 520,
              experiencePerMinute: 450,
              heroDamage: 15000,
              towerDamage: 1000,
              lastHits: 250,
              denies: 5,
              healing: 3000,
              wardsPlaced: 12,
              wardsDestroyed: 2,
              firstBloodAchieved: false,
              roshansKilled: 0,
            },
          ],
        },
      ],
      lastUpdated: new Date(),
    };
  }

  async fetchRosterHistory(
    playerId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _dateRange?: { from: Date; to: Date }
  ): Promise<RosterChangeData[]> {
    return [
      {
        teamId: '1',
        playerId,
        changeType: 'joined',
        changedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        previousTeam: undefined,
        role: 'carry',
      },
    ];
  }

  async getRateLimitStatus(): Promise<{
    remaining: number;
    limit: number;
    resetAt: Date;
  }> {
    return {
      remaining: 95,
      limit: 100,
      resetAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }
}

/**
 * Factory function to get mock provider instance
 */
export function getMockProvider(): DataProvider {
  return new MockDataProvider();
}
