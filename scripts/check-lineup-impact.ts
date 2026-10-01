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

interface LineupReferenceRow {
  id: number;
  gameweek_id: number;
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
  total_points: number | null;
}

interface GameweekScoreReferenceRow {
  id: number;
  player_id: number;
  gameweek_id: number;
  fantasy_points: number | null;
}

async function main() {
  const { getSupabaseServerClient } = await import('../src/lib/db/supabase-server');
  const supabase = getSupabaseServerClient();

  // Check fantasy_lineups for any references to the stale players
  const { data: lineupData } = await supabase
    .from('fantasy_lineups')
    .select('id, gameweek_id, carry_id, mid_id, offlane_id, support_id, hard_support_id, bench_1_id, bench_2_id, bench_3_id, captain_player_id, vice_captain_player_id, total_points');
  const lineups = (lineupData ?? []) as LineupReferenceRow[];

  const affected = lineups.filter((lineup) => {
    const slots = [lineup.carry_id, lineup.mid_id, lineup.offlane_id, lineup.support_id, lineup.hard_support_id, lineup.bench_1_id, lineup.bench_2_id, lineup.bench_3_id, lineup.captain_player_id, lineup.vice_captain_player_id];
    return slots.some((id) => id !== null && stalePlayerIds.includes(id));
  });

  if (affected.length === 0) {
    console.log('No fantasy_lineups reference the stale players. Safe to remove squad members.');
  } else {
    console.log('fantasy_lineups referencing stale players (' + affected.length + '):');
    for (const l of affected) {
      console.log('  lineup_id=' + l.id + ' | gameweek_id=' + l.gameweek_id + ' | total_points=' + l.total_points);
    }
  }

  // Also check gameweek_scores
  const { data: scoreData } = await supabase
    .from('gameweek_scores')
    .select('id, player_id, gameweek_id, fantasy_points')
    .in('player_id', stalePlayerIds);
  const scores = (scoreData ?? []) as GameweekScoreReferenceRow[];

  if (scores.length === 0) {
    console.log('No gameweek_scores reference the stale players.');
  } else {
    console.log('gameweek_scores referencing stale players (' + scores.length + '):');
    for (const s of scores) {
      console.log('  score_id=' + s.id + ' | player_id=' + s.player_id + ' | gw=' + s.gameweek_id + ' | pts=' + s.fantasy_points);
    }
  }
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
