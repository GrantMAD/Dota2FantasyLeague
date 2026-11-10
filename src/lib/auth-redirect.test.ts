import { getEmailConfirmationRedirectUrl } from './auth-redirect';

describe('getEmailConfirmationRedirectUrl', () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it('uses the request origin for local development when no site URL is configured', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(getEmailConfirmationRedirectUrl('http://localhost:3000/api/auth/signup'))
      .toBe('http://localhost:3000/auth/callback');
  });

  it('uses the configured public site URL for deployed emails', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://fantasy.example';

    expect(getEmailConfirmationRedirectUrl('http://internal-host/api/auth/signup'))
      .toBe('https://fantasy.example/auth/callback');
  });

  it('rejects non-http site URL configurations', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'javascript:alert(1)';

    expect(() => getEmailConfirmationRedirectUrl('http://localhost:3000'))
      .toThrow('Email confirmation site URL must use HTTP or HTTPS.');
  });
});
