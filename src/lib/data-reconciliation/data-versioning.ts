/**
 * Data Versioning & Audit Trail
 * 
 * Tracks all changes to data entities, enabling:
 * - Audit trail for compliance
 * - Rollback capability
 * - Change history visualization
 * - Admin review and approval workflows
 */

export interface DataVersionRecord {
  id: string;
  entity_type: 'player' | 'team' | 'tournament' | 'match' | 'player_stats';
  entity_id: string;
  version_number: number;
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  changed_fields: string[];
  change_reason: string;
  changed_by_provider?: 'stratz' | 'opendota' | 'manual_override' | 'system';
  changed_by_user?: string; // Admin user ID for manual changes
  change_source: 'automated_sync' | 'conflict_resolution' | 'manual_override' | 'api_correction';
  confidence_score?: number; // 0.0 to 1.0
  is_approved: boolean;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  created_at: string;
  metadata?: Record<string, unknown>; // Additional context (e.g., which job triggered the change)
}

/**
 * Compact version for list views
 */
export interface DataVersionSummary {
  version_number: number;
  changed_fields: string[];
  change_source: string;
  changed_by_provider?: string;
  changed_at: string;
  is_approved: boolean;
  confidence_score?: number;
}

/**
 * Create a new version record when data changes
 */
export function createVersionRecord(
  entityType: 'player' | 'team' | 'tournament' | 'match' | 'player_stats',
  entityId: string,
  versionNumber: number,
  previousValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  changeSource: 'automated_sync' | 'conflict_resolution' | 'manual_override' | 'api_correction',
  changeReason: string,
  provider?: 'stratz' | 'opendota' | 'manual_override' | 'system',
  userId?: string,
  confidenceScore?: number
): DataVersionRecord {
  const changedFields = Object.keys(newValues).filter(
    key => JSON.stringify(previousValues[key]) !== JSON.stringify(newValues[key])
  );

  return {
    id: `version-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    entity_type: entityType,
    entity_id: entityId,
    version_number: versionNumber,
    previous_values: previousValues,
    new_values: newValues,
    changed_fields: changedFields,
    change_reason: changeReason,
    changed_by_provider: provider,
    changed_by_user: userId,
    change_source: changeSource,
    confidence_score: confidenceScore,
    is_approved: changeSource === 'manual_override', // Auto-approve manual overrides
    created_at: new Date().toISOString(),
  };
}

/**
 * Detect which fields changed between two versions
 */
export function detectFieldChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): {
  changed: Record<string, { old: unknown; new: unknown }>;
  addedFields: string[];
  removedFields: string[];
} {
  const changed: Record<string, { old: unknown; new: unknown }> = {};
  const addedFields: string[] = [];
  const removedFields: string[] = [];

  // Check for changed and added fields
  for (const key of Object.keys(newData)) {
    if (!(key in oldData)) {
      addedFields.push(key);
    } else if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changed[key] = { old: oldData[key], new: newData[key] };
    }
  }

  // Check for removed fields
  for (const key of Object.keys(oldData)) {
    if (!(key in newData)) {
      removedFields.push(key);
      changed[key] = { old: oldData[key], new: null };
    }
  }

  return { changed, addedFields, removedFields };
}

/**
 * Rollback a data entity to a specific version
 */
export function rollbackToVersion(
  currentData: Record<string, unknown>,
  targetVersion: DataVersionRecord
): Record<string, unknown> {
  return {
    ...currentData,
    ...targetVersion.previous_values,
  };
}

/**
 * Generate a human-readable changelog from version history
 */
export function generateChangelog(versions: DataVersionRecord[]): string {
  const sorted = [...versions].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const lines = [
    `# Change History for ${versions[0]?.entity_type ?? 'Unknown'} ${versions[0]?.entity_id ?? 'Unknown'}`,
    '',
  ];

  for (const version of sorted) {
    lines.push(`## Version ${version.version_number}`);
    lines.push(`- **Date:** ${new Date(version.created_at).toLocaleString()}`);
    lines.push(`- **Source:** ${version.change_source}`);
    lines.push(`- **Provider:** ${version.changed_by_provider ?? 'N/A'}`);
    lines.push(`- **Reason:** ${version.change_reason}`);
    lines.push(`- **Approved:** ${version.is_approved ? 'Yes' : 'Pending'}`);

    if (version.confidence_score) {
      lines.push(
        `- **Confidence:** ${(version.confidence_score * 100).toFixed(1)}%`
      );
    }

    lines.push('');
    lines.push('### Changed Fields:');
    for (const field of version.changed_fields) {
      const oldVal = JSON.stringify(version.previous_values[field]);
      const newVal = JSON.stringify(version.new_values[field]);
      lines.push(`- **${field}:** \`${oldVal}\` → \`${newVal}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Calculate version divergence (how different is this version from the previous one)
 */
export function calculateVersionDivergence(
  version: DataVersionRecord
): number {
  if (version.changed_fields.length === 0) return 0;

  const totalFields = Object.keys({
    ...version.previous_values,
    ...version.new_values,
  }).length;

  return Math.min(version.changed_fields.length / totalFields, 1.0);
}

/**
 * Flag versions that need manual review (high divergence, low confidence, etc.)
 */
export function flagForReview(
  version: DataVersionRecord,
  divergenceThreshold: number = 0.3,
  confidenceThreshold: number = 0.7
): boolean {
  // Flag if high divergence
  if (
    calculateVersionDivergence(version) > divergenceThreshold &&
    version.change_source === 'automated_sync'
  ) {
    return true;
  }

  // Flag if low confidence
  if (
    version.confidence_score &&
    version.confidence_score < confidenceThreshold &&
    !version.is_approved
  ) {
    return true;
  }

  // Flag if not yet approved and from automated sync
  if (!version.is_approved && version.change_source === 'automated_sync') {
    return true;
  }

  return false;
}
