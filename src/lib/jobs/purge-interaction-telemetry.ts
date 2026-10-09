import { getSupabaseServerClient } from '@/lib/db/supabase-server';

export async function purgeInteractionTelemetry() {
  const startedAt = Date.now();
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc('purge_interaction_telemetry', {
    detail_retention_days: 7,
    summary_retention_days: 180,
  });

  if (error) {
    throw new Error(`Failed to purge expired telemetry: ${error.message}`);
  }

  return {
    success: true,
    deletedRows: Number(data ?? 0),
    duration: Date.now() - startedAt,
    errors: [],
  };
}
