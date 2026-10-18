import { buildTransferHistoryAnalytics } from './transfer-history-analytics';

const gameweeks = [
  { id: 101, seasonId: 7, gameweekNumber: 1, status: 'closed', endDate: '2026-01-10T23:59:59Z' },
  { id: 102, seasonId: 7, gameweekNumber: 2, status: 'closed', endDate: '2026-01-17T23:59:59Z' },
  { id: 103, seasonId: 7, gameweekNumber: 3, status: 'locked', endDate: '2026-01-24T23:59:59Z' },
  { id: 104, seasonId: 7, gameweekNumber: 4, status: 'closed', endDate: '2026-01-31T23:59:59Z' },
  { id: 105, seasonId: 7, gameweekNumber: 5, status: 'open', endDate: '2026-02-07T23:59:59Z' },
];

function transfer(overrides: Partial<Parameters<typeof buildTransferHistoryAnalytics>[0]['transfers'][number]> = {}) {
  return {
    id: 1,
    createdAt: '2026-01-11T12:00:00Z',
    fantasySeasonId: 70,
    seasonId: 7,
    gameweekId: 102,
    gameweekNumber: 2,
    penaltyPoints: 0,
    moves: [{
      playerOutId: 10,
      playerInId: 20,
      playerOut: 'Outgoing',
      playerIn: 'Incoming',
      budgetImpact: null,
      netPointsNextThreeGameweeks: null,
      scoredGameweeks: 0,
      scoringGameweeks: [],
    }],
    budgetImpact: null,
    ...overrides,
  };
}

describe('buildTransferHistoryAnalytics', () => {
  it('calculates the stored-cost budget impact and leaves unmatched transactions unknown', () => {
    const result = buildTransferHistoryAnalytics({
      transfers: [
        transfer(),
        transfer({
          id: 2,
          moves: [{
            playerOutId: 30,
            playerInId: 40,
            playerOut: 'Unknown cost',
            playerIn: 'Incoming',
            budgetImpact: null,
            netPointsNextThreeGameweeks: null,
            scoredGameweeks: 0,
            scoringGameweeks: [],
          }],
        }),
      ],
      members: [
        { fantasySeasonId: 70, playerId: 10, cost: 12.5, acquiredAt: '2025-12-01T00:00:00Z', removedAt: '2026-01-11T12:00:30Z' },
        { fantasySeasonId: 70, playerId: 20, cost: 10, acquiredAt: '2026-01-11T12:00:00Z', removedAt: null },
        { fantasySeasonId: 70, playerId: 30, cost: 8, acquiredAt: '2025-12-01T00:00:00Z', removedAt: null },
        { fantasySeasonId: 70, playerId: 40, cost: 9, acquiredAt: '2026-02-01T00:00:00Z', removedAt: null },
      ],
      gameweeks,
      scores: [],
      prices: [],
      currentFantasySeasonId: 70,
      currentSeasonId: 7,
    });

    expect(result.transfers[0].budgetImpact).toBe(2.5);
    expect(result.transfers[1].budgetImpact).toBeNull();
    expect(result.netBudgetChange).toBe(2.5);
    expect(result.pricedTransactions).toBe(1);
    expect(result.totalTransactions).toBe(2);
  });

  it('ranks swaps using three fully completed gameweeks and treats absent performance rows as zero', () => {
    const result = buildTransferHistoryAnalytics({
      transfers: [transfer()],
      members: [],
      gameweeks,
      scores: [
        { playerId: 10, gameweekId: 102, points: 2 },
        { playerId: 20, gameweekId: 102, points: 5 },
        { playerId: 10, gameweekId: 103, points: 4 },
        { playerId: 20, gameweekId: 103, points: 3 },
        { playerId: 10, gameweekId: 104, points: 1 },
      ],
      prices: [],
      currentFantasySeasonId: 70,
      currentSeasonId: 7,
    });
    const move = result.transfers[0].moves[0];

    expect(move.netPointsNextThreeGameweeks).toBe(1);
    expect(move.scoringGameweeks).toEqual([2, 3, 4]);
    expect(result.bestTransfer?.netPoints).toBe(1);
    expect(result.worstTransfer?.netPoints).toBe(1);
  });

  it('reports budget change as unavailable when no transaction has complete cost history', () => {
    const result = buildTransferHistoryAnalytics({
      transfers: [transfer()],
      members: [],
      gameweeks,
      scores: [],
      prices: [],
      currentFantasySeasonId: 70,
      currentSeasonId: 7,
    });

    expect(result.netBudgetChange).toBeNull();
    expect(result.pricedTransactions).toBe(0);
    expect(result.totalTransactions).toBe(1);
  });

  it('does not rank a transfer until all three gameweeks are closed or locked', () => {
    const result = buildTransferHistoryAnalytics({
      transfers: [transfer({ gameweekId: 104, gameweekNumber: 4 })],
      members: [],
      gameweeks,
      scores: [],
      prices: [],
      currentFantasySeasonId: 70,
      currentSeasonId: 7,
    });

    expect(result.transfers[0].moves[0].netPointsNextThreeGameweeks).toBeNull();
    expect(result.bestTransfer).toBeNull();
    expect(result.worstTransfer).toBeNull();
  });

  it('values the players owned at gameweek end and marks incomplete price snapshots unavailable', () => {
    const members = [
      { fantasySeasonId: 70, playerId: 10, cost: 12, acquiredAt: '2025-12-01T00:00:00Z', removedAt: null },
      { fantasySeasonId: 70, playerId: 20, cost: 9, acquiredAt: '2025-12-01T00:00:00Z', removedAt: '2026-01-16T00:00:00Z' },
      { fantasySeasonId: 70, playerId: 30, cost: 8, acquiredAt: '2026-01-15T00:00:00Z', removedAt: null },
    ];
    const result = buildTransferHistoryAnalytics({
      transfers: [],
      members,
      gameweeks,
      scores: [],
      prices: [
        { playerId: 10, gameweekId: 101, price: 13 },
        { playerId: 20, gameweekId: 101, price: 8 },
        { playerId: 10, gameweekId: 102, price: 14 },
        { playerId: 30, gameweekId: 102, price: 9 },
      ],
      currentFantasySeasonId: 70,
      currentSeasonId: 7,
    });

    expect(result.squadValueHistory).toEqual([
      { gameweekNumber: 1, value: 21 },
      { gameweekNumber: 2, value: 23 },
      { gameweekNumber: 3, value: null },
      { gameweekNumber: 4, value: null },
    ]);
  });
});
