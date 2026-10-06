import {
  buildGameweekPointsBreakdown,
  type PlayerPointCategories,
  type PointsLineup,
} from './dashboard-points';

const categories = (combat: number): PlayerPointCategories => ({
  combat,
  economy: 0,
  objective: 0,
  teamfight: 0,
  win: 0,
  series: 0,
  performance: 0,
  consistency: 0,
  penalty: 0,
});

const lineup: PointsLineup = {
  id: 1,
  gameweek_id: 10,
  total_points: 30,
  carry_id: 1,
  mid_id: 2,
  offlane_id: 3,
  support_id: 4,
  hard_support_id: 5,
  bench_1_id: 6,
  bench_2_id: null,
  bench_3_id: null,
  captain_player_id: 1,
  vice_captain_player_id: 2,
};

describe('dashboard season points breakdown', () => {
  it('attributes lineup points to players, categories, auto-subs, and captain multipliers', () => {
    const [gameweek] = buildGameweekPointsBreakdown({
      lineups: [lineup],
      performances: [
        { gameweek_id: 10, player_id: 1, categories: categories(10) },
        { gameweek_id: 10, player_id: 2, categories: categories(5) },
        { gameweek_id: 10, player_id: 3, categories: categories(2) },
        { gameweek_id: 10, player_id: 4, categories: categories(3) },
        { gameweek_id: 10, player_id: 6, categories: categories(4) },
      ],
      players: [
        { id: 1, name: 'Carry', in_game_name: null, primary_role: 'Carry' },
        { id: 2, name: 'Mid', in_game_name: null, primary_role: 'Mid' },
        { id: 3, name: 'Offlane', in_game_name: null, primary_role: 'Offlane' },
        { id: 4, name: 'Support', in_game_name: null, primary_role: 'Support' },
        { id: 5, name: 'Hard Support', in_game_name: null, primary_role: 'Hard Support' },
        { id: 6, name: 'Bench Carry', in_game_name: null, primary_role: 'Carry' },
      ],
      gameweekNumbers: new Map([[10, 3]]),
      tripleCaptainGameweekId: null,
      benchBoostGameweekId: null,
    });

    expect(gameweek.gameweekNumber).toBe(3);
    expect(gameweek.points).toBe(30);
    expect(gameweek.categories.combat).toBe(30);
    expect(gameweek.contributors).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Carry', basePoints: 10, points: 20, multiplier: 2, isCaptain: true }),
    ]));
    expect(gameweek.contributors.some((player) => player.name === 'Hard Support')).toBe(false);
  });

  it('uses a same-role bench player when the starter did not participate', () => {
    const [gameweek] = buildGameweekPointsBreakdown({
      lineups: [{ ...lineup, total_points: 19 }],
      performances: [
        { gameweek_id: 10, player_id: 2, categories: categories(5) },
        { gameweek_id: 10, player_id: 3, categories: categories(2) },
        { gameweek_id: 10, player_id: 4, categories: categories(3) },
        { gameweek_id: 10, player_id: 6, categories: categories(4) },
      ],
      players: [
        { id: 1, name: 'Carry', in_game_name: null, primary_role: 'Carry' },
        { id: 2, name: 'Mid', in_game_name: null, primary_role: 'Mid' },
        { id: 3, name: 'Offlane', in_game_name: null, primary_role: 'Offlane' },
        { id: 4, name: 'Support', in_game_name: null, primary_role: 'Support' },
        { id: 5, name: 'Hard Support', in_game_name: null, primary_role: 'Hard Support' },
        { id: 6, name: 'Bench Carry', in_game_name: null, primary_role: 'Carry' },
      ],
      gameweekNumbers: new Map([[10, 3]]),
      tripleCaptainGameweekId: null,
      benchBoostGameweekId: null,
    });

    expect(gameweek.points).toBe(19);
    expect(gameweek.contributors).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Bench Carry', points: 4, isAutoSub: true }),
      expect.objectContaining({ name: 'Mid', points: 10, multiplier: 2, isViceCaptain: true }),
    ]));
  });

  it('counts all squad slots when Bench Boost is active and applies Triple Captain to the vice when needed', () => {
    const tripleCaptainLineup = { ...lineup, total_points: 34, captain_player_id: 5 };
    const [gameweek] = buildGameweekPointsBreakdown({
      lineups: [tripleCaptainLineup],
      performances: [
        { gameweek_id: 10, player_id: 1, categories: categories(10) },
        { gameweek_id: 10, player_id: 2, categories: categories(5) },
        { gameweek_id: 10, player_id: 3, categories: categories(2) },
        { gameweek_id: 10, player_id: 4, categories: categories(3) },
        { gameweek_id: 10, player_id: 6, categories: categories(4) },
      ],
      players: [
        { id: 1, name: 'Carry', in_game_name: null, primary_role: 'Carry' },
        { id: 2, name: 'Mid', in_game_name: null, primary_role: 'Mid' },
        { id: 3, name: 'Offlane', in_game_name: null, primary_role: 'Offlane' },
        { id: 4, name: 'Support', in_game_name: null, primary_role: 'Support' },
        { id: 5, name: 'Hard Support', in_game_name: null, primary_role: 'Hard Support' },
        { id: 6, name: 'Bench Carry', in_game_name: null, primary_role: 'Carry' },
      ],
      gameweekNumbers: new Map([[10, 3]]),
      tripleCaptainGameweekId: 10,
      benchBoostGameweekId: 10,
    });

    expect(gameweek.benchBoost).toBe(true);
    expect(gameweek.points).toBe(34);
    expect(gameweek.contributors).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Mid', points: 15, multiplier: 3, isViceCaptain: true }),
      expect.objectContaining({ name: 'Bench Carry', points: 4 }),
      expect.objectContaining({ name: 'Hard Support', points: 0 }),
    ]));
  });
});
