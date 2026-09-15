import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Load environment variables without external dotenv package
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
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnv('.env.local');
loadEnv('.env');

async function main() {
  console.log('🔄 Loading Supabase server client and job modules...');
  const { getSupabaseServerClient } = await import('../src/lib/db/supabase-server');
  const { fetchMatchDetails } = await import('../src/lib/jobs/fetch-match-details');

  const supabase = getSupabaseServerClient();

  console.log('🔍 Checking completed matches...');
  const { data: matches, error: fetchErr } = await (supabase.from('matches') as any)
    .select('id, external_match_id, status, detailed_stats_fetched_at')
    .eq('status', 'completed');

  if (fetchErr) {
    console.error('❌ Failed to inspect matches:', fetchErr);
    process.exit(1);
  }

  console.log(`📊 Found ${matches?.length || 0} completed matches in database.`);

  if (!matches || matches.length === 0) {
    console.log('ℹ️ No completed matches found.');
    return;
  }

  console.log('🧹 Resetting detailed_stats_fetched_at flag to NULL so they can be re-fetched...');
  const { error: updateErr } = await (supabase.from('matches') as any)
    .update({ detailed_stats_fetched_at: null })
    .eq('status', 'completed');

  if (updateErr) {
    console.error('❌ Failed to reset matches:', updateErr);
    process.exit(1);
  }

  console.log('✅ Matches reset successfully.');
  console.log('🚀 Executing fetchMatchDetails() with updated STRATZ hero resolution...');

  const result = await fetchMatchDetails();
  console.log('\n🏁 Fetch Completed:');
  console.log(`- Matches Fetched & Processed: ${result.fetched}`);
  console.log(`- Player Stats Scored / Inserted: ${result.scored}`);
  console.log(`- Duration: ${result.duration}ms`);
  if (result.errors.length > 0) {
    console.log(`- Errors encountered (${result.errors.length}):`, result.errors);
  }

  // Inspect sample hero_name values after the run
  console.log('\n🔎 Verifying sample hero names in match_player_stats:');
  const { data: sampleStats } = await (supabase.from('match_player_stats') as any)
    .select('id, match_id, player_id, hero_id, hero_name')
    .order('created_at', { ascending: false })
    .limit(10);

  console.table(sampleStats);
}

main().catch((err) => {
  console.error('Fatal error running script:', err);
  process.exit(1);
});
