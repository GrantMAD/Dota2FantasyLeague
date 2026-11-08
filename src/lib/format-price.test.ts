import { formatPlayerPrice, formatPriceNumber } from './format-price';

describe('format-price utility', () => {
  describe('formatPlayerPrice', () => {
    it('formats 2-decimal cent prices accurately', () => {
      expect(formatPlayerPrice(5.03)).toBe('$5.03M');
      expect(formatPlayerPrice(12.75)).toBe('$12.75M');
    });

    it('formats single decimal prices with trailing zero for consistency', () => {
      expect(formatPlayerPrice(5.0)).toBe('$5.00M');
      expect(formatPlayerPrice(7.5)).toBe('$7.50M');
    });

    it('handles null, undefined, and NaN gracefully', () => {
      expect(formatPlayerPrice(null)).toBe('$0.00M');
      expect(formatPlayerPrice(undefined)).toBe('$0.00M');
      expect(formatPlayerPrice(NaN)).toBe('$0.00M');
    });
  });

  describe('formatPriceNumber', () => {
    it('returns exact string representation with 2 decimals', () => {
      expect(formatPriceNumber(5.03)).toBe('5.03');
      expect(formatPriceNumber(5.0)).toBe('5.00');
      expect(formatPriceNumber(null)).toBe('0.00');
    });
  });
});

