/**
 * Data Quality Metrics & Monitoring
 * 
 * Tracks data quality scores, identifies anomalies, and flags low-confidence data
 * Enables data-driven admin decisions and automated quality enforcement
 */

export interface DataQualityScore {
  id: string;
  entity_type: 'player' | 'team' | 'tournament' | 'match' | 'system';
  entity_id?: string;
  overall_score: number; // 0.0 to 1.0
  completeness_score: number; // % of fields populated
  consistency_score: number; // % fields matching across providers
  freshness_score: number; // How recent the data is (0 = stale, 1 = fresh)
  reliability_score: number; // Based on provider confidence
  issues: QualityIssue[];
  created_at: string;
  last_checked_at: string;
}

export interface QualityIssue {
  type:
    | 'missing_field'
    | 'conflicting_data'
    | 'outdated_data'
    | 'anomaly'
    | 'low_confidence'
    | 'unverified';
  field?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata?: Record<string, unknown>;
}

export interface DataQualityMetrics {
  total_entities: number;
  entities_by_quality: {
    excellent: number; // > 0.9
    good: number; // 0.8-0.9
    fair: number; // 0.7-0.8
    poor: number; // 0.5-0.7
    critical: number; // < 0.5
  };
  average_completeness: number;
  average_consistency: number;
  average_freshness: number;
  average_reliability: number;
  top_issues: QualityIssue[];
  last_updated: string;
}

/**
 * Calculate completeness score for an entity
 */
export function calculateCompletenessScore(
  data: Record<string, unknown>,
  requiredFields: string[]
): number {
  if (requiredFields.length === 0) return 1.0;

  const populatedCount = requiredFields.filter(
    field => data[field] != null && data[field] !== ''
  ).length;

  return populatedCount / requiredFields.length;
}

/**
 * Calculate consistency score (how aligned are values across providers)
 */
export function calculateConsistencyScore(
  versions: Array<{ value: unknown; provider: string }>
): number {
  if (versions.length <= 1) return 1.0;

  const values = versions.map(v => JSON.stringify(v.value));
  const uniqueValues = new Set(values);

  // No conflicts = perfect consistency
  if (uniqueValues.size === 1) return 1.0;

  // Calculate how many versions agree with the most common value
  const valueCounts = new Map<string, number>();
  for (const value of values) {
    valueCounts.set(value, (valueCounts.get(value) ?? 0) + 1);
  }

  const maxCount = Math.max(...valueCounts.values());
  return maxCount / versions.length;
}

/**
 * Calculate freshness score (0 = stale, 1 = fresh)
 */
export function calculateFreshnessScore(
  lastSyncedAt: Date,
  stalThresholdDays: number = 7,
  veryFreshThresholdHours: number = 24
): number {
  const now = new Date();
  const hoursSinceSyncmilliseconds = now.getTime() - lastSyncedAt.getTime();
  const hoursSinceSync = hoursSinceSyncmilliseconds / (1000 * 60 * 60);
  const daysSinceSync = hoursSinceSync / 24;

  // Data synced within veryFreshThreshold is considered fresh
  if (hoursSinceSync <= veryFreshThresholdHours) return 1.0;

  // Linear decay from fresh to stale over the threshold
  if (daysSinceSync <= stalThresholdDays) {
    return 1.0 - daysSinceSync / stalThresholdDays * 0.5; // Drops to 0.5 at threshold
  }

  // Beyond threshold, continues to decay
  return Math.max(0, 0.5 - (daysSinceSync - stalThresholdDays) / 30 * 0.5);
}

/**
 * Calculate reliability score based on provider confidence
 */
export function calculateReliabilityScore(
  providerConfidences: Record<string, number>
): number {
  if (Object.keys(providerConfidences).length === 0) return 0;

  const values = Object.values(providerConfidences);
  const average = values.reduce((a, b) => a + b, 0) / values.length;

  return average;
}

/**
 * Detect anomalies in data (outliers, suspicious patterns)
 */
export function detectAnomalies(
  data: Record<string, unknown>,
  entityType: 'player' | 'team' | 'tournament' | 'match'
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (entityType === 'player') {
    // Check for suspicious values
    const role = data.primary_role;
    if (role && !['Carry', 'Mid', 'Offlane', 'Support', 'Hard Support'].includes(role as string)) {
      issues.push({
        type: 'anomaly',
        field: 'primary_role',
        severity: 'medium',
        description: `Invalid role: ${role}`,
        metadata: { value: role },
      });
    }
  }

  if (entityType === 'match') {
    // Check for time inconsistencies
    const startedAt = data.start_time ? new Date(data.start_time as string) : null;
    const endedAt = data.end_time ? new Date(data.end_time as string) : null;

    if (startedAt && endedAt && endedAt <= startedAt) {
      issues.push({
        type: 'anomaly',
        severity: 'high',
        description: 'Match end time is before or equal to start time',
        metadata: { startedAt, endedAt },
      });
    }

    // Check for unrealistic duration
    if (startedAt && endedAt) {
      const durationMinutes =
        (endedAt.getTime() - startedAt.getTime()) / (1000 * 60);
      if (durationMinutes < 10) {
        issues.push({
          type: 'anomaly',
          severity: 'high',
          description: `Unrealistic match duration: ${durationMinutes} minutes`,
          metadata: { durationMinutes },
        });
      }
      if (durationMinutes > 300) {
        issues.push({
          type: 'anomaly',
          severity: 'medium',
          description: `Unusually long match: ${durationMinutes} minutes`,
          metadata: { durationMinutes },
        });
      }
    }
  }

  return issues;
}

