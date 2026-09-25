/**
 * POST /api/admin/data/ignore-all-conflicts
 * 
 * Bulk marks all unresolved conflicts as ignored (no action taken on entities)
 * 
 * Body:
 *   - entity_type?: 'player' | 'team' | 'tournament' | 'match'
 *   - notes?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { ignoreAllConflicts, verifyAdminAuth } from '@/lib/data-reconciliation/admin-utils';

export async function POST(request: NextRequest) {
  const adminId = await verifyAdminAuth(request);
  if (!adminId) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin access required' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { entity_type, notes = 'Bulk ignored by admin' } = body;

    const result = await ignoreAllConflicts(adminId, entity_type, notes);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to ignore conflicts' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      count: result.count ?? 0,
      message: `Successfully marked ${result.count ?? 0} conflicts as ignored. No data was modified.`,
    });
  } catch (error) {
    console.error('[API] Failed to ignore all conflicts:', error);
    return NextResponse.json(
      { error: 'Failed to ignore all conflicts' },
      { status: 500 }
    );
  }
}
