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

interface OpenDotaPlayer {
  name?: string | null;
  is_pro?: boolean | null;
  team_id?: number | null;
  account_id?: string | number | null;
}

interface DbPlayer {
  id: number;
  name: string;
  primary_role: string;
  data_provider_id: string | null;
  team_id: number | null;
}

interface SquadMemberRow {
  id: number;
  squad_id: number;
  player_id: number;
}

const newFilter = (player: OpenDotaPlayer): boolean =>
  Boolean(player.name && player.is_pro && player.team_id && player.team_id !== 0);

async function main() {
  const { getSupabaseServerClient } = await import('../src/lib/db/supabase-server');
  const supabase = getSupabaseServerClient();

  // The 8 stale players currently in fantasy squads (from dry-run output)
  const staleSquadPlayerIds = [11, 9, 6, 7, 13, 12, 14, 2257];

  const { data: stalePlayerData } = await supabase
    .from('professional_players')
    .select('id, name, primary_role, data_provider_id')
    .in('id', staleSquadPlayerIds);
  const stalePlayers = (stalePlayerData ?? []) as DbPlayer[];

  console.log('Stale players currently in fantasy squads:');
  for (const p of stalePlayers || []) {
    console.log('  [id=' + p.id + '] ' + p.name + ' | role=' + p.primary_role + ' | provider_id=' + p.data_provider_id);
  }

  const { data: squadMemberData } = await supabase
    .from('fantasy_squad_members')
    .select('id, squad_id, player_id')
    .in('player_id', staleSquadPlayerIds);
  const squadRows = (squadMemberData ?? []) as SquadMemberRow[];

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
  const raw: unknown = await res.json();
  const activeOpenDotaIds = new Set<string>(
    (Array.isArray(raw) ? raw as OpenDotaPlayer[] : []).filter(newFilter).map((player) => String(player.account_id))
  );

  // Get all DB players and find those that will survive the purge
  const { data: allDbPlayerData } = await supabase
    .from('professional_players')
    .select('id, name, primary_role, data_provider_id, team_id');
  const allDbPlayers = (allDbPlayerData ?? []) as DbPlayer[];

  const activeDbPlayers = (allDbPlayers || []).filter(
    (player) => player.data_provider_id && activeOpenDotaIds.has(player.data_provider_id)
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
  const neededRoles = [...new Set(stalePlayers.map((player) => player.primary_role))];
  for (const role of neededRoles) {
    const candidates = activeDbPlayers.filter((player) => player.primary_role === role).slice(0, 3);
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
