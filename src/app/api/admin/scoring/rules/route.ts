import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAuth } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request); // Assuming admins have valid auth for now; in prod, check role

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
    const grouped = data?.reduce((acc: any, rule: any) => {
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

    return NextResponse.json(Object.values(grouped || {}));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await verifyAuth(request);

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
      const newRules = currentRules.map((r: any) => ({
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

      const { error: insertError } = await supabase
        .from('scoring_rules')
        .insert(newRules);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ message: 'New version created', version: newVersion });
  } catch (error: any) {
    console.error('Error creating new scoring rules version:', error);
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
