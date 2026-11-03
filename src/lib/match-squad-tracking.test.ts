import { getSquadPlayersForMatch } from './match-squad-tracking';

const squadPlayers = [
  { id: 1, name: 'Owned Carry', teamId: 10 },
  { id: 2, name: 'Owned Support', teamId: 10 },
  { id: 3, name: 'Owned Mid', teamId: 11 },
  { id: 4, name: 'Unrelated Player', teamId: 12 },
];

describe('getSquadPlayersForMatch', () => {
  it('uses exact player participation when match player stats are available', () => {
    expect(getSquadPlayersForMatch(10, 11, [2, 99], squadPlayers)).toEqual([
      { id: 2, name: 'Owned Support', confirmedAppearance: true },
    ]);
  });

  it('does not fall back to team matching when stats confirm no squad player appeared', () => {
    expect(getSquadPlayersForMatch(10, 11, [99], squadPlayers)).toEqual([]);
  });

  it('marks owned players on either participating team as unconfirmed fixtures when stats are unavailable', () => {
    expect(getSquadPlayersForMatch(10, 11, [], squadPlayers)).toEqual([
      { id: 1, name: 'Owned Carry', confirmedAppearance: false },
      { id: 2, name: 'Owned Support', confirmedAppearance: false },
      { id: 3, name: 'Owned Mid', confirmedAppearance: false },
    ]);
  });
});
