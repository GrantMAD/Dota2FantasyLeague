/**
 * GET /api/admin/data/version-history
 * 
 * Get version history for an entity
 * Query params:
 *   - entity_type: player|team|tournament|match|player_stats (required)
 *   - entity_id: string (required)
 *   - limit: number (default: 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVersionHistory, verifyAdminAuth } from '@/lib/data-reconciliation/admin-utils';

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
  const entityType: 'player' | 'team' | 'tournament' | 'match' | 'player_stats' | null = entityTypeParam 
    ? (entityTypeParam as 'player' | 'team' | 'tournament' | 'match' | 'player_stats') 
    : null;
  const entityId = searchParams.get('entity_id') as string;
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: 'Missing required query params: entity_type, entity_id' },
      { status: 400 }
    );
  }

  try {
    const history = await getVersionHistory(
      entityType as 'player' | 'team' | 'tournament' | 'match' | 'player_stats',
      entityId,
      limit
    );

    return NextResponse.json({
      success: true,
      entity_type: entityType,
      entity_id: entityId,
      version_count: history.length,
      versions: history,
    });
  } catch (error) {
    console.error('[API] Failed to fetch version history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch version history' },
      { status: 500 }
    );
  }
}
