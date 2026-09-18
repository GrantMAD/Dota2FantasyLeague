import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const roleMap = { 1: 'Carry', 2: 'Support', 3: 'Offlane', 4: 'Mid', 5: 'Hard Support' };

async function main() {
  // 1. Get all players with null primary_role
  const { data: nullPlayers, error } = await supabase
    .from('professional_players')
    .select('id, name, data_provider_id, primary_role')
    .is('primary_role', null);

  if (error) { console.error('DB error:', error.message); return; }
  console.log('Players with null role:', nullPlayers.length);

  // 2. Fetch OpenDota proPlayers
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 12000);
  const res = await fetch('https://api.opendota.com/api/proPlayers', {
    headers: { 'User-Agent': 'FantasyDota/1.0' },
    signal: controller.signal,
  });
  const data = await res.json();
  console.log('OpenDota returned', data.length, 'players');

  // Build lookup by steamid and account_id
  const lookup = new Map();
  for (const p of data) {
    if (p.fantasy_role) {
      const role = roleMap[p.fantasy_role];
      if (role) {
        if (p.steamid) lookup.set(String(p.steamid), role);
        if (p.account_id) lookup.set(String(p.account_id), role);
        if (p.name) lookup.set(p.name.toLowerCase().trim(), role);
      }
    }
  }
  console.log('Role lookup size:', lookup.size);

  // 3. Update each null-role player
  let updated = 0;
  let notFound = [];
  for (const player of nullPlayers) {
    const role = lookup.get(player.data_provider_id) || lookup.get(player.name?.toLowerCase()?.trim());
    if (role) {
      const { error: updateError } = await supabase
        .from('professional_players')
        .update({ primary_role: role })
        .eq('id', player.id);
      if (updateError) console.error('Update error for', player.name, ':', updateError.message);
      else { console.log('Updated', player.name, '->', role); updated++; }
    } else {
      notFound.push(player.name);
    }
  }
  console.log('\nSummary: updated', updated, 'players');
  if (notFound.length) console.log('No OpenDota role found for:', notFound.join(', '));
}

main().catch(console.error).finally(() => process.exit(0));
