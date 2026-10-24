import { getCountryOptions } from './country-options';

describe('getCountryOptions', () => {
  it('includes the complete ISO alpha-2 country and territory list', () => {
    const options = getCountryOptions();
    const codes = new Set(options.map(({ code }) => code));

    expect(options.length).toBeGreaterThanOrEqual(249);
    expect(codes.has('US')).toBe(true);
    expect(codes.has('CN')).toBe(true);
    expect(codes.has('PH')).toBe(true);
    expect(codes.has('GB')).toBe(true);
    expect(codes.has('UK')).toBe(true);
    expect(codes.has('AQ')).toBe(true);
  });

  it('sorts the display names alphabetically', () => {
    const names = getCountryOptions().map(({ name }) => name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });
});
