import { calculateDynamicPriceChange } from '../update-player-prices';

describe('dynamic player pricing', () => {
it('fantasy points move a price more than ownership alone', () => {
  const ownershipOnlyPrice = calculateDynamicPriceChange(100, 0, 1, 0.5);
  const pointsAndOwnershipPrice = calculateDynamicPriceChange(100, 10, 1, 0.5);

  expect(ownershipOnlyPrice).toBe(100.1);
  expect(pointsAndOwnershipPrice).toBe(100.3);
});

it('negative fantasy points can outweigh the smaller ownership signal', () => {
  expect(calculateDynamicPriceChange(100, -10, 1, 0.5)).toBe(99.9);
});

it('price movement remains capped per gameweek', () => {
  expect(calculateDynamicPriceChange(100, 100, 1, 0.5)).toBe(100.5);
  expect(calculateDynamicPriceChange(100, -100, 1, 0.5)).toBe(99.5);
});

it('recalculating with the same gameweek baseline and inputs is stable', () => {
  const firstRun = calculateDynamicPriceChange(5, 12, 0.4, 0.5);
  const rerun = calculateDynamicPriceChange(5, 12, 0.4, 0.5);

  expect(firstRun).toBe(rerun);
  expect(firstRun).toBe(5.28);
});
});
