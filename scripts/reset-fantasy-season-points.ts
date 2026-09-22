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

  // Show current state
  const { data: seasons } = await (supabase
    .from('fantasy_seasons') as any)
    .select('id, user_id, total_points, global_rank, budget');

  console.log('Current fantasy_seasons:');
  for (const s of seasons || []) {
    console.log(`  id=${s.id} | user_id=${s.user_id} | total_points=${s.total_points} | budget=${s.budget}`);
  }

  if (!seasons || seasons.length === 0) {
    console.log('No fantasy_seasons found.');
    return;
  }

  // Reset total_points and global_rank to 0/null for all test seasons
  const seasonIds = seasons.map((s: any) => s.id);
  const { error } = await (supabase
    .from('fantasy_seasons') as any)
    .update({ total_points: 0, global_rank: null })
    .in('id', seasonIds);

  if (error) {
    console.error('Failed to reset:', error.message);
  } else {
    console.log(`\nReset total_points=0 and global_rank=null on ${seasons.length} fantasy_season(s).`);
  }
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
