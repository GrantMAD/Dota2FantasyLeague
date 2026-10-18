export interface TransferMember {
  fantasySeasonId: number;
  playerId: number;
  cost: number;
  acquiredAt: string;
  removedAt: string | null;
}

export interface TransferGameweek {
  id: number;
  seasonId: number;
  gameweekNumber: number;
  status: string;
  endDate: string | null;
}

export interface PlayerGameweekScore {
  playerId: number;
  gameweekId: number;
  points: number;
}

export interface PlayerGameweekPrice {
  playerId: number;
  gameweekId: number;
  price: number;
}

export interface TransferAnalyticsMove {
  playerOutId: number | null;
  playerInId: number | null;
  playerOut: string | null;
  playerIn: string | null;
  budgetImpact: number | null;
  netPointsNextThreeGameweeks: number | null;
  scoredGameweeks: number;
  scoringGameweeks: number[];
}

export interface TransferAnalyticsRecord {
  id: number;
  createdAt: string;
  fantasySeasonId: number | null;
  seasonId: number | null;
  gameweekId: number | null;
  gameweekNumber: number | null;
  penaltyPoints: number | null;
  moves: TransferAnalyticsMove[];
  budgetImpact: number | null;
}

export interface SquadValuePoint {
  gameweekNumber: number;
  value: number | null;
}

export interface TransferInsight {
  playerOut: string;
  playerIn: string;
  netPoints: number;
  gameweekNumbers: number[];
}

