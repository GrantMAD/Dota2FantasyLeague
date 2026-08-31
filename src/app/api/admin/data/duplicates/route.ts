/**
 * GET /api/admin/data/duplicates
 * 
 * List potential duplicate records
 * Query params:
 *   - entity_type: player|team|tournament|match (optional)
 *   - status: pending_review|approved|rejected|merged (default: pending_review)
 *   - limit: number (default: 50)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDeduplicationMatches, verifyAdminAuth } from '@/lib/data-reconciliation/admin-utils';

export async function GET(request: NextRequest) {
  const adminId = await verifyAdminAuth(request);
  if (!adminId) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin access required' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const entityTypeParam = searchParams.get('entity_type');
  const entityType: 'player' | 'team' | 'tournament' | 'match' | undefined = entityTypeParam 
    ? (entityTypeParam as 'player' | 'team' | 'tournament' | 'match') 
    : undefined;
  const statusParam = searchParams.get('status') || 'pending_review';
  const status = statusParam as 'pending_review' | 'approved' | 'rejected' | 'merged';
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    const matches = await getDeduplicationMatches(entityType, status, limit);

    return NextResponse.json({
      success: true,
      entity_type: entityType || 'all',
      status,
      count: matches.length,
      duplicates: matches,
    });
  } catch (error) {
    console.error('[API] Failed to fetch deduplication matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deduplication matches' },
      { status: 500 }
    );
  }
}
