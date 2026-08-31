/**
 * GET /api/admin/data/conflicts
 * 
 * List data conflicts from multiple providers
 * Query params:
 *   - entity_type: player|team|tournament|match (optional)
 *   - status: unresolved|resolved|ignored (default: unresolved)
 *   - limit: number (default: 50)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDataConflicts, verifyAdminAuth } from '@/lib/data-reconciliation/admin-utils';

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
  const statusParam = searchParams.get('status') || 'unresolved';
  const status = statusParam as 'unresolved' | 'resolved' | 'ignored';
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    const conflicts = await getDataConflicts(entityType, status, limit);

    return NextResponse.json({
      success: true,
      count: conflicts.length,
      conflicts,
    });
  } catch (error) {
    console.error('[API] Failed to fetch conflicts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conflicts' },
      { status: 500 }
    );
  }
}