export interface TransferHistoryAnalytics {
  transfers: TransferAnalyticsRecord[];
  netBudgetChange: number | null;
  pricedTransactions: number;
  totalTransactions: number;
  squadValueHistory: SquadValuePoint[];
  bestTransfer: TransferInsight | null;
  worstTransfer: TransferInsight | null;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameTransferMoment(first: string, second: string | null): boolean {
  const firstTime = timestamp(first);
  const secondTime = timestamp(second);
  return firstTime !== null && secondTime !== null && Math.abs(firstTime - secondTime) <= 60_000;
}

function membershipCost(
  members: TransferMember[],
  seasonId: number | null,
  playerId: number | null,
  eventAt: string,
  direction: 'acquired' | 'removed',
): number | null {
  if (seasonId === null || playerId === null) return null;
  const member = members.find((row) =>
    row.fantasySeasonId === seasonId &&
    row.playerId === playerId &&
    sameTransferMoment(eventAt, direction === 'acquired' ? row.acquiredAt : row.removedAt)
  );
  return member ? toFiniteNumber(member.cost) : null;
}

function transferScoringWindow(
  seasonId: number | null,
  gameweekId: number | null,
  gameweeks: TransferGameweek[],
): TransferGameweek[] {
  if (seasonId === null || gameweekId === null) return [];
  const seasonWeeks = gameweeks
    .filter((week) => week.seasonId === seasonId)
    .sort((a, b) => a.gameweekNumber - b.gameweekNumber);
  const startIndex = seasonWeeks.findIndex((week) => week.id === gameweekId);
  if (startIndex < 0) return [];
  const window = seasonWeeks.slice(startIndex, startIndex + 3);
  if (window.length !== 3 || window.some((week) => !['closed', 'locked'].includes(week.status))) return [];
  return window;
}

function createScoreMap(scores: PlayerGameweekScore[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const score of scores) {
    const key = `${score.playerId}:${score.gameweekId}`;
    totals.set(key, (totals.get(key) ?? 0) + score.points);
  }
  return totals;
}

function createSquadValueHistory(
  currentSeasonId: number | null,
  currentFantasySeasonId: number | null,
  members: TransferMember[],
  gameweeks: TransferGameweek[],
  prices: PlayerGameweekPrice[],
): SquadValuePoint[] {
  if (currentSeasonId === null || currentFantasySeasonId === null) return [];
  const seasonMembers = members.filter((member) => member.fantasySeasonId === currentFantasySeasonId);
  const seasonWeeks = gameweeks
    .filter((week) => week.seasonId === currentSeasonId && ['closed', 'locked'].includes(week.status))
    .sort((a, b) => a.gameweekNumber - b.gameweekNumber);
  const priceByPlayerAndGameweek = new Map(
    prices.map((price) => [`${price.playerId}:${price.gameweekId}`, price.price]),
  );

  return seasonWeeks.flatMap((week) => {
    const endTime = timestamp(week.endDate);
    if (endTime === null) return [];
    const ownedAtEnd = seasonMembers.filter((member) => {
      const acquiredAt = timestamp(member.acquiredAt);
      const removedAt = timestamp(member.removedAt);
      return acquiredAt !== null && acquiredAt <= endTime && (removedAt === null || removedAt > endTime);
    });
    let value = 0;
    let complete = true;
    for (const member of ownedAtEnd) {
      const price = priceByPlayerAndGameweek.get(`${member.playerId}:${week.id}`);
      if (price === undefined || !Number.isFinite(price)) {
        complete = false;
        break;
      }
      value += price;
    }
    return [{
      gameweekNumber: week.gameweekNumber,
      value: complete ? Math.round(value * 100) / 100 : null,
    }];
  });
}

export function buildTransferHistoryAnalytics(input: {
  transfers: TransferAnalyticsRecord[];
  members: TransferMember[];
  gameweeks: TransferGameweek[];
  scores: PlayerGameweekScore[];
  prices: PlayerGameweekPrice[];
  currentFantasySeasonId: number | null;
  currentSeasonId: number | null;
}): TransferHistoryAnalytics {
  const scoreByPlayerAndGameweek = createScoreMap(input.scores);
  const transfers = input.transfers.map((transfer) => {
    const moves = transfer.moves.map((move) => {
      const outCost = membershipCost(
        input.members,
        transfer.fantasySeasonId,
        move.playerOutId,
        transfer.createdAt,
        'removed',
      );
      const inCost = membershipCost(
        input.members,
        transfer.fantasySeasonId,
        move.playerInId,
        transfer.createdAt,
        'acquired',
      );
      const scoringWeeks = transferScoringWindow(
        transfer.seasonId,
        transfer.gameweekId,
        input.gameweeks,
      );
      const netPoints = scoringWeeks.length > 0 && move.playerOutId !== null && move.playerInId !== null
        ? scoringWeeks.reduce((total, week) =>
            total +
            (scoreByPlayerAndGameweek.get(`${move.playerInId}:${week.id}`) ?? 0) -
            (scoreByPlayerAndGameweek.get(`${move.playerOutId}:${week.id}`) ?? 0), 0)
        : null;

      return {
        ...move,
        budgetImpact: outCost !== null && inCost !== null
          ? Math.round((outCost - inCost) * 100) / 100
          : null,
        netPointsNextThreeGameweeks: netPoints === null ? null : Math.round(netPoints * 100) / 100,
        scoredGameweeks: scoringWeeks.length,
        scoringGameweeks: scoringWeeks.map((week) => week.gameweekNumber),
      };
    });
    const budgetImpact = moves.length > 0 && moves.every((move) => move.budgetImpact !== null)
      ? Math.round(moves.reduce((total, move) => total + (move.budgetImpact ?? 0), 0) * 100) / 100
      : null;
    return { ...transfer, moves, budgetImpact };
  });

  const insights = transfers.flatMap((transfer) => transfer.moves.flatMap((move) =>
    move.playerOut && move.playerIn && move.netPointsNextThreeGameweeks !== null
      ? [{
          playerOut: move.playerOut,
          playerIn: move.playerIn,
          netPoints: move.netPointsNextThreeGameweeks,
          gameweekNumbers: move.scoringGameweeks,
        }]
      : []
  ));
  const pricedTransactions = transfers.filter((transfer) => transfer.budgetImpact !== null).length;
  const netBudgetChange = transfers.reduce(
    (total, transfer) => total + (transfer.budgetImpact ?? 0),
    0,
  );

  return {
    transfers,
    netBudgetChange: pricedTransactions > 0 ? Math.round(netBudgetChange * 100) / 100 : null,
    pricedTransactions,
    totalTransactions: transfers.length,
    squadValueHistory: createSquadValueHistory(
      input.currentSeasonId,
      input.currentFantasySeasonId,
      input.members,
      input.gameweeks,
      input.prices,
    ),
    bestTransfer: insights.reduce<TransferInsight | null>(
      (best, insight) => best === null || insight.netPoints > best.netPoints ? insight : best,
      null,
    ),
    worstTransfer: insights.reduce<TransferInsight | null>(
      (worst, insight) => worst === null || insight.netPoints < worst.netPoints ? insight : worst,
      null,
    ),
  };
}
