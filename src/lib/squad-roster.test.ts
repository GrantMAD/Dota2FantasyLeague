import { buildOwnedSquadRoster } from './squad-roster';
import type { FantasyPlayer, LineupEntry } from '@/types/fantasy';

const ownedPlayer = (id: number): FantasyPlayer => ({
  id,
  name: `Player ${id}`,
});

describe('buildOwnedSquadRoster', () => {
  it('keeps every owned player visible when there are no gameweek lineup assignments', () => {
    const roster = buildOwnedSquadRoster(
      [ownedPlayer(1), ownedPlayer(2)],
      [],
    );

    expect(roster).toEqual([
      { player: ownedPlayer(1), lineupEntry: null },
      { player: ownedPlayer(2), lineupEntry: null },
    ]);
  });

  it('decorates owned players with assignments without adding unowned lineup players', () => {
    const assignedPlayer = ownedPlayer(1);
    const lineupEntry: LineupEntry = {
      slot: 'carry',
      player_id: 1,
      is_captain: true,
      is_vice_captain: false,
    };

    expect(buildOwnedSquadRoster(
      [assignedPlayer, ownedPlayer(2)],
      [lineupEntry, { ...lineupEntry, player_id: 3 }],
    )).toEqual([
      { player: assignedPlayer, lineupEntry },
      { player: ownedPlayer(2), lineupEntry: null },
    ]);
  });
});
