import { getPageGuideKey, getPageGuideTitle, getPageTourKey, hasPageGuide, hasPageTour } from './pageGuideRoutes';

describe('page guide route index', () => {
  it('resolves supported parameterized pages without loading their content', () => {
    expect(getPageGuideKey('/players/42')).toBe('/players/[id]');
    expect(getPageTourKey('/matches/123')).toBe('/matches/[id]');
    expect(hasPageGuide('/tournaments/championship')).toBe(true);
    expect(hasPageTour('/gameweeks/3')).toBe(true);
  });

  it('does not expose guide or tour controls on unsupported routes', () => {
    expect(getPageGuideKey('/unknown')).toBeUndefined();
    expect(getPageTourKey('/guide')).toBeUndefined();
    expect(hasPageGuide('/unknown')).toBe(false);
    expect(hasPageTour('/unknown')).toBe(false);
  });

  it('provides guide titles without importing the tour content module', () => {
    expect(getPageGuideTitle('/players/42')).toBe('Player Profile');
    expect(getPageGuideTitle('/guide')).toBe('Interactive Guide Directory');
    expect(getPageGuideTitle('/unknown')).toBe('Page guide');
  });
});
