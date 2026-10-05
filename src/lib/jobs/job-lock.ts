import { getSupabaseServerClient } from '@/lib/db/supabase-server';

const JOB_LOCK_LEASE_SECONDS = 2 * 60 * 60;

interface JobLockRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

function getJobLockRpcClient(): JobLockRpcClient {
  return getSupabaseServerClient() as JobLockRpcClient;
}

export async function acquireDistributedJobLock(
  jobName: string,
  executionId: string
): Promise<boolean> {
  const { data, error } = await getJobLockRpcClient().rpc('acquire_job_execution_lock', {
    p_job_name: jobName,
    p_execution_id: executionId,
    p_lease_seconds: JOB_LOCK_LEASE_SECONDS,
  });

  if (error) {
    throw new Error(`Failed to acquire distributed lock for ${jobName}: ${error.message}`);
  }

  return data === true;
}

export async function releaseDistributedJobLock(
  jobName: string,
  executionId: string
): Promise<void> {
  const { data, error } = await getJobLockRpcClient().rpc('release_job_execution_lock', {
    p_job_name: jobName,
    p_execution_id: executionId,
  });

  if (error) {
    throw new Error(`Failed to release distributed lock for ${jobName}: ${error.message}`);
  }

  if (data !== true) {
    throw new Error(`Distributed lock for ${jobName} was not owned by execution ${executionId}`);
  }
}
