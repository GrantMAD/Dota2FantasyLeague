export function getEmailConfirmationRedirectUrl(requestUrl: string): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const baseUrl = configuredSiteUrl ? new URL(configuredSiteUrl) : new URL(requestUrl);

  if (!['http:', 'https:'].includes(baseUrl.protocol)) {
    throw new Error('Email confirmation site URL must use HTTP or HTTPS.');
  }

  return new URL('/auth/callback', baseUrl).toString();
}
