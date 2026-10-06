/**
 * Data Provider Configuration
 * 
 * Handles provider selection, initialization, and fallback logic
 * based on environment variables
 */

import { DataProvider } from './provider-interface';
import { StratzProvider } from './stratz-provider';
import { OpenDotaProvider } from './opendota-provider';
import { ResilientDataProvider } from './resilient-provider';

type ProviderType = 'stratz' | 'opendota';

interface ProviderConfig {
  primary: ProviderType;
  fallback?: ProviderType;
  stratz?: {
    apiKey?: string;
    apiUrl?: string;
  };
  opendota?: {
    apiUrl?: string;
  };
}

let cachedProvider: DataProvider | null = null;
let providerHealthy = true;

/**
 * Get or create the configured data provider
 * Uses environment variables:
 * - NEXT_PUBLIC_DATA_PROVIDER: primary provider (stratz|opendota)
 * - STRATZ_API_KEY: STRATZ API key
 * - STRATZ_API_URL: STRATZ GraphQL endpoint (default: https://api.stratz.com/graphql)
 * - OPENDOTA_API_URL: OpenDota API endpoint (default: https://api.opendota.com/api)
 */
export async function getDataProvider(): Promise<DataProvider> {
  // Keep the resilient wrapper cached so request failures can trigger runtime fallback.
  if (cachedProvider && providerHealthy) {
    return cachedProvider;
  }

  const config = buildProviderConfig();
  let primaryProvider: DataProvider | undefined;
  let fallbackProvider: DataProvider | undefined;
  let primaryInitializationError: unknown;
  let fallbackInitializationError: unknown;
  try {
    primaryProvider = createProvider(config.primary, config);
  } catch (error) {
    primaryInitializationError = error;
    console.error(`Failed to initialize primary provider (${config.primary}):`, error);
  }

  if (config.fallback) {
    try {
      fallbackProvider = createProvider(config.fallback, config);
    } catch (error) {
      fallbackInitializationError = error;
      console.error(`Failed to initialize fallback provider (${config.fallback}):`, error);
    }
  }

  const [primaryHealthy, fallbackHealthy] = await Promise.all([
    primaryProvider ? primaryProvider.healthCheck().catch((error) => {
      console.warn(`Primary provider (${config.primary}) health check failed:`, error);
      return false;
    }) : Promise.resolve(false),
    fallbackProvider ? fallbackProvider.healthCheck().catch((error) => {
      console.warn(`Fallback provider (${config.fallback}) health check failed:`, error);
      return false;
    }) : Promise.resolve(false),
  ]);

  if (!primaryHealthy && !fallbackHealthy) {
    throw new Error(
      `All data providers failed. Primary (${config.primary}): ` +
      `${primaryInitializationError instanceof Error ? primaryInitializationError.message : primaryHealthy ? 'unavailable' : 'health check failed'}; ` +
      `Fallback (${config.fallback ?? 'not configured'}): ` +
      `${fallbackInitializationError instanceof Error ? fallbackInitializationError.message : config.fallback ? 'health check failed' : 'not configured'}`
    );
  }

  if (primaryProvider && primaryHealthy) {
    if (fallbackProvider && !fallbackHealthy) {
      console.warn(`Fallback provider ${fallbackProvider.name} is currently unhealthy; it will be rechecked during failover`);
    }
    cachedProvider = new ResilientDataProvider(primaryProvider, fallbackProvider, true);
  } else if (primaryProvider && fallbackProvider && fallbackHealthy) {
    console.warn(`Primary provider ${primaryProvider.name} is unhealthy; runtime fallback is active`);
    cachedProvider = new ResilientDataProvider(primaryProvider, fallbackProvider, false);
  } else if (fallbackProvider && fallbackHealthy) {
    console.warn(`Using fallback provider ${fallbackProvider.name}; primary is unavailable`);
    cachedProvider = fallbackProvider;
  } else {
    throw new Error('Provider initialization reached an invalid state');
  }

  providerHealthy = true;
  return cachedProvider;
}

/**
 * Manually set provider health status
 * Used after failed provider operations to trigger fallback on next call
 */
export function setProviderHealthy(healthy: boolean) {
  providerHealthy = healthy;
}

/**
 * Reset cached provider (useful for testing)
 */
export function resetProvider() {
  cachedProvider = null;
  providerHealthy = true;
}

/**
 * Get list of available providers (for admin UI)
 */
export function getAvailableProviders(): ProviderType[] {
  const config = buildProviderConfig();
  return config.fallback ? [config.primary, config.fallback] : [config.primary];
}

function buildProviderConfig(): ProviderConfig {
  const primaryProvider = (
    // Default to OpenDota: free, no API key required, STRATZ schema has changed.
    // Set NEXT_PUBLIC_DATA_PROVIDER=stratz to override.
    process.env.NEXT_PUBLIC_DATA_PROVIDER || 'opendota'
  ).toLowerCase() as ProviderType;

  // Validate primary provider
  if (!['stratz', 'opendota'].includes(primaryProvider)) {
    throw new Error(
      `Invalid NEXT_PUBLIC_DATA_PROVIDER: ${primaryProvider}. Must be 'stratz' or 'opendota'`
    );
  }

  // Determine fallback provider (opposite of primary)
  const fallback: ProviderType = primaryProvider === 'stratz' ? 'opendota' : 'stratz';

  return {
    primary: primaryProvider,
    fallback: process.env.ENABLE_PROVIDER_FALLBACK !== 'false' ? fallback : undefined,
    stratz: {
      apiKey: process.env.STRATZ_API_KEY,
      apiUrl: process.env.STRATZ_API_URL || 'https://api.stratz.com/graphql',
    },
    opendota: {
      apiUrl: process.env.OPENDOTA_API_URL || 'https://api.opendota.com/api',
    },
  };
}

function createProvider(providerType: ProviderType, config: ProviderConfig): DataProvider {
  if (providerType === 'stratz') {
    if (!config.stratz?.apiKey) {
      throw new Error(
        'STRATZ_API_KEY environment variable is required for STRATZ provider'
      );
    }
    return new StratzProvider({
      apiKey: config.stratz.apiKey,
      apiUrl: config.stratz.apiUrl || 'https://api.stratz.com/graphql',
    });
  }

  if (providerType === 'opendota') {
    return new OpenDotaProvider({
      apiUrl: config.opendota?.apiUrl || 'https://api.opendota.com/api',
    });
  }

  throw new Error(`Unknown provider type: ${providerType}`);
}

/**
 * For server-side data fetching in API routes
 * Example usage in /api/data/sync-status route:
 * 
 * ```typescript
 * import { getDataProvider } from '@/lib/data-providers/provider-config';
 * 
 * export async function GET() {
 *   try {
 *     const provider = await getDataProvider();
 *     const players = await provider.fetchPlayers({ limit: 10 });
 *     return Response.json({ success: true, players });
 *   } catch (error) {
 *     return Response.json(
 *       { success: false, error: error.message },
 *       { status: 500 }
 *     );
 *   }
 * }
 * ```
 */
export default getDataProvider;
