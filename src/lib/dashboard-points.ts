export const POINT_CATEGORIES = [
  ['combat', 'Combat'],
  ['economy', 'Economy'],
  ['objective', 'Objectives'],
  ['teamfight', 'Teamfights'],
  ['win', 'Wins'],
  ['series', 'Series'],
  ['performance', 'Performance index'],
  ['consistency', 'Consistency'],
  ['penalty', 'Penalties'],
] as const;

export type PointCategory = (typeof POINT_CATEGORIES)[number][0];

export interface PlayerPointCategories {
  combat: number;
  economy: number;
  objective: number;
  teamfight: number;
  win: number;
  series: number;
  performance: number;
  consistency: number;
  penalty: number;
}

export interface PointsLineup {
  id: number;
  gameweek_id: number;
  total_points: number | null;
  carry_id: number | null;
  mid_id: number | null;
  offlane_id: number | null;
  support_id: number | null;
  hard_support_id: number | null;
  bench_1_id: number | null;
  bench_2_id: number | null;
  bench_3_id: number | null;
  captain_player_id: number | null;
  vice_captain_player_id: number | null;
}

export interface PointsPerformance {
  gameweek_id: number;
  player_id: number;
  categories: PlayerPointCategories;
}

export interface PointsPlayer {
  id: number;
  name: string | null;
  in_game_name: string | null;
  primary_role: string | null;
}

export interface PointsContributor {
  playerId: number;
  name: string;
  role: string;
  basePoints: number;
  points: number;
  multiplier: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isAutoSub: boolean;
  categories: PlayerPointCategories;
}

export interface GameweekPointsBreakdown {
  gameweekId: number;
  gameweekNumber: number;
  points: number;
  benchBoost: boolean;
  contributors: PointsContributor[];
  categories: PlayerPointCategories;
}

const SLOT_ROLES = [
  ['Carry', 'carry_id'],
  ['Mid', 'mid_id'],
  ['Offlane', 'offlane_id'],
  ['Support', 'support_id'],
  ['Hard Support', 'hard_support_id'],
] as const;

const emptyCategories = (): PlayerPointCategories => ({
  combat: 0,
  economy: 0,
  objective: 0,
  teamfight: 0,
  win: 0,
  series: 0,
  performance: 0,
  consistency: 0,
  penalty: 0,
});

function sumCategories(categories: PlayerPointCategories): number {
  return POINT_CATEGORIES.reduce((sum, [key]) => sum + categories[key], 0);
}

function roundPoints(points: number): number {
  return Math.round(points * 100) / 100;
}

function roundCategories(categories: PlayerPointCategories): PlayerPointCategories {
  return {
    combat: roundPoints(categories.combat),
    economy: roundPoints(categories.economy),
    objective: roundPoints(categories.objective),
    teamfight: roundPoints(categories.teamfight),
    win: roundPoints(categories.win),
    series: roundPoints(categories.series),
    performance: roundPoints(categories.performance),
    consistency: roundPoints(categories.consistency),
    penalty: roundPoints(categories.penalty),
  };
}

