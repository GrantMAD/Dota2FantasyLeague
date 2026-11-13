import { calculateSeriesFantasyImpact, calculateSeriesLeaders } from './match-series-stats';

describe('calculateSeriesFantasyImpact', () => {
  it('sums a captain’s points across games and applies the captain multiplier once per game total', () => {
    const result = calculateSeriesFantasyImpact([
      {
        id: 101,
        match_number: 1,
        scheduled_at: '2026-11-10T12:00:00Z',
        duration_seconds: 2400,
        playerStats: [{
          player_id: 1,
          series_player_key: 'steam-account:1',
          professional_players: { in_game_name: 'Player A' },
        }],
        fantasyBreakdown: [{ player_id: 1, total_points: 10 }],
      },
      {
        id: 102,
        match_number: 2,
        scheduled_at: '2026-11-10T14:00:00Z',
        duration_seconds: 1800,
        playerStats: [{
          player_id: 2,
          series_player_key: 'steam-account:1',
          professional_players: { in_game_name: 'Player A' },
        }],
        fantasyBreakdown: [{ player_id: 2, total_points: 15 }],
      },
    ], {
      userOwnedPlayerIds: [1, 2],
      lineupDetails: [{
        playerId: 1,
        slot: 'Carry',
        isCaptain: true,
        isViceCaptain: false,
        isStarter: true,
      }, {
        playerId: 2,
        slot: 'Carry',
        isCaptain: true,
        isViceCaptain: false,
        isStarter: true,
      }],
      tripleCaptainActive: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      playerId: 1,
      fantasyPoints: 25,
      effectivePoints: 75,
      multiplier: 3,
      gamesPlayed: 2,
      gameValues: [
        { matchId: 101, matchNumber: 1, fantasyPoints: 10 },
        { matchId: 102, matchNumber: 2, fantasyPoints: 15 },
      ],
    });
  });
});

describe('calculateSeriesLeaders', () => {
  it('totals fantasy points, damage, estimated gold and kills across games', () => {
    const result = calculateSeriesLeaders([
      {
        id: 101,
        match_number: 1,
        scheduled_at: '2026-11-10T12:00:00Z',
        duration_seconds: 2400,
        playerStats: [{
          player_id: 1,
          series_player_key: 'steam-account:1',
          hero_name: 'Hero A',
          kills: 5,
          gold_per_minute: 600,
          hero_damage: 20000,
          professional_players: { in_game_name: 'Player A', primary_role: 'Carry' },
        }],
        fantasyBreakdown: [{ player_id: 1, total_points: 12 }],
      },
      {
        id: 102,
        match_number: 2,
        scheduled_at: '2026-11-10T14:00:00Z',
        duration_seconds: 1200,
        playerStats: [{
          player_id: 2,
          series_player_key: 'steam-account:1',
          hero_name: 'Hero B',
          kills: 7,
          gold_per_minute: 400,
          hero_damage: 30000,
          professional_players: { in_game_name: 'Player A', primary_role: 'Carry' },
        }],
        fantasyBreakdown: [{ player_id: 2, total_points: 25 }],
      },
    ]);

    expect(result.fantasyMVP).toMatchObject({ playerId: 1, value: 37, formattedValue: '37.0 pts' });
    expect(result.highestDamage).toMatchObject({ playerId: 1, value: 50000, formattedValue: '50,000' });
    expect(result.highestEconomy).toMatchObject({ playerId: 1, value: 32000, formattedValue: '~32,000 gold' });
    expect(result.highestKills).toMatchObject({ playerId: 1, value: 12, formattedValue: '12 kills' });
    expect(result.fantasyMVP?.gameValues).toMatchObject([
      { matchId: 101, matchNumber: 1, value: 12, formattedValue: '12.0 pts' },
      { matchId: 102, matchNumber: 2, value: 25, formattedValue: '25.0 pts' },
    ]);
    expect(result.highestDamage?.gameValues).toMatchObject([
      { matchId: 101, value: 20000, formattedValue: '20,000' },
      { matchId: 102, value: 30000, formattedValue: '30,000' },
    ]);
    expect(result.highestEconomy?.gameValues).toMatchObject([
      { matchId: 101, value: 24000, formattedValue: '~24,000 gold' },
      { matchId: 102, value: 8000, formattedValue: '~8,000 gold' },
    ]);
    expect(result.highestKills?.gameValues).toMatchObject([
      { matchId: 101, value: 5, formattedValue: '5 kills' },
      { matchId: 102, value: 7, formattedValue: '7 kills' },
    ]);
  });
});
