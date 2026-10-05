import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDynamicPriceChange } from '../update-player-prices';

test('fantasy points move a price more than ownership alone', () => {
  const ownershipOnlyPrice = calculateDynamicPriceChange(100, 0, 1, 0.5);
  const pointsAndOwnershipPrice = calculateDynamicPriceChange(100, 10, 1, 0.5);

  assert.equal(ownershipOnlyPrice, 100.1);
  assert.equal(pointsAndOwnershipPrice, 100.3);
});

test('negative fantasy points can outweigh the smaller ownership signal', () => {
  assert.equal(calculateDynamicPriceChange(100, -10, 1, 0.5), 99.9);
});

test('price movement remains capped per gameweek', () => {
  assert.equal(calculateDynamicPriceChange(100, 100, 1, 0.5), 100.5);
  assert.equal(calculateDynamicPriceChange(100, -100, 1, 0.5), 99.5);
});

test('recalculating with the same gameweek baseline and inputs is stable', () => {
  const firstRun = calculateDynamicPriceChange(5, 12, 0.4, 0.5);
  const rerun = calculateDynamicPriceChange(5, 12, 0.4, 0.5);

  assert.equal(firstRun, rerun);
  assert.equal(firstRun, 5.28);
});
