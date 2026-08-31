/**
 * Integration Tests for Data Providers
 * Tests full data flow from provider methods
 */
/// <reference types="jest" />

import { getMockProvider } from './mock-provider';

describe('Data Provider Integration Tests', () => {
  const provider = getMockProvider();

  describe('Player Sync Pipeline', () => {
    it('should fetch players from provider', async () => {
      const players = await provider.fetchPlayers();
      expect(players).toBeDefined();
      expect(Array.isArray(players)).toBe(true);
      expect(players.length).toBeGreaterThan(0);

      // Verify player structure matches expected format
      players.forEach((player) => {
        expect(player.id).toBeDefined();
        expect(player.name).toBeDefined();
        expect(player.steamId).toBeDefined();
        expect(player.isActive).toBeDefined();
      });
    });
  });

  describe('Team & Roster Sync Pipeline', () => {
    it('should fetch teams with roster data', async () => {
      const teams = await provider.fetchTeams();
      expect(teams).toBeDefined();
      expect(Array.isArray(teams)).toBe(true);
      expect(teams.length).toBeGreaterThan(0);

      // Verify team structure
      teams.forEach((team) => {
        expect(team.id).toBeDefined();
        expect(team.name).toBeDefined();
        expect(Array.isArray(team.roster)).toBe(true);
        expect(team.isActive).toBeDefined();
      });
    });

    it('should link players to teams via roster', async () => {
      const teams = await provider.fetchTeams();
      expect(teams.length).toBeGreaterThan(0);

      const firstTeam = teams[0];
      expect(firstTeam.roster.length).toBeGreaterThan(0);

      // Verify roster player structure
      firstTeam.roster.forEach((rosterPlayer) => {
        expect(rosterPlayer.playerId).toBeDefined();
        expect(rosterPlayer.joinedDate).toBeDefined();
      });
    });
  });

  describe('Tournament & Match Discovery Pipeline', () => {
    it('should discover and fetch tournaments', async () => {
      const tournaments = await provider.fetchTournaments();
      expect(tournaments).toBeDefined();
      expect(Array.isArray(tournaments)).toBe(true);
      expect(tournaments.length).toBeGreaterThan(0);

      // Verify tournament structure
      tournaments.forEach((tournament) => {
        expect(tournament.id).toBeDefined();
        expect(tournament.name).toBeDefined();
        expect(['upcoming', 'active', 'concluded']).toContain(tournament.status);
        expect(tournament.startDate).toBeDefined();
      });
    });

    it('should fetch matches for a tournament', async () => {
      const tournaments = await provider.fetchTournaments();
      const tournamentId = tournaments[0].id;

      const matches = await provider.fetchMatches(tournamentId);
      expect(matches).toBeDefined();
      expect(Array.isArray(matches)).toBe(true);
      expect(matches.length).toBeGreaterThan(0);

      // Verify match structure
      matches.forEach((match) => {
        expect(match.id).toBeDefined();
        expect(match.tournamentId).toBe(tournamentId);
        expect(match.team1Id).toBeDefined();
        expect(match.team2Id).toBeDefined();
        expect(['scheduled', 'live', 'concluded']).toContain(match.status);
      });
    });
  });

  describe('Match Details Fetching Pipeline', () => {
    it('should fetch match details with player statistics', async () => {
      const matches = await provider.fetchMatches();
      const matchId = matches[0].id;

      const details = await provider.fetchMatchDetails(matchId);
      expect(details).toBeDefined();
      expect(details.matchId).toBe(matchId);
      expect(details.duration).toBeDefined();
      expect(details.winner).toBeDefined();
      expect(Array.isArray(details.teams)).toBe(true);
      expect(details.teams.length).toBeGreaterThan(0);

      // Verify player statistics structure
      details.teams.forEach((team) => {
        expect(team.teamId).toBeDefined();
        expect(Array.isArray(team.players)).toBe(true);

        team.players.forEach((player) => {
          expect(player.playerId).toBeDefined();
          expect(player.heroName).toBeDefined();
          expect(player.kills).toBeDefined();
          expect(player.deaths).toBeDefined();
          expect(player.assists).toBeDefined();
          expect(player.goldPerMinute).toBeDefined();
        });
      });
    });

    it('should calculate fantasy scores from player statistics', async () => {
      const matches = await provider.fetchMatches();
      const details = await provider.fetchMatchDetails(matches[0].id);

      // Simulate fantasy score calculation
      const fantasyScores = details.teams.flatMap((team) =>
        team.players.map((player) => ({
          playerId: player.playerId,
          matchId: details.matchId,
          kills: player.kills,
          deaths: player.deaths,
          assists: player.assists,
          fantasyPoints:
            player.kills * 5 - player.deaths * 2 + player.assists * 1.5 + player.goldPerMinute * 0.001,
        }))
      );

      expect(fantasyScores.length).toBeGreaterThan(0);
      fantasyScores.forEach((score) => {
        expect(score.fantasyPoints).toBeGreaterThan(0);
      });
    });
  });

  describe('Roster Change Tracking Pipeline', () => {
    it('should fetch roster history for players', async () => {
      const players = await provider.fetchPlayers();
      const playerId = players[0].id;

      const rosterHistory = await provider.fetchRosterHistory(playerId);
      expect(rosterHistory).toBeDefined();
      expect(Array.isArray(rosterHistory)).toBe(true);

      // Verify roster change structure
      rosterHistory.forEach((change) => {
        expect(change.playerId).toBe(playerId);
        expect(change.teamId).toBeDefined();
        expect(['joined', 'left', 'transferred']).toContain(change.changeType);
        expect(change.changedAt).toBeDefined();
      });
    });
  });

  describe('Rate Limit Handling', () => {
    it('should return rate limit status', async () => {
      const rateLimitStatus = await provider.getRateLimitStatus();
      expect(rateLimitStatus).toBeDefined();
      expect(rateLimitStatus.limit).toBeDefined();
      expect(rateLimitStatus.remaining).toBeDefined();
      expect(rateLimitStatus.resetAt).toBeDefined();
      expect(rateLimitStatus.remaining).toBeLessThanOrEqual(rateLimitStatus.limit);
    });
  });

  describe('Provider Health Check', () => {
    it('should pass health check', async () => {
      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should have required metadata', () => {
      expect(provider.name).toBeDefined();
      expect(provider.version).toBeDefined();
    });
  });
});
