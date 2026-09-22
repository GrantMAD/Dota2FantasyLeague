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

const stalePlayerIds = [11, 9, 6, 7, 13, 12, 14, 2257];

async function main() {
  const { getSupabaseServerClient } = await import('../src/lib/db/supabase-server');
  const supabase = getSupabaseServerClient();

  const { data: lineups } = await (supabase
    .from('fantasy_lineups') as any)
    .select('id, carry_id, mid_id, offlane_id, support_id, hard_support_id, bench_1_id, bench_2_id, bench_3_id, captain_player_id, vice_captain_player_id');

  const toDelete = (lineups || [])
    .filter((l: any) => {
      const slots = [l.carry_id, l.mid_id, l.offlane_id, l.support_id, l.hard_support_id, l.bench_1_id, l.bench_2_id, l.bench_3_id, l.captain_player_id, l.vice_captain_player_id];
      return slots.some((id: any) => stalePlayerIds.includes(id));
    })
    .map((l: any) => l.id);

  console.log('Lineups with stale player references:', toDelete);

  if (toDelete.length === 0) {
    console.log('No lineups to delete.');
    return;
  }

  const { error } = await (supabase
    .from('fantasy_lineups') as any)
    .delete()
    .in('id', toDelete);

  if (error) {
    console.error('Error deleting lineups:', error.message);
  } else {
    console.log('Deleted ' + toDelete.length + ' invalid test lineup(s). All clear for purge.');
  }
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
