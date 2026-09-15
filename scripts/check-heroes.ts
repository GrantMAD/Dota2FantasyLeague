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

async function main() {
  const { getSupabaseServerClient } = await import('../src/lib/db/supabase-server');
  const supabase = getSupabaseServerClient();

  const { data: latest } = await (supabase.from('match_player_stats') as any)
    .select('id, match_id, player_id, hero_id, hero_name, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('--- 10 Most Recently Inserted Match Player Stats ---');
  console.table(latest);

  const { count: unknownCount } = await (supabase.from('match_player_stats') as any)
    .select('id', { count: 'exact', head: true })
    .eq('hero_name', 'Unknown');

  const { count: totalCount } = await (supabase.from('match_player_stats') as any)
    .select('id', { count: 'exact', head: true });

  console.log(`Total stats in DB: ${totalCount}`);
  console.log(`Stats with hero_name == 'Unknown': ${unknownCount}`);
}

main().catch(console.error);
