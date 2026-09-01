import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDynamicPriceChange } from '../update-player-prices';

test('dynamic price change is capped to the configured weekly movement', () => {
  assert.ok(Math.abs(calculateDynamicPriceChange(100, 5, 0.2, 0.5) - 100.5) < 0.01);
  assert.ok(Math.abs(calculateDynamicPriceChange(100, -10, 0.2, 0.5) - 99.5) < 0.01);
  assert.ok(Math.abs(calculateDynamicPriceChange(100, 25, 0.2, 0.5) - 100.5) < 0.01);
  assert.ok(Math.abs(calculateDynamicPriceChange(100, -25, 0.2, 0.5) - 99.5) < 0.01);
});
