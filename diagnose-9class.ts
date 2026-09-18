import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: player } = await supabase
    .from('professional_players')
    .select('id, name, primary_role, data_provider_id')
    .ilike('name', '%9class%')
    .maybeSingle();
  
  console.log('DB 9Class:', JSON.stringify(player));

  console.log('Fetching from OpenDota...');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const res = await fetch('https://api.opendota.com/api/proPlayers', {
    headers: { 'User-Agent': 'FantasyDota/1.0' },
    signal: controller.signal,
  });
  clearTimeout(timeout);
  const data = await res.json();
  const match = data.find((p: any) =>
    (p.name && p.name.toLowerCase().includes('9class')) ||
    (p.personaname && p.personaname.toLowerCase().includes('9class'))
  );
  console.log('OpenDota 9Class:', JSON.stringify(match));
  if (player && match) {
    console.log('DB data_provider_id:', player.data_provider_id);
    console.log('OpenDota steamid:', match.steamid);
    console.log('OpenDota account_id:', match.account_id);
    console.log('fantasy_role:', match.fantasy_role);
    console.log('Matches by steamid?', player.data_provider_id === String(match.steamid));
    console.log('Matches by account_id?', player.data_provider_id === String(match.account_id));
  }
}

main().catch(console.error).finally(() => process.exit(0));
