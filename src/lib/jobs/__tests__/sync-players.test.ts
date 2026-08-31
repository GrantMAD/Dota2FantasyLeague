/**
 * Basic validation tests for player data provider
 * Verifies mock provider returns correctly structured data
 */
/// <reference types="jest" />

import { getMockProvider } from './mock-provider';

describe('Player Data Provider', () => {
  it('should fetch players with correct structure', async () => {
    const provider = getMockProvider();
    const players = await provider.fetchPlayers();

    expect(players).toBeDefined();
    expect(Array.isArray(players)).toBe(true);
    expect(players.length).toBeGreaterThan(0);

    // Check player structure
    const player = players[0];
    expect(player).toHaveProperty('id');
    expect(player).toHaveProperty('name');
    expect(player).toHaveProperty('steamId');
    expect(player).toHaveProperty('roles');
    expect(player).toHaveProperty('isActive');
  });

  it('should handle players with and without teams', async () => {
    const provider = getMockProvider();
    const players = await provider.fetchPlayers();

    const withTeam = players.filter((p) => p.team !== undefined);
    const withoutTeam = players.filter((p) => p.team === undefined);

    expect(withTeam.length).toBeGreaterThan(0);
    expect(withoutTeam.length).toBeGreaterThan(0);
  });

  it('should fetch individual player by ID', async () => {
    const provider = getMockProvider();
    const allPlayers = await provider.fetchPlayers();
    const player1 = await provider.fetchPlayer(allPlayers[0].id);

    expect(player1).toBeDefined();
    expect(player1.id).toBe(allPlayers[0].id);
    expect(player1.name).toBe(allPlayers[0].name);
  });

  it('should throw error for non-existent player', async () => {
    const provider = getMockProvider();

    try {
      await provider.fetchPlayer('nonexistent-id');
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain('not found');
    }
  });
});
