import {
  getCompletedGamesAwaitingPlayerStats,
  getDefaultSeriesGame,
  getEffectiveBestOf,
  groupMatchesBySeries,
  shouldShowMatchSeries,
  summarizeMatchSeries,
} from './match-series';

describe('getDefaultSeriesGame', () => {
  it('prefers game 1 even when it is not first in the input', () => {
    const gameThree = { id: 3, match_number: 3 };
    const gameOne = { id: 1, match_number: 1 };

    expect(getDefaultSeriesGame([gameThree, gameOne])).toBe(gameOne);
  });

  describe('getEffectiveBestOf', () => {
    it('assumes best-of-three for an unconfigured series and best-of-one for a standalone match', () => {
      expect(getEffectiveBestOf([{ id: 1, series_id: 9 }], null)).toBe(3);
      expect(getEffectiveBestOf([{ id: 2, series_id: null }], undefined)).toBe(1);
    });
  });

  it('falls back to the first game when game numbers are unavailable', () => {
    const games: Array<{ id: number; match_number?: number }> = [{ id: 7 }, { id: 8 }];
    expect(getDefaultSeriesGame(games)).toBe(games[0]);
  });
});

describe('getCompletedGamesAwaitingPlayerStats', () => {
  it('returns completed games without player stats but excludes games still in progress', () => {
    expect(getCompletedGamesAwaitingPlayerStats([
      { id: 1, match_number: 1, status: 'completed', player_ids: [501] },
      { id: 2, match_number: 2, status: 'completed', player_ids: [] },
      { id: 3, match_number: 3, status: 'scheduled', player_ids: [] },
      { id: 4, match_number: 4, status: 'live', playerStats: [] },
    ])).toEqual([
      { id: 2, match_number: 2, status: 'completed', player_ids: [] },
    ]);
  });

  it('uses detail player stats when the game list has no player ID field', () => {
    expect(getCompletedGamesAwaitingPlayerStats([
      { id: 1, match_number: 1, status: 'completed', playerStats: [{ player_id: 501 }] },
      { id: 2, match_number: 2, status: 'completed', playerStats: [] },
    ])).toEqual([
      { id: 2, match_number: 2, status: 'completed', playerStats: [] },
    ]);
  });
});

