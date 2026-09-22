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

const newFilter = (p: any): boolean =>
  Boolean(p.name && p.is_pro && p.team_id && p.team_id !== 0);

async function main() {
  const { getSupabaseServerClient } = await import('../src/lib/db/supabase-server');
  const supabase = getSupabaseServerClient();

  // The 8 stale players currently in fantasy squads (from dry-run output)
  const staleSquadPlayerIds = [11, 9, 6, 7, 13, 12, 14, 2257];

  const { data: stalePlayers } = await (supabase
    .from('professional_players') as any)
    .select('id, name, primary_role, data_provider_id')
    .in('id', staleSquadPlayerIds);

  console.log('Stale players currently in fantasy squads:');
  for (const p of stalePlayers || []) {
    console.log('  [id=' + p.id + '] ' + p.name + ' | role=' + p.primary_role + ' | provider_id=' + p.data_provider_id);
  }

  const { data: squadRows } = await (supabase
    .from('fantasy_squad_members') as any)
    .select('id, squad_id, player_id')
    .in('player_id', staleSquadPlayerIds);

  console.log('');
  console.log('fantasy_squad_members rows referencing these players:');
  for (const r of squadRows || []) {
    console.log('  member_id=' + r.id + ' | squad_id=' + r.squad_id + ' | player_id=' + r.player_id);
  }

  // Fetch active OpenDota IDs under new filter
  console.log('');
  console.log('Fetching OpenDota proPlayers to find active replacements...');
  const res = await fetch('https://api.opendota.com/api/proPlayers', {
    headers: { 'User-Agent': 'FantasyDota/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  const raw = await res.json();
  const activeOpenDotaIds = new Set<string>(
    (Array.isArray(raw) ? raw : []).filter(newFilter).map((p: any) => String(p.account_id))
  );

  // Get all DB players and find those that will survive the purge
  const { data: allDbPlayers } = await (supabase
    .from('professional_players') as any)
    .select('id, name, primary_role, data_provider_id, team_id');

  const activeDbPlayers = (allDbPlayers || []).filter(
    (p: any) => p.data_provider_id && activeOpenDotaIds.has(p.data_provider_id)
  );

  console.log('');
  console.log('Active players that will remain in DB after purge: ' + activeDbPlayers.length);
  console.log('Breakdown by role:');
  const byRole: Record<string, number> = {};
  for (const p of activeDbPlayers) {
    byRole[p.primary_role] = (byRole[p.primary_role] || 0) + 1;
  }
  for (const [role, count] of Object.entries(byRole)) {
    console.log('  ' + role + ': ' + count);
  }

  // Show one example replacement per role needed
  console.log('');
  console.log('Example replacements by role:');
  const neededRoles = [...new Set((stalePlayers || []).map((p: any) => p.primary_role))];
  for (const role of neededRoles) {
    const candidates = activeDbPlayers.filter((p: any) => p.primary_role === role).slice(0, 3);
    console.log('  ' + role + ':');
    for (const c of candidates) {
      console.log('    -> [id=' + c.id + '] ' + c.name);
    }
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
