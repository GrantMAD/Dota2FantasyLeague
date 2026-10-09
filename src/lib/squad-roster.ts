import type { FantasyPlayer, LineupEntry } from '@/types/fantasy';

export interface OwnedSquadPlayer {
  player: FantasyPlayer;
  lineupEntry: LineupEntry | null;
}

export function buildOwnedSquadRoster(
  ownedPlayers: FantasyPlayer[],
  lineup: LineupEntry[],
): OwnedSquadPlayer[] {
  const lineupByPlayerId = new Map(
    lineup.map((entry) => [entry.player_id, entry] as const),
  );

  return ownedPlayers.map((player) => ({
    player,
    lineupEntry: lineupByPlayerId.get(player.id) ?? null,
  }));
}
