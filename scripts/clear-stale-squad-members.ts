import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv(file: string) {
  const fullPath = resolve(process.cwd(), file);
  if (!existsSync(fullPath)) return;
  const content = readFileSync(fullPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv('.env.local');
loadEnv('.env');

const stalePlayerIds = new Set([11, 9, 6, 7, 13, 12, 14, 2257]);

async function main() {
  const { getSupabaseServerClient } = await import('../src/lib/db/supabase-server');
  const supabase = getSupabaseServerClient();

  // Step 1: Null out stale player references in fantasy_lineups
  console.log('Step 1: Patching fantasy_lineups to remove stale player slots...');
  const { data: lineups } = await (supabase
    .from('fantasy_lineups') as any)
    .select('id, carry_id, mid_id, offlane_id, support_id, hard_support_id, bench_1_id, bench_2_id, bench_3_id, captain_player_id, vice_captain_player_id');

  for (const lineup of lineups || []) {
    const patch: Record<string, null> = {};
    const slots: [string, number | null][] = [
      ['carry_id', lineup.carry_id],
      ['mid_id', lineup.mid_id],
      ['offlane_id', lineup.offlane_id],
      ['support_id', lineup.support_id],
      ['hard_support_id', lineup.hard_support_id],
      ['bench_1_id', lineup.bench_1_id],
      ['bench_2_id', lineup.bench_2_id],
      ['bench_3_id', lineup.bench_3_id],
      ['captain_player_id', lineup.captain_player_id],
      ['vice_captain_player_id', lineup.vice_captain_player_id],
    ];
    for (const [col, val] of slots) {
      if (val && stalePlayerIds.has(val)) patch[col] = null;
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await (supabase.from('fantasy_lineups') as any)
        .update(patch).eq('id', lineup.id);
      if (error) {
        console.warn('  Could not patch lineup ' + lineup.id + ':', error.message);
      } else {
        console.log('  Patched lineup_id=' + lineup.id + ' — nulled slots: ' + Object.keys(patch).join(', '));
      }
    }
  }

  // Step 2: Delete fantasy_squad_members rows for stale players
  console.log('Step 2: Removing stale players from fantasy_squad_members...');
  const { data: removed, error: squadError } = await (supabase
    .from('fantasy_squad_members') as any)
    .delete()
    .in('player_id', [...stalePlayerIds])
    .select('id, squad_id, player_id');

  if (squadError) {
    console.error('  Failed:', squadError.message);
  } else {
    console.log('  Removed ' + (removed?.length ?? 0) + ' rows from fantasy_squad_members');
    for (const r of removed || []) {
      console.log('    member_id=' + r.id + ' | squad_id=' + r.squad_id + ' | player_id=' + r.player_id);
    }
  }

  console.log('');
  console.log('Done. You can now run the purge:');
  console.log('  npx tsx scripts/purge-stale-players.ts --delete');
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
