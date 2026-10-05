import { getTeamsSafeToDelete } from '../team-purge-safety';

describe('getTeamsSafeToDelete', () => {
  it('excludes teams referenced by roster history or recent matches', () => {
    expect(
      getTeamsSafeToDelete(
        [1, 2, 3, 4],
        new Set([2]),
        new Set([3, 4])
      )
    ).toEqual([1]);
  });

  it('allows empty teams with no recent match or roster history references', () => {
    expect(getTeamsSafeToDelete([5, 6], new Set(), new Set())).toEqual([5, 6]);
  });
});