export function buildGameweekPointsBreakdown({
  lineups,
  performances,
  players,
  gameweekNumbers,
  tripleCaptainGameweekId,
  benchBoostGameweekId,
}: {
  lineups: PointsLineup[];
  performances: PointsPerformance[];
  players: PointsPlayer[];
  gameweekNumbers: Map<number, number>;
  tripleCaptainGameweekId: number | null;
  benchBoostGameweekId: number | null;
}): GameweekPointsBreakdown[] {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const performanceMap = new Map<number, Map<number, PlayerPointCategories>>();
  const participants = new Map<number, Set<number>>();

  for (const performance of performances) {
    let gameweekPerformanceMap = performanceMap.get(performance.gameweek_id);
    if (!gameweekPerformanceMap) {
      gameweekPerformanceMap = new Map();
      performanceMap.set(performance.gameweek_id, gameweekPerformanceMap);
    }
    let playerCategories = gameweekPerformanceMap.get(performance.player_id);
    if (!playerCategories) {
      playerCategories = emptyCategories();
      gameweekPerformanceMap.set(performance.player_id, playerCategories);
    }
    for (const [key] of POINT_CATEGORIES) {
      playerCategories[key] += performance.categories[key];
    }

    let gameweekParticipants = participants.get(performance.gameweek_id);
    if (!gameweekParticipants) {
      gameweekParticipants = new Set();
      participants.set(performance.gameweek_id, gameweekParticipants);
    }
    gameweekParticipants.add(performance.player_id);
  }

  return lineups.map((lineup) => {
    const gameweekParticipants = participants.get(lineup.gameweek_id) ?? new Set<number>();
    const slotPlayers = SLOT_ROLES.flatMap(([role, column]) => {
      const playerId = lineup[column];
      return playerId === null ? [] : [{ role, playerId }];
    });
    const benchIds = [lineup.bench_1_id, lineup.bench_2_id, lineup.bench_3_id]
      .filter((playerId): playerId is number => playerId !== null);
    const benchRoles = new Map(benchIds.map((playerId) => [
      playerId,
      playersById.get(playerId)?.primary_role ?? null,
    ]));
    const availableBench = benchIds.filter((playerId) => gameweekParticipants.has(playerId));
    const usedBench = new Set<number>();
    const activeStarters: Array<{ playerId: number; role: string }> = [];

    for (const slot of slotPlayers) {
      if (gameweekParticipants.has(slot.playerId)) {
        activeStarters.push(slot);
        continue;
      }
      const substitute = availableBench.find((playerId) =>
        !usedBench.has(playerId) && benchRoles.get(playerId) === slot.role
      );
      if (substitute !== undefined) {
        usedBench.add(substitute);
        activeStarters.push({ playerId: substitute, role: slot.role });
      }
    }

    const allPlayerIds = [...slotPlayers.map(({ playerId }) => playerId), ...benchIds];
    const scoringPlayers = lineup.gameweek_id === benchBoostGameweekId
      ? allPlayerIds.map((playerId) => ({
          playerId,
          role: playersById.get(playerId)?.primary_role ?? 'Bench',
        }))
      : activeStarters;
    const gameweekPerformanceMap = performanceMap.get(lineup.gameweek_id);
    const captainPlayed = lineup.captain_player_id !== null
      && gameweekParticipants.has(lineup.captain_player_id);
    const categories = emptyCategories();
    const contributorMap = new Map<number, PointsContributor>();

    for (const selectedPlayer of scoringPlayers) {
      const player = playersById.get(selectedPlayer.playerId);
      const playerCategories = gameweekPerformanceMap?.get(selectedPlayer.playerId) ?? emptyCategories();
      const isCaptain = selectedPlayer.playerId === lineup.captain_player_id;
      const isViceCaptain = selectedPlayer.playerId === lineup.vice_captain_player_id;
      const getsCaptainMultiplier = isCaptain
        || (isViceCaptain && !captainPlayed);
      const multiplier = getsCaptainMultiplier
        ? lineup.gameweek_id === tripleCaptainGameweekId ? 3 : 2
        : 1;
      const basePoints = sumCategories(playerCategories);
      const priorContributor = contributorMap.get(selectedPlayer.playerId);
      const contributionCategories = priorContributor?.categories ?? emptyCategories();

      for (const [key] of POINT_CATEGORIES) {
        const weightedPoints = playerCategories[key] * multiplier;
        contributionCategories[key] += weightedPoints;
        categories[key] += weightedPoints;
      }

      contributorMap.set(selectedPlayer.playerId, {
        playerId: selectedPlayer.playerId,
        name: player?.in_game_name || player?.name || `Player #${selectedPlayer.playerId}`,
        role: selectedPlayer.role,
        basePoints: (priorContributor?.basePoints ?? 0) + basePoints,
        points: (priorContributor?.points ?? 0) + basePoints * multiplier,
        multiplier: Math.max(priorContributor?.multiplier ?? 1, multiplier),
        isCaptain: Boolean(priorContributor?.isCaptain || isCaptain),
        isViceCaptain: Boolean(priorContributor?.isViceCaptain || isViceCaptain),
        isAutoSub: Boolean(priorContributor?.isAutoSub || usedBench.has(selectedPlayer.playerId)),
        categories: contributionCategories,
      });
    }

    return {
      gameweekId: lineup.gameweek_id,
      gameweekNumber: gameweekNumbers.get(lineup.gameweek_id) ?? lineup.gameweek_id,
      points: Number(lineup.total_points ?? 0),
      benchBoost: lineup.gameweek_id === benchBoostGameweekId,
      contributors: [...contributorMap.values()]
        .map((contributor) => ({
          ...contributor,
          basePoints: roundPoints(contributor.basePoints),
          points: roundPoints(contributor.points),
          categories: roundCategories(contributor.categories),
        }))
        .sort((a, b) => b.points - a.points),
      categories: roundCategories(categories),
    };
  }).sort((a, b) => b.gameweekNumber - a.gameweekNumber);
}

export function sumGameweekPointCategories(
  gameweeks: GameweekPointsBreakdown[],
): PlayerPointCategories {
  const totals = emptyCategories();
  for (const gameweek of gameweeks) {
    for (const [key] of POINT_CATEGORIES) totals[key] += gameweek.categories[key];
  }
  for (const [key] of POINT_CATEGORIES) totals[key] = roundPoints(totals[key]);
  return totals;
}
