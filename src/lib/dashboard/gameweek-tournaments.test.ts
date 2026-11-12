import { mapGameweekTournaments } from './gameweek-tournaments';

describe('mapGameweekTournaments', () => {
  it('only includes tournaments linked to matches in the selected gameweek', () => {
    const result = mapGameweekTournaments(
      [
        { series_id: 10, status: 'completed' },
        { series_id: 10, status: 'scheduled' },
        { series_id: 11, status: 'in_progress' },
      ],
      [
        { id: 10, tournament_id: 1, best_of: 3 },
        { id: 11, tournament_id: 2, best_of: 5 },
        { id: 12, tournament_id: 3, best_of: 3 },
      ],
      [
        { id: 1, name: 'Tournament with matches', tier: '1', start_date: '2026-11-01' },
        { id: 2, name: 'Tournament with matches', tier: '2', start_date: '2026-11-02' },
        { id: 3, name: 'Tournament without gameweek matches', tier: '1', start_date: '2026-11-03' },
      ],
    );

    expect(result).toEqual([
      {
        id: 1,
        name: 'Tournament with matches',
        tier: '1',
        start_date: '2026-11-01',
        seriesCount: 1,
        matchCount: 2,
        bestOfFormats: [3],
      },
      {
        id: 2,
        name: 'Tournament with matches',
        tier: '2',
        start_date: '2026-11-02',
        seriesCount: 1,
        matchCount: 1,
        bestOfFormats: [5],
      },
    ]);
  });

  it('returns no tournaments when the gameweek has no matches', () => {
    expect(mapGameweekTournaments(
      [],
      [{ id: 10, tournament_id: 1, best_of: 3 }],
      [{ id: 1, name: 'Tournament', tier: '1', start_date: '2026-11-01' }],
    )).toEqual([]);
  });
});
