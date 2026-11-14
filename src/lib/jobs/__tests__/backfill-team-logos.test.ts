import { parseTeamLogoProviderId } from '../backfill-team-logos';

describe('parseTeamLogoProviderId', () => {
  it('strips the OpenDota namespace before API lookups', () => {
    expect(parseTeamLogoProviderId('opendota:12345')).toEqual({
      provider: 'opendota',
      teamId: '12345',
    });
  });

  it('strips the steam namespace before API lookups', () => {
    expect(parseTeamLogoProviderId('steam:10322861')).toEqual({
      provider: 'steam',
      teamId: '10322861',
    });
  });

  it('preserves unnamespaced provider IDs for the STRATZ fallback', () => {
    expect(parseTeamLogoProviderId('67890')).toEqual({
      provider: 'stratz',
      teamId: '67890',
    });
  });
});
