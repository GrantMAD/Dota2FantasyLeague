import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get all players still with null role
  const { data: nullPlayers } = await supabase
    .from('professional_players')
    .select('id, name, data_provider_id, primary_role')
    .is('primary_role', null);
  console.log('Still null:', nullPlayers?.length ?? 0);

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 12000);
  const res = await fetch('https://api.opendota.com/api/proPlayers', {
    headers: { 'User-Agent': 'FantasyDota/1.0' },
    signal: controller.signal,
  });
  const data = await res.json() as any[];

  const roleMap: Record<number, string> = { 1: 'Carry', 2: 'Support', 3: 'Offlane', 4: 'Mid', 5: 'Hard Support' };

  // Build lookup ONLY by steamid and account_id (no name - avoids collisions)
  const lookup = new Map<string, string>();
  for (const p of data) {
    if (p.fantasy_role) {
      const role = roleMap[p.fantasy_role];
      if (role) {
        if (p.steamid) lookup.set(String(p.steamid), role);
        if (p.account_id) lookup.set(String(p.account_id), role);
      }
    }
  }
  console.log('ID-only lookup size:', lookup.size);

  let updated = 0;
  const notFound: string[] = [];
  for (const player of nullPlayers ?? []) {
    const role = lookup.get(player.data_provider_id!);
    if (role) {
      const { error } = await supabase
        .from('professional_players')
        .update({ primary_role: role })
        .eq('id', player.id);
      if (error) console.error('Error updating', player.name, ':', error.message);
      else { console.log('Updated', player.name, '->', role); updated++; }
    } else {
      notFound.push(player.name ?? 'unknown');
    }
  }
  console.log('\nUpdated:', updated, '| Still no match:', notFound.length);
  if (notFound.length) console.log('No match:', notFound.join(', '));
}
main().catch(console.error).finally(() => process.exit(0));
