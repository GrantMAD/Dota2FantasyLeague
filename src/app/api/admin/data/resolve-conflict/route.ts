/**
 * POST /api/admin/data/resolve-conflict
 * 
 * Resolve a data conflict by choosing a value and provider
 * 
 * Body:
 *   - conflict_id: string
 *   - resolved_value: unknown
 *   - resolved_provider: string
 *   - notes?: string
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveConflict, verifyAdminAuth } from '@/lib/data-reconciliation/admin-utils';

export async function POST(request: NextRequest) {
  const adminId = await verifyAdminAuth(request);
  if (!adminId) {
    return NextResponse.json(
      { error: 'Unauthorized: Admin access required' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { conflict_id, resolved_value, resolved_provider, notes } = body;

    if (!conflict_id || !resolved_value || !resolved_provider) {
      return NextResponse.json(
        { error: 'Missing required fields: conflict_id, resolved_value, resolved_provider' },
        { status: 400 }
      );
    }

    const result = await resolveConflict(
      conflict_id,
      resolved_value,
      resolved_provider,
      adminId,
      notes
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Conflict resolved successfully',
    });
  } catch (error) {
    console.error('[API] Failed to resolve conflict:', error);
    return NextResponse.json(
      { error: 'Failed to resolve conflict' },
      { status: 500 }
    );
  }
}
