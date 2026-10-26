import { NextRequest, NextResponse } from 'next/server';
import { applyRefreshedTokens, verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { deliverPushNotifications } from '@/lib/push-notifications';
import { withApiTelemetry } from '@/lib/api-telemetry';

const statuses = ['new', 'under_review', 'in_progress', 'resolved', 'closed'] as const;
type ReportStatus = typeof statuses[number];
const categories = ['bug', 'error', 'ui'] as const;
const PAGE_LIMIT = 50;

interface ReportRow {
  id: number;
  user_id: string;
  title: string;
  category: string;
  description: string;
  page_url: string | null;
  screenshot_path: string | null;
  status: ReportStatus;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  updated_by: string | null;
}

async function getHandler(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    auth = await verifyAuth(request);
    if (auth.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }
    const params = request.nextUrl.searchParams;
    const rawStatus = params.get('status');
    const rawCategory = params.get('category');
    const rawSearch = params.get('search')?.trim() ?? '';
    if (rawStatus && rawStatus !== 'all' && !statuses.includes(rawStatus as ReportStatus)) {
      return NextResponse.json({ error: 'Invalid report status filter.' }, { status: 400 });
    }
    if (rawCategory && rawCategory !== 'all' && !categories.includes(rawCategory as typeof categories[number])) {
      return NextResponse.json({ error: 'Invalid report category filter.' }, { status: 400 });
    }
    const requestedPage = Number(params.get('page') ?? '1');
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
      return NextResponse.json({ error: 'Page must be a positive integer.' }, { status: 400 });
    }
    if (rawSearch.length > 100) {
      return NextResponse.json({ error: 'Search terms must be 100 characters or fewer.' }, { status: 400 });
    }
    const search = rawSearch.replace(/[^\p{L}\p{N}\s-]/gu, '').trim();
    const page = Math.min(requestedPage, 10_000);
    const supabase = supabaseServer();
    let query = supabase.from('issue_reports')
      .select('id, user_id, title, category, description, page_url, screenshot_path, status, resolution_note, created_at, updated_at, resolved_at, updated_by', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT - 1);
    if (rawStatus && rawStatus !== 'all') query = query.eq('status', rawStatus);
    if (rawCategory && rawCategory !== 'all') query = query.eq('category', rawCategory);
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    const { data, count, error } = await query;
    if (error) throw new Error(`Unable to load issue reports: ${error.message}`);

    const reports = (data ?? []) as ReportRow[];
    const reporterIds = [...new Set(reports.map((report) => report.user_id))];
    const reportIds = reports.map((report) => report.id);
    const [usersResult, historyResult] = await Promise.all([
      reporterIds.length
        ? supabase.from('users').select('id, username, display_name').in('id', reporterIds)
        : Promise.resolve({ data: [], error: null }),
      reportIds.length
        ? supabase.from('issue_report_status_history')
          .select('id, issue_report_id, changed_by, old_status, new_status, resolution_note, created_at')
          .in('issue_report_id', reportIds)
          .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (usersResult.error || historyResult.error) {
      throw new Error(`Unable to load report details: ${usersResult.error?.message ?? historyResult.error?.message}`);
    }

    const usersById = new Map((usersResult.data ?? []).map((user) => [user.id, user]));
    const signedReports = await Promise.all(reports.map(async (report) => {
      if (!report.screenshot_path) return { ...report, screenshot_url: null, reporter: usersById.get(report.user_id) ?? null };
      const { data: signed, error: signedError } = await supabase.storage
        .from('issue-report-screenshots')
        .createSignedUrl(report.screenshot_path, 60 * 60);
      if (signedError || !signed?.signedUrl) {
        throw new Error(`Unable to create screenshot link for report ${report.id}: ${signedError?.message ?? 'Missing signed URL.'}`);
      }
      return {
        ...report,
        screenshot_url: signed.signedUrl,
        reporter: usersById.get(report.user_id) ?? null,
      };
    }));

    const response = NextResponse.json({
      reports: signedReports,
      history: historyResult.data ?? [],
      total: count ?? 0,
      page,
      pageSize: PAGE_LIMIT,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
    applyRefreshedTokens(response, auth);
    return response;
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: number }).status)
      : 500;
    if (status >= 500) console.error('[AdminIssueReports] Failed to load reports:', error);
    const response = NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to load issue reports.',
    }, { status });
    if (auth) applyRefreshedTokens(response, auth);
    return response;
  }
}

async function patchHandler(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    auth = await verifyAuth(request);
    if (auth.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be an object.' }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const reportId = Number(payload.report_id);
    if (!Number.isSafeInteger(reportId) || reportId <= 0) {
      return NextResponse.json({ error: 'A valid report ID is required.' }, { status: 400 });
    }
    if (typeof payload.status !== 'string' || !statuses.includes(payload.status as ReportStatus)) {
      return NextResponse.json({ error: 'Choose a valid report status.' }, { status: 400 });
    }
    if (payload.resolution_note !== undefined && payload.resolution_note !== null && typeof payload.resolution_note !== 'string') {
      return NextResponse.json({ error: 'Resolution note must be text.' }, { status: 400 });
    }
    const resolutionNote = typeof payload.resolution_note === 'string' ? payload.resolution_note.trim() : null;
    if (resolutionNote && resolutionNote.length > 2000) {
      return NextResponse.json({ error: 'Resolution notes must be 2,000 characters or fewer.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase.rpc('update_issue_report_status', {
      p_report_id: reportId,
      p_admin_id: auth.userId,
      p_status: payload.status,
      p_resolution_note: resolutionNote,
    });
    if (error) {
      const status = error.code === 'P0002' ? 404 : error.code === '42501' ? 403 : 500;
      if (status === 500) console.error('[AdminIssueReports] Status update failed:', error);
      const response = NextResponse.json({ error: error.message }, { status });
      applyRefreshedTokens(response, auth);
      return response;
    }

    const result = data as { report: ReportRow; status_changed: boolean };
    const push = { accepted: 0, errors: [] as string[] };
    if (result.status_changed) {
      try {
        const label = result.report.status.replaceAll('_', ' ');
        const delivery = await deliverPushNotifications(supabase, [{
          userId: result.report.user_id,
          type: 'issue_report_status',
          title: 'Issue report updated',
          body: `Your report status is now ${label}.`,
          metadata: { issue_report_id: result.report.id },
        }]);
        push.accepted = delivery.accepted;
        push.errors = delivery.errors;
        if (delivery.errors.length) console.warn('[AdminIssueReports] Push notification delivery issues:', delivery.errors);
      } catch (pushError: unknown) {
        const message = pushError instanceof Error ? pushError.message : 'Unknown push notification failure.';
        push.errors.push(message);
        console.error('[AdminIssueReports] Status saved, but push notification failed:', pushError);
      }
    }

    const response = NextResponse.json({
      report: result.report,
      status_changed: result.status_changed,
      push,
    });
    applyRefreshedTokens(response, auth);
    return response;
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: number }).status)
      : 500;
    if (status >= 500) console.error('[AdminIssueReports] Unexpected status update failure:', error);
    const response = NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to update issue report.',
    }, { status });
    if (auth) applyRefreshedTokens(response, auth);
    return response;
  }
}

export const GET = withApiTelemetry('GET', '/api/admin/issue-reports', getHandler);
export const PATCH = withApiTelemetry('PATCH', '/api/admin/issue-reports', patchHandler);
