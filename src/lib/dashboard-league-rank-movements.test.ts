import { parseLeagueRankMovement } from './dashboard-league-rank-movements';

describe('parseLeagueRankMovement', () => {
  it('returns positive movement for a rank gain and negative movement for a loss', () => {
    expect(parseLeagueRankMovement({ from_rank: 8, to_rank: 5 })).toBe(3);
    expect(parseLeagueRankMovement({ from_rank: 5, to_rank: 8 })).toBe(-3);
  });

  it('ignores missing, unchanged, or invalid rank values', () => {
    expect(parseLeagueRankMovement(null)).toBeNull();
    expect(parseLeagueRankMovement({ from_rank: 4, to_rank: 4 })).toBeNull();
    expect(parseLeagueRankMovement({ from_rank: '4', to_rank: 2 })).toBeNull();
    expect(parseLeagueRankMovement({ from_rank: 0, to_rank: 2 })).toBeNull();
  });
});
