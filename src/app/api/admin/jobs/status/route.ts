/**
 * GET /api/admin/jobs/status
 * 
 * Get status of all background jobs
 * Requires admin authentication
 * 
 * Headers:
 * {
 *   "Authorization": "Bearer <JWT_TOKEN>"
 * }
 */

import { getJobs, getAllJobStatuses, healthCheck } from '@/lib/jobs/scheduler';
import { verifyAdminAuth, createErrorResponse } from '@/lib/auth-utils';

export async function GET(request: Request) {
  try {
    // Check authentication and admin role
    await verifyAdminAuth(request);

    const jobs = getJobs();
    const statuses = getAllJobStatuses();
    const health = await healthCheck();

    return Response.json({
      success: true,
      health,
      jobs: jobs.map(j => ({
        name: j.name,
        schedule: j.schedule,
        enabled: j.enabled,
        timeout: j.timeout,
        status: statuses.find(s => s.jobName === j.name),
      })),
      timestamp: new Date(),
    });
  } catch (error) {
    return createErrorResponse(error as Error);
  }
}
