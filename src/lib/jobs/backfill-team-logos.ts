/**
 * Backfill Team Logos Job
 *
 * Finds all professional_teams rows in the database that have a null logo_url
 * and fetches each one individually from OpenDota (/teams/:id).
 *
 * Teams below OpenDota's top-1000 rating cutoff (~1084) are excluded from the
 * bulk /teams response, so they never receive logo_url updates through the
 * normal sync-teams pipeline. This job fills that gap.
 *
 * Safe to run repeatedly — only teams that still have null logo_url are touched.
 * Run schedule: Manual only (maintenance job)
 */

import { getSupabaseServerClient } from '@/lib/db/supabase-server';

const OPENDOTA_API = process.env.OPENDOTA_API_URL || 'https://api.opendota.com/api';
// OpenDota free tier: 60 req/min. 1100ms = ~54 req/min — safely under the limit.
// Previous value (250ms = ~240 req/min) was hitting rate limits, causing silent
// null returns for teams that actually DO have logos.
const DELAY_MS = 1100;
const RETRY_DELAY_MS = 3000; // Extra wait before retrying a null result
const BATCH_LOG_SIZE = 20;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchLogoFromOpenDota(teamId: string): Promise<string | null> {
  const attempt = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${OPENDOTA_API}/teams/${teamId}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data?.logo_url === 'string' && data.logo_url.length > 0
        ? data.logo_url
        : null;
    } catch {
      return null;
    }
  };

  const first = await attempt();
  if (first) return first;

  // Retry once after a longer pause — guards against transient rate-limit null responses
  await sleep(RETRY_DELAY_MS);
  return attempt();
}

export async function backfillTeamLogos(): Promise<{
  success: boolean;
  errors: string[];
  duration: number;
  created: number;
  updated: number;
  skipped: number;
}> {
  const startedAt = Date.now();
  const supabase = getSupabaseServerClient();
  const errors: string[] = [];
  let updated = 0;
  let skipped = 0;

  // Fetch all teams in our DB that still have no logo
  const { data: teams, error: fetchErr } = await supabase
    .from('professional_teams')
    .select('id, name, data_provider_id')
    .is('logo_url', null)
    .not('data_provider_id', 'is', null);

  if (fetchErr) {
    return {
      success: false,
      errors: [`Failed to fetch null-logo teams: ${fetchErr.message}`],
      duration: Date.now() - startedAt,
      created: 0,
      updated: 0,
      skipped: 0,
    };
  }

  const rows: { id: number; name: string; data_provider_id: string }[] = teams ?? [];
  console.log(`[backfillTeamLogos] ${rows.length} teams with null logo_url to check`);

  for (let i = 0; i < rows.length; i++) {
    const team = rows[i];
    await sleep(DELAY_MS);

    const logoUrl = await fetchLogoFromOpenDota(team.data_provider_id);

    if (logoUrl) {
      const { error: updateErr } = await supabase
        .from('professional_teams')
        .update({ logo_url: logoUrl, last_synced_at: new Date().toISOString() })
        .eq('id', team.id);

      if (updateErr) {
        const msg = `Failed to update ${team.name}: ${updateErr.message}`;
        errors.push(msg);
        console.error(`[backfillTeamLogos] ✗ ${msg}`);
      } else {
        updated++;
        console.log(`[backfillTeamLogos] ✓ ${team.name} → logo backfilled`);
      }
    } else {
      skipped++;
    }

    if ((i + 1) % BATCH_LOG_SIZE === 0) {
      console.log(
        `[backfillTeamLogos] Progress: ${i + 1}/${rows.length} — ${updated} updated, ${skipped} no logo on OpenDota`
      );
    }
  }

  const duration = Date.now() - startedAt;
  console.log(
    `[backfillTeamLogos] Done in ${(duration / 1000).toFixed(1)}s — ${updated} logos backfilled, ${skipped} still missing, ${errors.length} errors`
  );

  return {
    success: errors.length === 0,
    errors,
    duration,
    created: 0,
    updated,
    skipped,
  };
}
