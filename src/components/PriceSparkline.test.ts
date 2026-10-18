import { getPriceSparklineData } from './PriceSparkline';

describe('PriceSparkline data calculation and styling', () => {
  it('returns flat baseline when no data is provided', () => {
    const result = getPriceSparklineData(null);
    expect(result.points).toEqual([]);
    expect(result.trend).toBe('flat');
    expect(result.ariaLabel).toBe('No price trend data');
    expect(result.coords).toEqual([]);
  });

  it('handles single price point correctly', () => {
    const result = getPriceSparklineData([5.5]);
    expect(result.points).toEqual([5.5]);
    expect(result.trend).toBe('flat');
    expect(result.ariaLabel).toBe('Price steady at $5.5M');
    expect(result.coords).toEqual([]);
  });

  it('calculates rising price trend correctly with emerald stroke', () => {
    const result = getPriceSparklineData([5.0, 5.2, 5.5, 5.8]);
    expect(result.points).toEqual([5.0, 5.2, 5.5, 5.8]);
    expect(result.trend).toBe('up');
    expect(result.strokeColor).toBe('#34d399');
    expect(result.ariaLabel).toContain('Price trend: up from $5.0M to $5.8M across 4 gameweeks');
    expect(result.coords).toHaveLength(4);
    expect(result.pathData).toMatch(/^ M \d+(\.\d+)? \d+(\.\d+)?/);
  });

  it('calculates falling price trend correctly with rose stroke', () => {
    const result = getPriceSparklineData([8.0, 7.8, 7.5]);
    expect(result.points).toEqual([8.0, 7.8, 7.5]);
    expect(result.trend).toBe('down');
    expect(result.strokeColor).toBe('#fb7185');
    expect(result.ariaLabel).toContain('Price trend: down from $8.0M to $7.5M across 3 gameweeks');
    expect(result.coords).toHaveLength(3);
  });

  it('calculates flat trend with slate stroke when prices are unchanged', () => {
    const result = getPriceSparklineData([6.0, 6.0, 6.0]);
    expect(result.points).toEqual([6.0, 6.0, 6.0]);
    expect(result.trend).toBe('flat');
    expect(result.strokeColor).toBe('#64748b');
    expect(result.ariaLabel).toContain('Price trend: flat from $6.0M to $6.0M across 3 gameweeks');
  });

  it('filters out non-numeric and NaN values', () => {
    const result = getPriceSparklineData([5.0, NaN, 5.5, undefined as unknown as number, 6.0]);
    expect(result.points).toEqual([5.0, 5.5, 6.0]);
    expect(result.trend).toBe('up');
    expect(result.strokeColor).toBe('#34d399');
  });
});
