import { parseFormattedNumber } from './useCountUp';

describe('parseFormattedNumber', () => {
  it('correctly parses plain numbers', () => {
    expect(parseFormattedNumber(342)).toEqual({
      prefix: '',
      value: 342,
      decimals: 0,
      suffix: '',
    });
    expect(parseFormattedNumber(45.5)).toEqual({
      prefix: '',
      value: 45.5,
      decimals: 1,
      suffix: '',
    });
    expect(parseFormattedNumber(0)).toEqual({
      prefix: '',
      value: 0,
      decimals: 0,
      suffix: '',
    });
  });

  it('correctly parses numbers with suffixes', () => {
    expect(parseFormattedNumber('44.2M')).toEqual({
      prefix: '',
      value: 44.2,
      decimals: 1,
      suffix: 'M',
    });
    expect(parseFormattedNumber('100k')).toEqual({
      prefix: '',
      value: 100,
      decimals: 0,
      suffix: 'k',
    });
    expect(parseFormattedNumber('$45.0M')).toEqual({
      prefix: '$',
      value: 45.0,
      decimals: 1,
      suffix: 'M',
    });
  });

  it('returns null for non-numeric strings', () => {
    expect(parseFormattedNumber('-')).toBeNull();
    expect(parseFormattedNumber('Unranked')).toBeNull();
    expect(parseFormattedNumber('')).toBeNull();
  });
});
