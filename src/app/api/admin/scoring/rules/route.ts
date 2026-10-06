import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/auth-utils';
import { logAuditAction } from '@/lib/audit-logger';

interface ScoringRule {
  id: number;
  season_id: number;
  rule_name: string;
  rule_key: string;
  value: number;
  description: string | null;
  version: number;
  is_enabled: boolean;
  is_published: boolean;
  published_at: string | null;
  effective_from_gameweek_id: number | null;
}

interface ScoringRuleVersion {
  version: number;
  is_published: boolean;
  published_at: string | null;
  effective_from_gameweek_id: number | null;
  rules: ScoringRule[];
}

export async function GET(request: NextRequest) {
  try {
    await verifyAdminAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id') || '1'; // Default to season 1 if not provided

    const supabase = supabaseServer();
    
    // Fetch all rules for this season
    const { data, error } = await supabase
      .from('scoring_rules')
      .select('*')
      .eq('season_id', parseInt(seasonId, 10))
      .order('version', { ascending: false })
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching scoring rules:', error);
      return NextResponse.json({ error: 'Failed to fetch scoring rules' }, { status: 500 });
    }

    // Group by version
    const rules = (data ?? []) as ScoringRule[];
    const grouped = rules.reduce<Record<number, ScoringRuleVersion>>((acc, rule) => {
      const v = rule.version;
      if (!acc[v]) {
        acc[v] = {
          version: v,
          is_published: rule.is_published,
          published_at: rule.published_at,
          effective_from_gameweek_id: rule.effective_from_gameweek_id,
          rules: []
        };
      }
      acc[v].rules.push(rule);
      return acc;
    }, {});

    return NextResponse.json(Object.values(grouped));
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number(error.status)
      : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch scoring rules.' },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminId = await verifyAdminAuth(request);

    const body = await request.json();
    const { seasonId = 1 } = body;

    const supabase = supabaseServer();

    // 1. Get the max version
    const { data: maxVersionData, error: maxVersionError } = await supabase
      .from('scoring_rules')
      .select('version')
      .eq('season_id', seasonId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (maxVersionError && maxVersionError.code !== 'PGRST116') { // PGRST116 is no rows
      throw maxVersionError;
    }

    const currentVersion = maxVersionData?.version || 0;
    const newVersion = currentVersion + 1;

    // 2. Fetch all rules from the current (latest) version to clone
    const { data: currentRules, error: currentRulesError } = await supabase
      .from('scoring_rules')
      .select('*')
      .eq('season_id', seasonId)
      .eq('version', currentVersion);

    if (currentRulesError) throw currentRulesError;

    // 3. Insert them as the new draft version
    if (currentRules && currentRules.length > 0) {
      const newRules = (currentRules as ScoringRule[]).map((r) => ({
        season_id: r.season_id,
        rule_name: r.rule_name,
        rule_key: r.rule_key,
        value: r.value,
        description: r.description,
        version: newVersion,
        is_enabled: r.is_enabled,
        is_published: false,
        published_at: null,
        effective_from_gameweek_id: null
      }));

      const { data: insertedRules, error: insertError } = await supabase
        .from('scoring_rules')
        .insert(newRules)
        .select('id, rule_key, value, is_enabled');

      if (insertError) throw insertError;

      await logAuditAction({
        tableName: 'scoring_rules',
        action: 'INSERT',
        changedBy: adminId,
        oldValues: { season_id: seasonId, previous_version: currentVersion },
        newValues: {
          season_id: seasonId,
          version: newVersion,
          cloned_rule_count: insertedRules?.length ?? 0,
        },
        reason: 'Admin created a scoring rules draft version',
      });
    } else {
      await logAuditAction({
        tableName: 'scoring_rules',
        action: 'INSERT',
        changedBy: adminId,
        oldValues: { season_id: seasonId, previous_version: currentVersion },
        newValues: { season_id: seasonId, version: newVersion, cloned_rule_count: 0 },
        reason: 'Admin created an empty scoring rules draft version',
      });
    }

    return NextResponse.json({ message: 'New version created', version: newVersion });
  } catch (error: unknown) {
    console.error('Error creating new scoring rules version:', error);
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number(error.status)
      : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create scoring rules version.' },
      { status }
    );
  }
}
