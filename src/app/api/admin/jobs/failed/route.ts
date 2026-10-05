import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createErrorResponse, verifyAdminAuth } from '@/lib/auth-utils';

interface FailedJobRecord {
  id: number;
  job_name: string;
  error_message: string | null;
  retry_count: number;
  next_retry_at: string | null;
  is_dead_letter: boolean;
  started_at: string;
}

/**
 * GET /api/admin/jobs/failed
 * Returns failed and dead-letter job entries from job_execution_log.
 */
export async function GET(request: Request) {
  try {
    await verifyAdminAuth(request);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { data, error } = await supabase
      .from('job_execution_log')
      .select('id, job_name, error_message, retry_count, next_retry_at, is_dead_letter, started_at')
      .eq('status', 'failed')
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching failed jobs:', error);
      return NextResponse.json({ error: 'Failed to fetch failed jobs.' }, { status: 500 });
    }

    return NextResponse.json({ failedJobs: (data || []) as FailedJobRecord[] });
  } catch (error: unknown) {
    return createErrorResponse(error as Error);
  }
}
