import {
  findLastProcessedTournamentId,
  selectNextTournamentBatch,
} from '../match-tournament-batch';

describe('selectNextTournamentBatch', () => {
  const tournaments = [{ id: 8 }, { id: 2 }, { id: 5 }];

  it('starts in stable ID order and returns only the requested batch', () => {
    expect(selectNextTournamentBatch(tournaments, 2, null)).toEqual({
      tournaments: [{ id: 2 }, { id: 5 }],
      hasMore: true,
      lastProcessedTournamentId: 5,
    });
  });

  it('resumes after the previous tournament and wraps around', () => {
    expect(selectNextTournamentBatch(tournaments, 2, 5)).toEqual({
      tournaments: [{ id: 8 }, { id: 2 }],
      hasMore: true,
      lastProcessedTournamentId: 2,
    });
  });

  it('returns all tournaments once when the batch covers the list', () => {
    expect(selectNextTournamentBatch(tournaments, 3, 5)).toEqual({
      tournaments: [{ id: 8 }, { id: 2 }, { id: 5 }],
      hasMore: false,
      lastProcessedTournamentId: 5,
    });
  });

  it('rejects invalid batch limits', () => {
    expect(() => selectNextTournamentBatch(tournaments, 0, null)).toThrow(
      'Tournament batch limit must be a positive safe integer.',
    );
  });
});

describe('findLastProcessedTournamentId', () => {
  it('reads the cursor from either the handler log or scheduler result metadata', () => {
    expect(findLastProcessedTournamentId([
      { metadata: { result: null } },
      { metadata: { result: { lastProcessedTournamentId: 23 } } },
      { metadata: { lastProcessedTournamentId: 17 } },
    ])).toBe(23);
  });

  it('ignores malformed cursors', () => {
    expect(findLastProcessedTournamentId([
      { metadata: { lastProcessedTournamentId: -1 } },
      { metadata: null },
    ])).toBeNull();
  });
});