describe('groupMatchesBySeries', () => {
  it('groups page matches by series and includes sibling games outside the page slice', () => {
    const first = { id: 174, series_id: 9, gameweek_id: 4, radiant_team_id: 1, dire_team_id: 2, scheduled_at: '2026-11-12T19:01:09' };
    const second = { id: 175, series_id: 9, gameweek_id: 4, radiant_team_id: 2, dire_team_id: 1, scheduled_at: '2026-11-12T19:52:03' };
    const third = { id: 176, series_id: 10, gameweek_id: 4, radiant_team_id: 3, dire_team_id: 4, scheduled_at: '2026-11-12T20:00:00' };

    expect(groupMatchesBySeries([
      { ...second, series_matches: [first, second] },
      third,
    ])).toEqual([
      { key: 'series:9:gameweek:4:teams:1:2', match: { ...second, series_matches: [first, second] }, games: [first, second] },
      { key: 'series:10:gameweek:4:teams:3:4', match: third, games: [third] },
    ]);
  });

  it('keeps different teams or gameweeks separate when a series ID is shared', () => {
    const shared = { series_id: 9, scheduled_at: '2026-11-12T19:01:09' };
    const first = { ...shared, id: 1, gameweek_id: 4, team_a_id: 1, team_b_id: 2 };
    const sameTeamsReversed = { ...shared, id: 2, gameweek_id: 4, team_a_id: 2, team_b_id: 1 };
    const otherTeams = { ...shared, id: 3, gameweek_id: 4, team_a_id: 3, team_b_id: 4 };
    const otherGameweek = { ...shared, id: 4, gameweek_id: 5, team_a_id: 1, team_b_id: 2 };

    expect(groupMatchesBySeries([first, sameTeamsReversed, otherTeams, otherGameweek]).map((group) => (
      group.games.map((game) => game.id)
    ))).toEqual([[1, 2], [3], [4]]);
  });

  describe('shouldShowMatchSeries', () => {
    it('hides completed matches without stats but keeps fixtures visible', () => {
      expect(shouldShowMatchSeries([
        { id: 1, status: 'completed', player_ids: [] },
      ])).toBe(false);
      expect(shouldShowMatchSeries([
        { id: 2, status: 'scheduled', player_ids: [] },
      ])).toBe(true);
      expect(shouldShowMatchSeries([
        { id: 3, status: 'live', player_ids: [] },
      ])).toBe(true);
    });

    it('shows a completed series when at least one game has player stats', () => {
      expect(shouldShowMatchSeries([
        { id: 1, series_id: 9, status: 'completed', player_ids: [] },
        { id: 2, series_id: 9, status: 'completed', player_ids: [501] },
      ])).toBe(true);
      expect(shouldShowMatchSeries([
        { id: 3, series_id: 10, status: 'completed', player_ids: [] },
        { id: 4, series_id: 10, status: 'completed', player_ids: [] },
      ])).toBe(false);
    });
  });

  describe('summarizeMatchSeries', () => {
    it('does not mark a series final merely because all currently known games are completed', () => {
      const gameOne = {
        id: 1,
        series_id: 9,
        status: 'completed',
        winner_team_id: 1,
        radiant_team_id: 1,
        dire_team_id: 2,
      };
      const gameTwo = {
        id: 2,
        series_id: 9,
        status: 'completed',
        winner_team_id: 2,
        radiant_team_id: 1,
        dire_team_id: 2,
      };

      expect(summarizeMatchSeries([gameOne], 3).isComplete).toBe(false);
      expect(summarizeMatchSeries([gameOne, gameTwo], 3).isComplete).toBe(false);
      expect(summarizeMatchSeries([gameOne], null).isComplete).toBe(false);
    });

    it('counts completed game wins and recognizes a clinched best-of series', () => {
      expect(summarizeMatchSeries([
        { id: 1, series_id: 9, scheduled_at: '2026-11-12T10:00:00', status: 'completed', winner_team_id: 1, radiant_team_id: 1, dire_team_id: 2 },
        { id: 2, series_id: 9, scheduled_at: '2026-11-12T11:00:00', status: 'completed', winner_team_id: 1, radiant_team_id: 1, dire_team_id: 2 },
        { id: 3, series_id: 9, scheduled_at: '2026-11-12T12:00:00', status: 'scheduled', winner_team_id: null, radiant_team_id: 1, dire_team_id: 2 },
      ], 3)).toEqual({
        radiantWins: 2,
        direWins: 0,
        completedGames: 2,
        clinchedTeamId: 1,
        isComplete: true,
        isLive: false,
      });
    });

    it('clinches a Best-of-1 match after 1 game', () => {
      expect(summarizeMatchSeries([
        { id: 1, series_id: 9, scheduled_at: '2026-11-12T10:00:00', status: 'completed', winner_team_id: 1, radiant_team_id: 1, dire_team_id: 2 },
      ], 1)).toEqual({
        radiantWins: 1,
        direWins: 0,
        completedGames: 1,
        clinchedTeamId: 1,
        isComplete: true,
        isLive: false,
      });
    });

    it('correctly maps scores when teams swap radiant/dire sides across games', () => {
      // Game 1: Team 1 is Radiant, Team 2 is Dire. Team 1 wins.
      // Game 2: Team 2 is Radiant, Team 1 is Dire. Team 1 wins.
      // Game 3: Team 2 is Radiant, Team 1 is Dire. Team 2 wins.
      const games = [
        { id: 1, series_id: 10, scheduled_at: '2026-11-18T10:00:00', status: 'completed', winner_team_id: 1, radiant_team_id: 1, dire_team_id: 2 },
        { id: 2, series_id: 10, scheduled_at: '2026-11-18T11:00:00', status: 'completed', winner_team_id: 1, radiant_team_id: 2, dire_team_id: 1 },
        { id: 3, series_id: 10, scheduled_at: '2026-11-18T12:00:00', status: 'completed', winner_team_id: 2, radiant_team_id: 2, dire_team_id: 1 },
      ];

      // If the card displays Team 1 on the left (referenceRadiant = 1, referenceDire = 2):
      expect(summarizeMatchSeries(games, 3, 1, 2)).toEqual({
        radiantWins: 2, // Team 1 has 2 wins
        direWins: 1,    // Team 2 has 1 win
        completedGames: 3,
        clinchedTeamId: 1,
        isComplete: true,
        isLive: false,
      });

      // If the card displays Team 2 on the left (referenceRadiant = 2, referenceDire = 1):
      expect(summarizeMatchSeries(games, 3, 2, 1)).toEqual({
        radiantWins: 1, // Team 2 has 1 win
        direWins: 2,    // Team 1 has 2 wins
        completedGames: 3,
        clinchedTeamId: 1,
        isComplete: true,
        isLive: false,
      });
    });
  });

  it('keeps matches without a series ID separate', () => {
    const rows = [
      { id: 1, series_id: null, scheduled_at: '2026-11-12T10:00:00' },
      { id: 2, series_id: null, scheduled_at: '2026-11-12T11:00:00' },
    ];

    expect(groupMatchesBySeries(rows).map((group) => group.key)).toEqual(['match:1', 'match:2']);
  });
});
