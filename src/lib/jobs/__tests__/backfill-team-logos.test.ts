import { parseTeamLogoProviderId } from '../backfill-team-logos';

describe('parseTeamLogoProviderId', () => {
  it('strips the OpenDota namespace before API lookups', () => {
    expect(parseTeamLogoProviderId('opendota:12345')).toEqual({
      provider: 'opendota',
      teamId: '12345',
    });
  });

  it('preserves unnamespaced provider IDs for the STRATZ fallback', () => {
    expect(parseTeamLogoProviderId('67890')).toEqual({
      provider: 'stratz',
      teamId: '67890',
    });
  });
});
