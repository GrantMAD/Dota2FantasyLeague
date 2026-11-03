import { getMatchDataProvider, getProviderConfigurationStatus } from './provider-config';

describe('getProviderConfigurationStatus', () => {
  const originalPrimary = process.env.NEXT_PUBLIC_DATA_PROVIDER;
  const originalFallback = process.env.ENABLE_PROVIDER_FALLBACK;
  const originalStratzApiKey = process.env.STRATZ_API_KEY;
  const originalStratzApiUrl = process.env.STRATZ_API_URL;

  afterEach(() => {
    if (originalPrimary === undefined) delete process.env.NEXT_PUBLIC_DATA_PROVIDER;
    else process.env.NEXT_PUBLIC_DATA_PROVIDER = originalPrimary;
    if (originalFallback === undefined) delete process.env.ENABLE_PROVIDER_FALLBACK;
    else process.env.ENABLE_PROVIDER_FALLBACK = originalFallback;
    if (originalStratzApiKey === undefined) delete process.env.STRATZ_API_KEY;
    else process.env.STRATZ_API_KEY = originalStratzApiKey;
    if (originalStratzApiUrl === undefined) delete process.env.STRATZ_API_URL;
    else process.env.STRATZ_API_URL = originalStratzApiUrl;
  });

  it('defaults to OpenDota as primary and STRATZ as fallback', () => {
    delete process.env.NEXT_PUBLIC_DATA_PROVIDER;
    delete process.env.ENABLE_PROVIDER_FALLBACK;

    expect(getProviderConfigurationStatus()).toEqual({
      primary: 'opendota',
      fallback: 'stratz',
      fallbackEnabled: true,
    });
  });

  it('reports the configured primary and disabled fallback without secrets', () => {
    process.env.NEXT_PUBLIC_DATA_PROVIDER = 'stratz';
    process.env.ENABLE_PROVIDER_FALLBACK = 'false';
    process.env.STRATZ_API_KEY = 'must-not-be-returned';

    const status = getProviderConfigurationStatus();
    expect(status).toEqual({
      primary: 'stratz',
      fallback: null,
      fallbackEnabled: false,
    });
    expect(JSON.stringify(status)).not.toContain('must-not-be-returned');
  });

  it('rejects an unsupported configured primary provider', () => {
    process.env.NEXT_PUBLIC_DATA_PROVIDER = 'unknown';

    expect(() => getProviderConfigurationStatus()).toThrow(
      "Invalid NEXT_PUBLIC_DATA_PROVIDER: unknown. Must be 'stratz' or 'opendota'"
    );
  });

  it('creates a dedicated STRATZ provider for match ingestion regardless of global primary', async () => {
    process.env.NEXT_PUBLIC_DATA_PROVIDER = 'opendota';
    process.env.STRATZ_API_KEY = 'test-key';
    process.env.STRATZ_API_URL = 'https://stratz.example/graphql';

    const provider = await getMatchDataProvider();

    expect(provider.name).toBe('STRATZ');
  });

  it('requires a STRATZ API key for match ingestion', async () => {
    delete process.env.STRATZ_API_KEY;

    await expect(getMatchDataProvider()).rejects.toThrow(
      'STRATZ_API_KEY is required for match ingestion and match detail retrieval.'
    );
  });
});
