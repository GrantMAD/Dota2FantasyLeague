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

interface LineupRow {
  id: number;
  carry_id: number | null;
  mid_id: number | null;
  offlane_id: number | null;
  support_id: number | null;
  hard_support_id: number | null;
  bench_1_id: number | null;
  bench_2_id: number | null;
  bench_3_id: number | null;
  captain_player_id: number | null;
  vice_captain_player_id: number | null;
}

async function main() {
  const { getSupabaseServerClient } = await import('../src/lib/db/supabase-server');
  const supabase = getSupabaseServerClient();

  const { data: lineupData } = await supabase
    .from('fantasy_lineups')
    .select('id, carry_id, mid_id, offlane_id, support_id, hard_support_id, bench_1_id, bench_2_id, bench_3_id, captain_player_id, vice_captain_player_id');
  const lineups = (lineupData ?? []) as LineupRow[];

  const toDelete = lineups
    .filter((lineup) => {
      const slots = [lineup.carry_id, lineup.mid_id, lineup.offlane_id, lineup.support_id, lineup.hard_support_id, lineup.bench_1_id, lineup.bench_2_id, lineup.bench_3_id, lineup.captain_player_id, lineup.vice_captain_player_id];
      return slots.some((id) => id !== null && stalePlayerIds.includes(id));
    })
    .map((lineup) => lineup.id);

  console.log('Lineups with stale player references:', toDelete);

  if (toDelete.length === 0) {
    console.log('No lineups to delete.');
    return;
  }

  const { error } = await supabase
    .from('fantasy_lineups')
    .delete()
    .in('id', toDelete);

  if (error) {
    console.error('Error deleting lineups:', error.message);
  } else {
    console.log('Deleted ' + toDelete.length + ' invalid test lineup(s). All clear for purge.');
  }
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
