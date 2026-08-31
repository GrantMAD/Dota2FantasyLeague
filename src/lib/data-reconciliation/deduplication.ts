/**
 * Deduplication & Entity Matching
 * 
 * Detects and merges duplicate records from multiple data providers
 * Uses fuzzy matching and field comparison to identify duplicates
 */

export interface DeduplicationMatch {
  id: string;
  entity_type: 'player' | 'team' | 'tournament' | 'match';
  canonical_id: string; // The record we keep
  duplicate_id: string; // The record we're merging
  match_confidence: number; // 0.0 to 1.0
  matching_fields: string[];
  provider_canonical: string;
  provider_duplicate: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'merged';
  merged_at?: string;
  merged_by?: string; // Admin user ID
  notes?: string;
  created_at: string;
}

/**
 * Fuzzy string matching score (0.0 to 1.0)
 * Based on Levenshtein distance-like approach
 */
export function calculateStringMatch(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;

  // Exact match is perfect
  if (s1 === s2) return 1.0;

  // Partial match scoring
  if (s1.includes(s2) || s2.includes(s1)) {
    const matchLength = Math.min(s1.length, s2.length);
    const totalLength = Math.max(s1.length, s2.length);
    return matchLength / totalLength;
  }

  // Levenshtein distance based
  const maxLength = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  return Math.max(0, 1 - distance / maxLength);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Numeric matching (within tolerance)
 */
export function calculateNumericMatch(
  num1: number,
  num2: number,
  tolerance: number = 0.01
): number {
  if (num1 === num2) return 1.0;
  const diff = Math.abs(num1 - num2);
  if (diff <= tolerance) return 1.0;
  // Diminishing returns beyond tolerance
  return Math.max(0, 1 - diff / Math.max(Math.abs(num1), Math.abs(num2), 1));
}

/**
 * Compare two player records for duplication
 */
export function comparePlayerRecords(
  player1: Record<string, unknown>,
  player2: Record<string, unknown>
): {
  overallConfidence: number;
  fieldScores: Record<string, number>;
  matchingFields: string[];
} {
  const fieldScores: Record<string, number> = {};
  const matchingFields: string[] = [];
  const weights: Record<string, number> = {
    steamId: 0.4, // Most unique identifier
    name: 0.3,
    country: 0.1,
    team_id: 0.15,
    profileImageUrl: 0.05,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [field, weight] of Object.entries(weights)) {
    const val1 = player1[field];
    const val2 = player2[field];

    if (val1 == null || val2 == null) {
      fieldScores[field] = 0;
      continue;
    }

    let score = 0;

    if (typeof val1 === 'string' && typeof val2 === 'string') {
      score = calculateStringMatch(val1, val2);
    } else if (typeof val1 === 'number' && typeof val2 === 'number') {
      score = calculateNumericMatch(val1, val2);
    } else {
      score = val1 === val2 ? 1.0 : 0;
    }

    fieldScores[field] = score;
    weightedSum += score * weight;
    totalWeight += weight;

    if (score >= 0.9) {
      matchingFields.push(field);
    }
  }

  const overallConfidence =
    totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    overallConfidence,
    fieldScores,
    matchingFields,
  };
}

/**
 * Compare two team records for duplication
 */
export function compareTeamRecords(
  team1: Record<string, unknown>,
  team2: Record<string, unknown>
): {
  overallConfidence: number;
  fieldScores: Record<string, number>;
  matchingFields: string[];
} {
  const fieldScores: Record<string, number> = {};
  const matchingFields: string[] = [];
  const weights: Record<string, number> = {
    name: 0.4,
    tag: 0.3,
    region: 0.2,
    country: 0.1,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [field, weight] of Object.entries(weights)) {
    const val1 = team1[field];
    const val2 = team2[field];

    if (val1 == null || val2 == null) {
      fieldScores[field] = 0;
      continue;
    }

    let score = 0;

    if (typeof val1 === 'string' && typeof val2 === 'string') {
      score = calculateStringMatch(val1, val2);
    } else {
      score = val1 === val2 ? 1.0 : 0;
    }

    fieldScores[field] = score;
    weightedSum += score * weight;
    totalWeight += weight;

    if (score >= 0.85) {
      matchingFields.push(field);
    }
  }

  const overallConfidence =
    totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    overallConfidence,
    fieldScores,
    matchingFields,
  };
}

/**
 * Create a deduplication match record
 */
export function createDeduplicationMatch(
  entityType: 'player' | 'team' | 'tournament' | 'match',
  canonicalId: string,
  duplicateId: string,
  matchConfidence: number,
  matchingFields: string[],
  providerCanonical: string,
  providerDuplicate: string
): DeduplicationMatch {
  return {
    id: `dedup-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    entity_type: entityType,
    canonical_id: canonicalId,
    duplicate_id: duplicateId,
    match_confidence: matchConfidence,
    matching_fields: matchingFields,
    provider_canonical: providerCanonical,
    provider_duplicate: providerDuplicate,
    status: matchConfidence >= 0.95 ? 'approved' : 'pending_review',
    created_at: new Date().toISOString(),
  };
}

/**
 * Find potential duplicates in a list of records
 */
export function findDuplicates(
  records: Array<Record<string, unknown> & { id: string; _provider: string }>,
  entityType: 'player' | 'team',
  confidenceThreshold: number = 0.85
): DeduplicationMatch[] {
  const matches: DeduplicationMatch[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const r1 = records[i];
      const r2 = records[j];

      // Skip if we've already flagged this pair
      const pairKey = [r1.id, r2.id].sort().join('|');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      let comparison;
      if (entityType === 'player') {
        comparison = comparePlayerRecords(r1, r2);
      } else {
        comparison = compareTeamRecords(r1, r2);
      }

      if (comparison.overallConfidence >= confidenceThreshold) {
        const match = createDeduplicationMatch(
          entityType,
          r1.id,
          r2.id,
          comparison.overallConfidence,
          comparison.matchingFields,
          r1._provider as string,
          r2._provider as string
        );
        matches.push(match);
      }
    }
  }

  return matches;
}

/**
 * Resolve a deduplication by merging records
 */
export function resolveDuplication(
  canonical: Record<string, unknown>,
  duplicate: Record<string, unknown>,
  strategy: 'keep_canonical' | 'keep_duplicate' | 'merge' = 'merge'
): Record<string, unknown> {
  if (strategy === 'keep_canonical') {
    return canonical;
  }

  if (strategy === 'keep_duplicate') {
    return duplicate;
  }

  // Merge: prefer non-null values, prefer canonical for conflicts
  const merged = { ...canonical };

  for (const [key, value] of Object.entries(duplicate)) {
    if (key === 'id' || key === '_provider') continue;

    if (value != null && merged[key] == null) {
      merged[key] = value;
    }
  }

  return merged;
}
