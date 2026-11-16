import { resolveHeroName } from './dota-heroes';

describe('resolveHeroName', () => {
  it('resolves numeric provider placeholders to a known display name', () => {
    expect(resolveHeroName(155, 'Hero 155')).toBe('Largo');
    expect(resolveHeroName(155, '155')).toBe('Largo');
    expect(resolveHeroName(undefined, 'Hero 155')).toBe('Largo');
  });

  it('preserves a provider-supplied display name', () => {
    expect(resolveHeroName(155, 'Largo')).toBe('Largo');
  });
});
