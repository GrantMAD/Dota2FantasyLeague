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
  const { DOTA2_HEROES } = await import('../src/lib/constants/dota-heroes');
  const supabase = getSupabaseServerClient();

  console.log('🔍 Finding match_player_stats with hero_name == "Unknown"...');
  const { data: rows, error } = await (supabase.from('match_player_stats') as any)
    .select('id, hero_id, hero_name')
    .eq('hero_name', 'Unknown');

  if (error) {
    console.error('Error querying:', error);
    process.exit(1);
  }

  console.log(`Found ${rows?.length || 0} rows needing hero_name fix.`);

  let updated = 0;
  for (const row of rows || []) {
    const heroName = DOTA2_HEROES[row.hero_id] || (row.hero_id ? `Hero ${row.hero_id}` : 'Unknown');
    if (heroName !== 'Unknown') {
      const { error: updErr } = await (supabase.from('match_player_stats') as any)
        .update({ hero_name: heroName })
        .eq('id', row.id);
      if (!updErr) updated++;
    }
  }

  console.log(`✅ Directly updated ${updated} match_player_stats rows with genuine hero names!`);

  // Also update auto-registered players who have "Player (Unknown)" or "Unknown" as names
  console.log('🔍 Checking professional_players for "Player (Unknown)" names...');
  const { data: unknownPlayers } = await (supabase.from('professional_players') as any)
    .select('id, name, in_game_name');

  let fixedPlayers = 0;
  for (const player of unknownPlayers || []) {
    if (
      player.name === 'Player (Unknown)' ||
      player.name === 'Unknown' ||
      player.in_game_name === 'Player (Unknown)' ||
      player.in_game_name === 'Unknown'
    ) {
      // Look up a hero name they played in match_player_stats
      const { data: stat } = await (supabase.from('match_player_stats') as any)
        .select('hero_name')
        .eq('player_id', player.id)
        .neq('hero_name', 'Unknown')
        .limit(1)
        .maybeSingle();

      const newName = stat?.hero_name ? `Player (${stat.hero_name})` : `Player #${player.id}`;
      await (supabase.from('professional_players') as any)
        .update({
          name: newName,
          in_game_name: newName,
        })
        .eq('id', player.id);
      fixedPlayers++;
    }
  }
  console.log(`✅ Fixed ${fixedPlayers} auto-registered player records.`);
}

main().catch(console.error);