/**
 * Calculate overall data quality score for an entity
 */
export function calculateQualityScore(
  data: Record<string, unknown>,
  entityType: 'player' | 'team' | 'tournament' | 'match',
  lastSyncedAt?: Date,
  providerConfidences?: Record<string, number>,
  versions?: Array<{ value: unknown; provider: string }>
): DataQualityScore {
  // Define required fields per entity type
  const requiredFields: Record<string, string[]> = {
    player: [
      'id',
      'name',
      'steamId',
      'availability_status',
      'data_provider_id',
    ],
    team: ['id', 'name', 'tag', 'data_provider_id'],
    tournament: ['id', 'name', 'start_date', 'end_date'],
    match: ['id', 'status', 'scheduled_time', 'team_a_id', 'team_b_id'],
  };

  const completeness = calculateCompletenessScore(
    data,
    requiredFields[entityType] || []
  );
  const consistency = versions
    ? calculateConsistencyScore(versions)
    : 1.0;
  const freshness = lastSyncedAt
    ? calculateFreshnessScore(lastSyncedAt)
    : 0.5;
  const reliability = providerConfidences
    ? calculateReliabilityScore(providerConfidences)
    : 0.7;

  const issues = detectAnomalies(data, entityType);

  // Weight the scores
  const overallScore =
    completeness * 0.3 +
    consistency * 0.25 +
    freshness * 0.2 +
    reliability * 0.25;

  // Deduct points for issues
  const issueDeduction =
    (issues.filter(i => i.severity === 'critical').length * 0.1 +
      issues.filter(i => i.severity === 'high').length * 0.05 +
      issues.filter(i => i.severity === 'medium').length * 0.02) /
    100;

  const finalScore = Math.max(0, Math.min(1, overallScore - issueDeduction));

  return {
    id: `quality-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    entity_type: entityType,
    entity_id: data.id as string,
    overall_score: finalScore,
    completeness_score: completeness,
    consistency_score: consistency,
    freshness_score: freshness,
    reliability_score: reliability,
    issues,
    created_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
  };
}

/**
 * Flag entities that need admin review
 */
export function shouldFlagForReview(score: DataQualityScore): boolean {
  // Flag if overall score is low
  if (score.overall_score < 0.7) return true;

  // Flag if any critical issues
  if (score.issues.some(i => i.severity === 'critical')) return true;

  // Flag if stale data
  if (score.freshness_score < 0.3) return true;

  // Flag if low consistency
  if (score.consistency_score < 0.6) return true;

  return false;
}

/**
 * Generate summary metrics across multiple entities
 */
export function generateMetricsSummary(
  scores: DataQualityScore[]
): DataQualityMetrics {
  const qualityCounts = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
    critical: 0,
  };

  const allIssues: QualityIssue[] = [];

  for (const score of scores) {
    if (score.overall_score > 0.9) qualityCounts.excellent++;
    else if (score.overall_score > 0.8) qualityCounts.good++;
    else if (score.overall_score > 0.7) qualityCounts.fair++;
    else if (score.overall_score > 0.5) qualityCounts.poor++;
    else qualityCounts.critical++;

    allIssues.push(...score.issues);
  }

  // Find top issues by frequency
  const issueCounts = new Map<string, { issue: QualityIssue; count: number }>();
  for (const issue of allIssues) {
    const key = `${issue.type}-${issue.field || 'global'}`;
    if (issueCounts.has(key)) {
      const existing = issueCounts.get(key)!;
      existing.count++;
    } else {
      issueCounts.set(key, { issue, count: 1 });
    }
  }

  const topIssues = Array.from(issueCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(({ issue }) => issue);

  const avgCompleteness =
    scores.reduce((sum, s) => sum + s.completeness_score, 0) / scores.length ||
    0;
  const avgConsistency =
    scores.reduce((sum, s) => sum + s.consistency_score, 0) / scores.length ||
    0;
  const avgFreshness =
    scores.reduce((sum, s) => sum + s.freshness_score, 0) / scores.length ||
    0;
  const avgReliability =
    scores.reduce((sum, s) => sum + s.reliability_score, 0) / scores.length ||
    0;

  return {
    total_entities: scores.length,
    entities_by_quality: qualityCounts,
    average_completeness: avgCompleteness,
    average_consistency: avgConsistency,
    average_freshness: avgFreshness,
    average_reliability: avgReliability,
    top_issues: topIssues,
    last_updated: new Date().toISOString(),
  };
}
