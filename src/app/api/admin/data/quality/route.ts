/**
 * GET /api/admin/data/quality
 * 
 * Get data quality metrics and scores
 * Query params:
 *   - entity_type: player|team|tournament|match (optional)
 *   - limit: number (default: 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDataQualityMetrics, verifyAdminAuth } from '@/lib/data-reconciliation/admin-utils';

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
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  try {
    const metrics = await getDataQualityMetrics(entityType, limit);

    return NextResponse.json({
      success: true,
      entity_type: entityType || 'all',
      ...metrics,
    });
  } catch (error) {
    console.error('[API] Failed to fetch quality metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quality metrics' },
      { status: 500 }
    );
  }
}
