import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/auth-utils';
import { logAuditAction } from '@/lib/audit-logger';

export async function POST(request: NextRequest) {
  try {
    const adminId = await verifyAdminAuth(request);

    const body = await request.json();
    const { version, seasonId = 1, gameweekId } = body;

    if (!version || !gameweekId) {
      return NextResponse.json({ error: 'Missing version or effective gameweek ID' }, { status: 400 });
    }

    const supabase = supabaseServer();

    const parsedSeasonId = parseInt(seasonId, 10);
    const parsedVersion = parseInt(version, 10);
    const parsedGameweekId = parseInt(gameweekId, 10);
    const publishedAt = new Date().toISOString();
    const { data: draftRules, error: fetchError } = await supabase
      .from('scoring_rules')
      .select('id, rule_key, value, is_enabled')
      .eq('season_id', parsedSeasonId)
      .eq('version', parsedVersion)
      .eq('is_published', false);
    if (fetchError) throw fetchError;

    // Publish all rules for this version
    const { data: publishedRules, error: updateError } = await supabase
      .from('scoring_rules')
      .update({
        is_published: true,
        published_at: publishedAt,
        effective_from_gameweek_id: parsedGameweekId
      })
      .eq('season_id', parsedSeasonId)
      .eq('version', parsedVersion)
      .eq('is_published', false)
      .select('id');

    if (updateError) throw updateError;

    const draftsById = new Map((draftRules ?? []).map((rule) => [rule.id, rule]));
    await Promise.all((publishedRules ?? []).map((rule) => {
      const oldRule = draftsById.get(rule.id);
      return logAuditAction({
        tableName: 'scoring_rules',
        recordId: rule.id,
        action: 'UPDATE',
        changedBy: adminId,
        oldValues: {
          ...(oldRule ? { rule_key: oldRule.rule_key, value: oldRule.value, is_enabled: oldRule.is_enabled } : {}),
          is_published: false,
          effective_from_gameweek_id: null,
        },
        newValues: {
          ...(oldRule ? { rule_key: oldRule.rule_key, value: oldRule.value, is_enabled: oldRule.is_enabled } : {}),
          is_published: true,
          published_at: publishedAt,
          effective_from_gameweek_id: parsedGameweekId,
          version: parsedVersion,
          season_id: parsedSeasonId,
        },
        reason: 'Admin published a scoring rules version',
      });
    }));

    return NextResponse.json({ message: 'Scoring rules version published successfully' });
  } catch (error: unknown) {
    console.error('Error publishing scoring rules:', error);
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number(error.status)
      : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to publish scoring rules.' },
      { status }
    );
  }
}
