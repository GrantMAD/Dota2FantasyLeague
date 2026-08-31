/**
 * Data Provider Configuration
 * 
 * Handles provider selection, initialization, and fallback logic
 * based on environment variables
 */

import { DataProvider } from './provider-interface';
import { StratzProvider } from './stratz-provider';
import { OpenDotaProvider } from './opendota-provider';

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
  // Return cached provider if available and healthy
  if (cachedProvider && providerHealthy) {
    return cachedProvider;
  }

  const config = buildProviderConfig();

  try {
    const provider = createProvider(config.primary, config);
    
    // Verify provider is accessible
    const isHealthy = await provider.healthCheck();
    if (isHealthy) {
      cachedProvider = provider;
      providerHealthy = true;
      return provider;
    } else {
      throw new Error(`${config.primary} provider health check failed`);
    }
  } catch (error) {
    console.error(`Failed to initialize primary provider (${config.primary}):`, error);

    if (config.fallback) {
      console.log(`Falling back to ${config.fallback} provider`);
      try {
        const fallbackProvider = createProvider(config.fallback, config);
        const isHealthy = await fallbackProvider.healthCheck();
        
        if (isHealthy) {
          cachedProvider = fallbackProvider;
          providerHealthy = true;
          return fallbackProvider;
        } else {
          throw new Error(`${config.fallback} provider health check failed`);
        }
      } catch (fallbackError) {
        console.error(`Failed to initialize fallback provider (${config.fallback}):`, fallbackError);
        throw new Error(
          `All data providers failed. Primary: ${error}, Fallback: ${fallbackError}`
        );
      }
    } else {
      throw error;
    }
  }
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
    process.env.NEXT_PUBLIC_DATA_PROVIDER || 'stratz'
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
