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

const oldFilter = (p: any): boolean => Boolean(p.name && (p.is_pro || p.team_name));
const newFilter = (p: any): boolean => Boolean(p.name && p.is_pro && p.team_id && p.team_id !== 0);

// Build a set of all IDs (both steamid AND account_id) for active players under a given filter.
// The DB stores data_provider_id = steamid (e.g. '76561198...'), but OpenDota also exposes
// account_id (the 32-bit version). We index both so we match regardless of which was stored.
function buildIdSet(players: any[], filter: (p: any) => boolean): Set<string> {
  const ids = new Set<string>();
  for (const p of players.filter(filter)) {
    if (p.steamid) ids.add(String(p.steamid));
    if (p.account_id) ids.add(String(p.account_id));
  }
  return ids;
}

async function main() {
  const isDryRun = !process.argv.includes('--delete');

  console.log('');
  console.log('=============================================================');
  console.log('  Stale OpenDota Player Purge Script');
  console.log('  Mode: ' + (isDryRun ? 'DRY-RUN (pass --delete to commit)' : '*** LIVE DELETE ***'));
  console.log('=============================================================');
  console.log('');

  // Step 1: Fetch live OpenDota data
  console.log('Fetching https://api.opendota.com/api/proPlayers ...');
  let rawPlayers: any[] = [];
  try {
    const res = await fetch('https://api.opendota.com/api/proPlayers', {
      headers: { 'User-Agent': 'FantasyDota/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    rawPlayers = Array.isArray(json) ? json : [];
  } catch (err) {
    console.error('Failed to fetch OpenDota proPlayers:', (err as Error).message);
    process.exit(1);
  }
  console.log('  Received ' + rawPlayers.length + ' total entries from OpenDota');

  // Build lookup maps
  // Use both steamid+account_id for matching — DB stores steamid as data_provider_id
  const newValidIds = buildIdSet(rawPlayers, newFilter);
  const oldValidIds = buildIdSet(rawPlayers, oldFilter);
  const oldOnlyCount = rawPlayers.filter(oldFilter).length;
  const newOnlyCount = rawPlayers.filter(newFilter).length;
  const rawByAccountId = new Map<string, any>(rawPlayers.map((p) => [String(p.account_id), p]));

  console.log('  Old filter (is_pro OR team_name)   -> ' + oldOnlyCount + ' players');
  console.log('  New filter (is_pro AND team_id!=0) -> ' + newOnlyCount + ' players');
  console.log('  Active IDs indexed (steamid+acct)  -> ' + newValidIds.size + ' unique IDs');
  console.log('');

  const { getSupabaseServerClient } = await import('../src/lib/db/supabase-server');
  const supabase = getSupabaseServerClient();

  // Step 2: Fetch ALL players from DB (much simpler than a giant .in() query)
  console.log('Fetching all professional_players from DB...');
  const { data: allDbPlayers, error: fetchError } = await (supabase
    .from('professional_players') as any)
    .select('id, name, data_provider_id, team_id, primary_role, last_synced_at');

  if (fetchError) {
    console.error('Failed to query professional_players:', fetchError.message);
    process.exit(1);
  }
  console.log('  Found ' + (allDbPlayers?.length ?? 0) + ' total players in DB');

  // Step 3: Identify stale candidates — players in DB whose data_provider_id
  //         does NOT appear in the new valid OpenDota set (checked against both steamid+account_id).
  //         Players with no data_provider_id are manually added — never touch those.
  const staleCandidates = (allDbPlayers || []).filter((p: any) => {
    if (!p.data_provider_id) return false;
    return !newValidIds.has(String(p.data_provider_id));
  });
  console.log('  Stale candidates in DB:  ' + staleCandidates.length);
  console.log('');

  if (staleCandidates.length === 0) {
    console.log('No stale players found in DB. Nothing to delete.');
    return;
  }

  // Step 4: Safety checks — only check candidates
  const candidateDbIds = staleCandidates.map((p: any) => p.id);
  console.log('Running safety checks...');

  // Chunk the safety check .in() calls (candidates could still be large)
  async function getProtectedIds(table: string, column: string, ids: number[]): Promise<Set<number>> {
    const chunkSize = 500;
    const protected_ = new Set<number>();
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data } = await (supabase.from(table) as any).select(column).in(column, chunk);
      for (const row of data || []) protected_.add(row[column]);
    }
    return protected_;
  }

  const [protectedByPerf, protectedByStats, protectedBySquad] = await Promise.all([
    getProtectedIds('player_performances', 'player_id', candidateDbIds),
    getProtectedIds('match_player_stats', 'player_id', candidateDbIds),
    getProtectedIds('fantasy_squad_members', 'player_id', candidateDbIds),
  ]);

  console.log('  Players with player_performances: ' + protectedByPerf.size);
  console.log('  Players with match_player_stats:  ' + protectedByStats.size);
  console.log('  Players in fantasy_squad_members: ' + protectedBySquad.size);

  const toDelete: any[] = [];
  const protectedPlayers: any[] = [];

  for (const player of staleCandidates) {
    const reasons: string[] = [];
    if (protectedByPerf.has(player.id)) reasons.push('has player_performances');
    if (protectedByStats.has(player.id)) reasons.push('has match_player_stats');
    if (protectedBySquad.has(player.id)) reasons.push('in fantasy_squad_members');
    if (reasons.length > 0) {
      protectedPlayers.push({ ...player, reasons });
    } else {
      toDelete.push(player);
    }
  }

  console.log('');
  console.log('-----------------------------------------------------------');
  console.log('  REPORT: ' + toDelete.length + ' to delete | ' + protectedPlayers.length + ' protected');
  console.log('-----------------------------------------------------------');

  if (protectedPlayers.length > 0) {
    console.log('');
    console.log('PROTECTED (' + protectedPlayers.length + ' players - skipped, they have real data):');
    for (const p of protectedPlayers) {
      console.log('  [id=' + p.id + '] "' + p.name + '" (provider_id=' + p.data_provider_id + ') -- ' + p.reasons.join(', '));
    }
  }

  if (toDelete.length === 0) {
    console.log('');
    console.log('All stale candidates are protected. Nothing safe to delete.');
    return;
  }

  console.log('');
  console.log('TO DELETE (' + toDelete.length + ' players):');
  // Show first 20 to avoid overwhelming output
  const preview = toDelete.slice(0, 20);
  for (const p of preview) {
    const rawEntry = rawByAccountId.get(p.data_provider_id);
    const reason = rawEntry
      ? 'is_pro=' + rawEntry.is_pro + ', team_id=' + (rawEntry.team_id ?? 'null') + ', team_name="' + (rawEntry.team_name ?? '') + '"'
      : 'not present in current OpenDota response at all';
    console.log('  [id=' + p.id + '] "' + p.name + '" (provider_id=' + p.data_provider_id + ')');
    console.log('         OpenDota: ' + reason);
  }
  if (toDelete.length > 20) {
    console.log('  ... and ' + (toDelete.length - 20) + ' more (run with --delete to see full list in deletion output)');
  }

  console.log('');
  console.log('Summary:');
  console.log('  Total players in DB:       ' + (allDbPlayers?.length ?? 0));
  console.log('  Stale candidates:          ' + staleCandidates.length);
  console.log('  Protected (has data):      ' + protectedPlayers.length);
  console.log('  Safe to delete:            ' + toDelete.length);

  if (isDryRun) {
    console.log('');
    console.log('DRY-RUN complete - no changes made.');
    console.log('Re-run with --delete to execute:');
    console.log('  npx tsx scripts/purge-stale-players.ts --delete');
    return;
  }

  // Live delete
  console.log('');
  console.log('Executing deletions in chunks...');
  const idsToDelete = toDelete.map((p: any) => p.id);
  const chunkSize = 200;

  async function deleteInChunks(table: string, column: string, ids: (number | string)[], label: string) {
    let deleted = 0;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { error } = await (supabase.from(table) as any).delete().in(column, chunk);
      if (error) { console.warn('  Warning deleting from ' + table + ':', error.message); }
      else deleted += chunk.length;
    }
    console.log('  Deleted ' + deleted + ' rows from ' + label);
  }

  await deleteInChunks('data_quality_scores', 'entity_id', idsToDelete.map(String), 'data_quality_scores (player)');
  await deleteInChunks('data_version_history', 'entity_id', idsToDelete.map(String), 'data_version_history (player)');
  await deleteInChunks('player_prices', 'player_id', idsToDelete, 'player_prices');
  await deleteInChunks('professional_players', 'id', idsToDelete, 'professional_players');

  console.log('');
  console.log('Purge complete. ' + idsToDelete.length + ' stale players removed.');
  console.log(protectedPlayers.length + ' players were protected (they have match/fantasy data).');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
