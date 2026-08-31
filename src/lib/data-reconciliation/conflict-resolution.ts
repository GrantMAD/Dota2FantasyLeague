/**
 * Conflict Resolution Strategy
 * 
 * Detects and resolves conflicts when data comes from multiple providers
 * (STRATZ, OpenDota, etc.) with conflicting information.
 * 
 * Strategy: Provider precedence with confidence scoring
 */

export type DataProvider = 'stratz' | 'opendota' | 'manual_override';

export interface DataConflict {
  id: string;
  entity_type: 'player' | 'team' | 'tournament' | 'match';
  entity_id: string;
  field_name: string;
  value_1: unknown;
  provider_1: DataProvider;
  value_2: unknown;
  provider_2: DataProvider;
  resolved_value?: unknown;
  resolved_provider?: DataProvider;
  resolution_strategy?: 'provider_precedence' | 'manual_override' | 'merge';
  status: 'unresolved' | 'resolved' | 'ignored';
  created_at: string;
  resolved_at?: string;
  resolved_by?: string; // Admin user ID
  notes?: string;
}

export interface ProviderConfidence {
  provider: DataProvider;
  field: string;
  confidence: number; // 0.0 to 1.0
  last_updated: string;
}

/**
 * Provider precedence order (higher = more trusted)
 * STRATZ is generally more reliable for Dota 2 pro data
 */
export const PROVIDER_PRECEDENCE: Record<DataProvider, number> = {
  manual_override: 3, // Admin corrections always win
  stratz: 2, // Primary data source
  opendota: 1, // Fallback source
};

/**
 * Field-specific confidence adjustments
 * Some fields are more reliable from certain providers
 */
export const FIELD_CONFIDENCE: Record<string, Record<DataProvider, number>> = {
  name: {
    stratz: 0.95,
    opendota: 0.90,
    manual_override: 1.0,
  },
  steamId: {
    stratz: 0.98,
    opendota: 0.95,
    manual_override: 1.0,
  },
  team_id: {
    stratz: 0.92,
    opendota: 0.85,
    manual_override: 1.0,
  },
  profileImageUrl: {
    stratz: 0.88,
    opendota: 0.80,
    manual_override: 1.0,
  },
  country: {
    stratz: 0.85,
    opendota: 0.75,
    manual_override: 1.0,
  },
  matchResult: {
    stratz: 0.99,
    opendota: 0.98,
    manual_override: 1.0,
  },
  playerStats: {
    stratz: 0.97,
    opendota: 0.96,
    manual_override: 1.0,
  },
};

/**
 * Detect if two values conflict
 */
export function hasConflict(value1: unknown, value2: unknown): boolean {
  // Null/undefined values don't create conflicts
  if (value1 == null || value2 == null) {
    return false;
  }

  // String comparison (case-insensitive for names)
  if (typeof value1 === 'string' && typeof value2 === 'string') {
    return value1.toLowerCase().trim() !== value2.toLowerCase().trim();
  }

  // Numeric comparison with tolerance for floating point
  if (typeof value1 === 'number' && typeof value2 === 'number') {
    return Math.abs(value1 - value2) > 0.01;
  }

  // Direct comparison for other types
  return value1 !== value2;
}

/**
 * Resolve a conflict using provider precedence
 */
export function resolveConflict(
  value1: unknown,
  provider1: DataProvider,
  value2: unknown,
  provider2: DataProvider,
  field: string
): {
  resolvedValue: unknown;
  resolvedProvider: DataProvider;
  confidence: number;
} {
  // Check if there's actually a conflict
  if (!hasConflict(value1, value2)) {
    return {
      resolvedValue: value1 ?? value2,
      resolvedProvider: value1 ? provider1 : provider2,
      confidence: 1.0,
    };
  }

  // Get confidence for each provider-field combination
  const confidence1 =
    FIELD_CONFIDENCE[field]?.[provider1] ??
    (PROVIDER_PRECEDENCE[provider1] / 3) * 0.9;
  const confidence2 =
    FIELD_CONFIDENCE[field]?.[provider2] ??
    (PROVIDER_PRECEDENCE[provider2] / 3) * 0.9;

  // If one has significantly higher confidence, use that
  if (confidence1 > confidence2 + 0.05) {
    return {
      resolvedValue: value1,
      resolvedProvider: provider1,
      confidence: confidence1,
    };
  }

  if (confidence2 > confidence1 + 0.05) {
    return {
      resolvedValue: value2,
      resolvedProvider: provider2,
      confidence: confidence2,
    };
  }

  // If confidences are similar, use provider precedence
  const precedence1 = PROVIDER_PRECEDENCE[provider1];
  const precedence2 = PROVIDER_PRECEDENCE[provider2];

  if (precedence1 > precedence2) {
    return {
      resolvedValue: value1,
      resolvedProvider: provider1,
      confidence: confidence1,
    };
  }

  return {
    resolvedValue: value2,
    resolvedProvider: provider2,
    confidence: confidence2,
  };
}

/**
 * Create a conflict record for tracking/audit
 */
export function createConflictRecord(
  entityType: 'player' | 'team' | 'tournament' | 'match',
  entityId: string,
  field: string,
  value1: unknown,
  provider1: DataProvider,
  value2: unknown,
  provider2: DataProvider
): DataConflict {
  const { resolvedValue, resolvedProvider, confidence } = resolveConflict(
    value1,
    provider1,
    value2,
    provider2,
    field
  );

  return {
    id: `conflict-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    entity_type: entityType,
    entity_id: entityId,
    field_name: field,
    value_1: value1,
    provider_1: provider1,
    value_2: value2,
    provider_2: provider2,
    resolved_value: resolvedValue,
    resolved_provider: resolvedProvider,
    resolution_strategy: 'provider_precedence',
    status: confidence === 1.0 ? 'resolved' : 'unresolved',
    created_at: new Date().toISOString(),
    resolved_at: confidence === 1.0 ? new Date().toISOString() : undefined,
  };
}

/**
 * Merge two versions of an entity, resolving conflicts field by field
 */
export function mergeEntities(
  entity1: Record<string, unknown>,
  provider1: DataProvider,
  entity2: Record<string, unknown>,
  provider2: DataProvider,
  fieldsToCheck: string[]
): {
  merged: Record<string, unknown>;
  conflicts: DataConflict[];
} {
  const merged: Record<string, unknown> = { ...entity1 };
  const conflicts: DataConflict[] = [];

  for (const field of fieldsToCheck) {
    const value1 = entity1[field];
    const value2 = entity2[field];

    if (hasConflict(value1, value2)) {
      const { resolvedValue, resolvedProvider } = resolveConflict(
        value1,
        provider1,
        value2,
        provider2,
        field
      );

      merged[field] = resolvedValue;

      // Track for audit
      conflicts.push({
        id: `conflict-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        entity_type: 'player', // Generic placeholder
        entity_id: entity1.id as string,
        field_name: field,
        value_1: value1,
        provider_1: provider1,
        value_2: value2,
        provider_2: provider2,
        resolved_value: resolvedValue,
        resolved_provider: resolvedProvider,
        resolution_strategy: 'provider_precedence',
        status: 'resolved',
        created_at: new Date().toISOString(),
        resolved_at: new Date().toISOString(),
      });
    } else if (value2 != null && value1 == null) {
      // Prefer populated value from provider2
      merged[field] = value2;
    }
  }

  return { merged, conflicts };
}
