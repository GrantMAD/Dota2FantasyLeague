import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth-utils';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAuth(request);

    const { id } = await params;
    const ruleId = parseInt(id, 10);
    const body = await request.json();
    const { value, is_enabled } = body;

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
    const updates: any = {};
    if (value !== undefined) updates.value = value;
    if (is_enabled !== undefined) updates.is_enabled = is_enabled;
    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('scoring_rules')
      .update(updates)
      .eq('id', ruleId);

    if (updateError) throw updateError;

    return NextResponse.json({ message: 'Rule updated successfully' });
  } catch (error: any) {
    console.error('Error updating rule:', error);
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
