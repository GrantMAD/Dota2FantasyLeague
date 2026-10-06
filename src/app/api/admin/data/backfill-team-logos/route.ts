/**
 * Backfill Team Logos Job
 *
 * Finds all professional_teams rows in the database that have a null logo_url
 * and fetches each team individually from OpenDota (/teams/:id) to retrieve
 * the logo. Teams below OpenDota's top-1000 rating cutoff are excluded from
 * the bulk /teams sync, so they never receive logo updates through the normal
 * sync-teams pipeline.
 *
 * Safe to run repeatedly — only teams that still have null logo_url are touched.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/auth-utils';
import { logAuditAction } from '@/lib/audit-logger';

const OPENDOTA_API = process.env.OPENDOTA_API_URL || 'https://api.opendota.com/api';
// Throttle individual team requests to stay well within OpenDota rate limits
const DELAY_MS = 200;
const BATCH_SIZE = 20;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOpenDotaTeamLogo(teamId: string): Promise<string | null> {
  try {
    const res = await fetch(`${OPENDOTA_API}/teams/${teamId}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.logo_url ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let adminId: string;
  try {
    adminId = await verifyAdminAuth(request);
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number(error.status)
      : 401;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unauthorized' },
      { status }
    );
  }

  const supabase = supabaseServer();

  // Fetch all teams in the DB that have no logo
  const { data: teamData, error: fetchErr } = await supabase.from('professional_teams')
    .select('id, name, data_provider_id')
    .is('logo_url', null)
    .not('data_provider_id', 'is', null);

  if (fetchErr) {
    return NextResponse.json({ error: 'Failed to fetch teams', details: fetchErr.message }, { status: 500 });
  }

  const teams = (teamData ?? []) as { id: number; name: string; data_provider_id: string }[];

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const updatedNames: string[] = [];

  // Process in small batches with throttling
  for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    const batch = teams.slice(i, i + BATCH_SIZE);

    for (const team of batch) {
      await sleep(DELAY_MS);
      const logoUrl = await fetchOpenDotaTeamLogo(team.data_provider_id);

      if (logoUrl) {
        const { error: updateErr } = await supabase
          .from('professional_teams')
          .update({ logo_url: logoUrl, last_synced_at: new Date().toISOString() })
          .eq('id', team.id);

        if (updateErr) {
          console.error(`[backfill-team-logos] Failed to update team ${team.name}:`, updateErr.message);
          errors++;
        } else {
          updated++;
          updatedNames.push(`${team.name} (${logoUrl.slice(0, 60)}...)`);
          console.log(`[backfill-team-logos] ✓ ${team.name} → logo found`);
        }
      } else {
        skipped++;
        console.log(`[backfill-team-logos] — ${team.name} → no logo on OpenDota`);
      }
    }

    if (updated > 0) {
      await logAuditAction({
        tableName: 'professional_teams',
        action: 'CORRECTION',
        changedBy: adminId,
        oldValues: { logo_url: null, candidate_count: teams.length },
        newValues: { updated_count: updated, skipped_count: skipped, error_count: errors, source: 'OpenDota' },
        reason: 'Admin backfilled professional team logos',
      });
    }

    console.log(`[backfill-team-logos] Batch ${Math.floor(i / BATCH_SIZE) + 1} done (${i + batch.length}/${teams.length})`);
  }

  return NextResponse.json({
    success: true,
    total_null_logo_teams: teams.length,
    updated,
    skipped_no_logo_on_opendota: skipped,
    errors,
    updated_teams: updatedNames,
  });
}
