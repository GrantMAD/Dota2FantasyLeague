/**
 * POST /api/admin/jobs/run
 * 
 * Manually trigger a background job
 * Requires admin authentication
 * 
 * Headers:
 * {
 *   "Authorization": "Bearer <JWT_TOKEN>"
 * }
 * 
 * Body:
 * {
 *   "jobName": "sync-players" | "sync-teams" | "discover-tournaments" | ...
 *   "sequential": false // optional, run all jobs if no jobName provided
 * }
 */

import { runJob, runAllJobs, runAllJobsSequential } from '@/lib/jobs/scheduler';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';
import { logAuditAction } from '@/lib/audit-logger';

export async function POST(request: Request) {
  try {
    // Check authentication and admin role
    const adminId = await verifyAdminAuth(request);

    const body = await request.json();
    const jobName = body.jobName || body.job_name;
    const { sequential } = body;

    if (!jobName) {
      // Run all jobs
      const results = sequential
        ? await runAllJobsSequential()
        : await runAllJobs();

      const success = results.every((result) => result.status !== 'failed');
      await logAuditAction({
        tableName: 'job_execution_log',
        action: 'INSERT',
        changedBy: adminId,
        oldValues: { manual_triggered: false, scope: 'all' },
        newValues: { manual_triggered: true, scope: 'all', sequential: Boolean(sequential), result_count: results.length, success },
        reason: 'Admin manually triggered all scheduled jobs',
      });
      return Response.json({
        success,
        message: success
          ? `Completed ${results.length} jobs ${sequential ? 'sequentially' : 'in parallel'}`
          : `One or more of ${results.length} jobs failed`,
        results,
      }, { status: success ? 200 : 500 });
    }

    // Run specific job
    const result = await runJob(jobName);

    await logAuditAction({
      tableName: 'job_execution_log',
      action: 'INSERT',
      changedBy: adminId,
      oldValues: { manual_triggered: false, job_name: result.jobName },
      newValues: { manual_triggered: true, job_name: result.jobName, status: result.status },
      reason: 'Admin manually triggered a background job',
    });

    return Response.json({
      success: result.status !== 'failed',
      message: result.status === 'skipped'
        ? `Job ${jobName} skipped because another execution holds its lock`
        : `Job ${jobName} ${result.status}`,
      result,
    }, { status: result.status === 'failed' ? 500 : 200 });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}
