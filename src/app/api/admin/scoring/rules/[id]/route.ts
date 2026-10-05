import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/auth-utils';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAdminAuth(request);

    const { id } = await params;
    const ruleId = parseInt(id, 10);
    const body = await request.json();
    const { value, is_enabled } = body;

    if (value !== undefined && typeof value !== 'number') {
      return NextResponse.json({ error: 'Rule value must be a number.' }, { status: 400 });
    }
    if (is_enabled !== undefined && typeof is_enabled !== 'boolean') {
      return NextResponse.json({ error: 'Rule enabled state must be a boolean.' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // 1. Verify the rule is not published yet
    const { data: rule, error: fetchError } = await supabase
      .from('scoring_rules')
      .select('is_published')
      .eq('id', ruleId)
      .single();

    if (fetchError || !rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    if (rule.is_published) {
      return NextResponse.json({ error: 'Cannot modify a published rule version' }, { status: 400 });
    }

    // 2. Update the rule
    const updates: { value?: number; is_enabled?: boolean; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (value !== undefined) updates.value = value;
    if (is_enabled !== undefined) updates.is_enabled = is_enabled;

    const { error: updateError } = await supabase
      .from('scoring_rules')
      .update(updates)
      .eq('id', ruleId);

    if (updateError) throw updateError;

    return NextResponse.json({ message: 'Rule updated successfully' });
  } catch (error: unknown) {
    console.error('Error updating rule:', error);
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number(error.status)
      : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update scoring rule.' },
      { status }
    );
  }
}
