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

export async function POST(request: Request) {
  try {
    // Check authentication and admin role
    await verifyAdminAuth(request);

    const body = await request.json();
    const { jobName, sequential } = body;

    if (!jobName) {
      // Run all jobs
      const results = sequential
        ? await runAllJobsSequential()
        : await runAllJobs();

      return Response.json({
        success: true,
        message: `Running ${results.length} jobs ${sequential ? 'sequentially' : 'in parallel'}`,
        results,
      });
    }

    // Run specific job
    const result = await runJob(jobName);

    return Response.json({
      success: true,
      message: `Job ${jobName} started`,
      result,
    });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}
