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

interface FantasySeasonRow {
  id: number;
  user_id: string;
  total_points: number;
  global_rank: number | null;
  budget: number;
}

async function main() {
  const { getSupabaseServerClient } = await import('../src/lib/db/supabase-server');
  const supabase = getSupabaseServerClient();

  // Show current state
  const { data: seasonData } = await supabase
    .from('fantasy_seasons')
    .select('id, user_id, total_points, global_rank, budget');
  const seasons = (seasonData ?? []) as FantasySeasonRow[];

  console.log('Current fantasy_seasons:');
  for (const season of seasons) {
    console.log(`  id=${season.id} | user_id=${season.user_id} | total_points=${season.total_points} | budget=${season.budget}`);
  }

  if (seasons.length === 0) {
    console.log('No fantasy_seasons found.');
    return;
  }

  // Reset total_points and global_rank to 0/null for all test seasons
  const seasonIds = seasons.map((season) => season.id);
  const { error } = await supabase
    .from('fantasy_seasons')
    .update({ total_points: 0, global_rank: null })
    .in('id', seasonIds);

  if (error) {
    console.error('Failed to reset:', error.message);
  } else {
    console.log(`\nReset total_points=0 and global_rank=null on ${seasons.length} fantasy_season(s).`);
  }
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
