export interface SeriesPlayerStat {
  player_id: number;
  hero_name?: string | null;
  kills?: number | null;
  gold_per_minute?: number | null;
  hero_damage?: number | null;
  series_player_key?: string;
  professional_players?: {
    name?: string | null;
    in_game_name?: string | null;
    primary_role?: string | null;
  } | null;
}

export interface SeriesFantasyBreakdown {
  player_id: number;
  total_points: number | null;
}

export interface SeriesGameStatistics {
  id?: number;
  match_number?: number;
  scheduled_at?: string;
  duration_seconds: number | null;
  playerStats: SeriesPlayerStat[];
  fantasyBreakdown: SeriesFantasyBreakdown[];
}

export interface SeriesGameValue {
  matchId: number;
  matchNumber: number;
  scheduledAt: string | null;
  value: number;
  formattedValue: string;
}

export interface SeriesPlayerGameImpact {
  matchId: number;
  matchNumber: number;
  scheduledAt: string | null;
  fantasyPoints: number;
}

export interface SeriesFantasyImpactContext {
  userOwnedPlayerIds: number[];
  lineupDetails: Array<{
    playerId: number;
    slot: string;
    isCaptain: boolean;
    isViceCaptain: boolean;
    isStarter: boolean;
  }>;
  tripleCaptainActive?: boolean;
}

export interface SeriesPlayerImpact {
  playerId: number;
  playerName: string;
  heroName?: string;
  role: string;
  fantasyPoints: number;
  effectivePoints: number;
  multiplier: number;
  slot: string;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isStarter: boolean;
  isOwned: boolean;
  gamesPlayed: number;
  gameValues: SeriesPlayerGameImpact[];
}

export interface SeriesLeader {
  playerId: number;
  playerName: string;
  heroName?: string | null;
  role: string;
  value: number;
  formattedValue: string;
  gameValues: SeriesGameValue[];
}

interface PlayerGameTotals {
  fantasyPoints: number;
  heroDamage: number;
  kills: number;
  estimatedGold: number;
}

interface PlayerSeriesTotals {
  playerId: number;
  playerName: string;
  heroName?: string | null;
  role: string;
  fantasyPoints: number;
  heroDamage: number;
  kills: number;
  estimatedGold: number;
  gameValues: Array<{
    matchId: number;
    matchNumber: number;
    scheduledAt: string | null;
  } & PlayerGameTotals>;
}

function getPlayerName(stat: SeriesPlayerStat): string {
  return stat.professional_players?.in_game_name
    || stat.professional_players?.name
    || `Player #${stat.player_id}`;
}

export function calculateSeriesFantasyImpact(
  games: SeriesGameStatistics[],
  impact: SeriesFantasyImpactContext,
): SeriesPlayerImpact[] {
  const lineupByPlayerId = new Map(impact.lineupDetails.map((detail) => [detail.playerId, detail]));
  const ownedPlayerIds = new Set(impact.userOwnedPlayerIds);
  const playersByKey = new Map<string, SeriesPlayerImpact>();

  for (const [gameIndex, game] of games.entries()) {
    const statsByKey = new Map<string, SeriesPlayerStat>();
    const keyByPlayerId = new Map<number, string>();
    for (const stat of game.playerStats) {
      const key = stat.series_player_key ?? `player:${stat.player_id}`;
      if (!statsByKey.has(key)) statsByKey.set(key, stat);
      keyByPlayerId.set(stat.player_id, key);
    }

    const pointsByKey = new Map<string, number>();
    for (const breakdown of game.fantasyBreakdown) {
      const key = keyByPlayerId.get(breakdown.player_id) ?? `player:${breakdown.player_id}`;
      pointsByKey.set(
        key,
        (pointsByKey.get(key) ?? 0) + Number(breakdown.total_points ?? 0),
      );
    }

    for (const [key, stat] of statsByKey) {
      const isOwned = ownedPlayerIds.has(stat.player_id);
      const lineup = lineupByPlayerId.get(stat.player_id);
      if (!isOwned && !lineup) continue;

      const existing = playersByKey.get(key);
      const fantasyPoints = pointsByKey.get(key) ?? 0;
      const gameValue = {
        matchId: game.id ?? gameIndex,
        matchNumber: game.match_number ?? gameIndex + 1,
        scheduledAt: game.scheduled_at ?? null,
        fantasyPoints,
      };
      if (existing) {
        existing.fantasyPoints += fantasyPoints;
        existing.gamesPlayed += 1;
        existing.isOwned = existing.isOwned || isOwned;
        existing.gameValues.push(gameValue);
        continue;
      }

      const multiplier = lineup?.isCaptain
        ? (impact.tripleCaptainActive ? 3 : 2)
        : lineup && !lineup.isStarter ? 0 : 1;
      playersByKey.set(key, {
        playerId: stat.player_id,
        playerName: getPlayerName(stat),
        heroName: stat.hero_name ?? undefined,
        role: stat.professional_players?.primary_role || 'Core',
        fantasyPoints,
        effectivePoints: 0,
        multiplier,
        slot: lineup?.slot || 'Squad Roster',
        isCaptain: Boolean(lineup?.isCaptain),
        isViceCaptain: Boolean(lineup?.isViceCaptain),
        isStarter: Boolean(lineup?.isStarter),
        isOwned,
        gamesPlayed: 1,
        gameValues: [gameValue],
      });
    }
  }

  return [...playersByKey.values()].map((player) => ({
    ...player,
    effectivePoints: player.fantasyPoints * player.multiplier,
  }));
}

export function calculateSeriesLeaders(games: SeriesGameStatistics[]): {
  fantasyMVP: SeriesLeader | null;
  highestDamage: SeriesLeader | null;
  highestEconomy: SeriesLeader | null;
  highestKills: SeriesLeader | null;
} {
  const totalsByPlayer = new Map<string, PlayerSeriesTotals>();

  for (const [gameIndex, game] of games.entries()) {
    const keyByPlayerId = new Map<number, string>();
    const statsByKey = new Map<string, SeriesPlayerStat>();
    for (const stat of game.playerStats) {
      const key = stat.series_player_key ?? `player:${stat.player_id}`;
      keyByPlayerId.set(stat.player_id, key);
      if (!statsByKey.has(key)) statsByKey.set(key, stat);
    }

    const fantasyByPlayerKey = new Map<string, number>();
    for (const breakdown of game.fantasyBreakdown) {
      const key = keyByPlayerId.get(breakdown.player_id) ?? `player:${breakdown.player_id}`;
      fantasyByPlayerKey.set(
        key,
        (fantasyByPlayerKey.get(key) ?? 0) + Number(breakdown.total_points ?? 0),
      );
    }

    const gameTotalsByPlayer = new Map<string, PlayerGameTotals>();
    for (const stat of game.playerStats) {
      const key = stat.series_player_key ?? `player:${stat.player_id}`;
      const gameTotals = gameTotalsByPlayer.get(key) ?? {
        fantasyPoints: 0,
        heroDamage: 0,
        kills: 0,
        estimatedGold: 0,
      };
      gameTotals.heroDamage += Number(stat.hero_damage ?? 0);
      gameTotals.kills += Number(stat.kills ?? 0);
      const duration = Math.max(0, game.duration_seconds ?? 0);
      const gpm = Number(stat.gold_per_minute ?? 0);
      if (duration > 0 && gpm > 0) {
        gameTotals.estimatedGold += gpm * duration / 60;
      }
      gameTotalsByPlayer.set(key, gameTotals);
    }

    for (const [key, fantasyPoints] of fantasyByPlayerKey) {
      const gameTotals = gameTotalsByPlayer.get(key);
      if (gameTotals) gameTotals.fantasyPoints = fantasyPoints;
    }

    for (const [key, gameTotals] of gameTotalsByPlayer) {
      const stat = statsByKey.get(key);
      if (!stat) continue;

      let totals = totalsByPlayer.get(key);
      if (!totals) {
        totals = {
          playerId: stat.player_id,
          playerName: getPlayerName(stat),
          heroName: stat.hero_name,
          role: stat.professional_players?.primary_role || 'Core',
          fantasyPoints: 0,
          heroDamage: 0,
          kills: 0,
          estimatedGold: 0,
          gameValues: [],
        };
        totalsByPlayer.set(key, totals);
      }

      totals.fantasyPoints += gameTotals.fantasyPoints;
      totals.heroDamage += gameTotals.heroDamage;
      totals.kills += gameTotals.kills;
      totals.estimatedGold += gameTotals.estimatedGold;
      totals.gameValues.push({
        matchId: game.id ?? gameIndex,
        matchNumber: game.match_number ?? gameIndex + 1,
        scheduledAt: game.scheduled_at ?? null,
        ...gameTotals,
      });
    }
  }

  const totals = [...totalsByPlayer.values()];
  const leader = (
    metric: keyof PlayerGameTotals,
    format: (value: number) => string,
    isAvailable: (player: PlayerSeriesTotals) => boolean = () => true,
  ): SeriesLeader | null => {
    const player = totals.filter(isAvailable).reduce<PlayerSeriesTotals | null>(
      (best, candidate) => best === null || candidate[metric] > best[metric] ? candidate : best,
      null,
    );
    if (!player) return null;
    const value = player[metric];
    return {
      playerId: player.playerId,
      playerName: player.playerName,
      heroName: player.heroName,
      role: player.role,
      value,
      formattedValue: format(value),
      gameValues: player.gameValues.map((game) => ({
        matchId: game.matchId,
        matchNumber: game.matchNumber,
        scheduledAt: game.scheduledAt,
        value: game[metric],
        formattedValue: format(game[metric]),
      })),
    };
  };

  return {
    fantasyMVP: leader('fantasyPoints', (value) => `${value.toFixed(1)} pts`),
    highestDamage: leader('heroDamage', (value) => value.toLocaleString()),
    highestEconomy: leader(
      'estimatedGold',
      (value) => `~${Math.round(value).toLocaleString()} gold`,
      (player) => player.estimatedGold > 0,
    ),
    highestKills: leader('kills', (value) => `${value} kills`),
  };
}
