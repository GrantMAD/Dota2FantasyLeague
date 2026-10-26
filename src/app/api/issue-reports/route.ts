import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyRefreshedTokens, verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';

const BUCKET = 'issue-report-screenshots';
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;
const REPORT_LIMIT = 50;
const IMAGE_TYPES = {
  'image/jpeg': { extension: 'jpg', signature: [0xff, 0xd8, 0xff] },
  'image/png': { extension: 'png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'image/webp': { extension: 'webp', signature: null },
} as const;
type ImageMimeType = keyof typeof IMAGE_TYPES;

interface IssueReportRow {
  id: number;
  user_id: string;
  title: string;
  category: string;
  description: string;
  page_url: string | null;
  screenshot_path: string | null;
  status: string;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

function isImageMimeType(value: string): value is ImageMimeType {
  return Object.hasOwn(IMAGE_TYPES, value);
}

function hasValidImageSignature(type: ImageMimeType, bytes: Uint8Array): boolean {
  if (type === 'image/webp') {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }
  return IMAGE_TYPES[type].signature.every((byte, index) => bytes[index] === byte);
}

function normalizePageUrl(value: string): string | null {
  const page = value.trim();
  if (!page) return null;
  if (
    page.length > 500
    || !page.startsWith('/')
    || page.startsWith('//')
    || page.includes('\\')
    || /[\u0000-\u001f]/.test(page)
  ) {
    throw new Error('Page URL must be a relative app path.');
  }
  return page;
}

async function addScreenshotUrl(
  supabase: SupabaseClient,
  report: IssueReportRow,
): Promise<IssueReportRow & { screenshot_url: string | null }> {
  if (!report.screenshot_path) return { ...report, screenshot_url: null };
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(report.screenshot_path, 60 * 60);
  if (error || !data?.signedUrl) {
    throw new Error(`Unable to create a private screenshot link: ${error?.message ?? 'Missing signed URL.'}`);
  }
  return { ...report, screenshot_url: data.signedUrl };
}

async function getHandler(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    auth = await verifyAuth(request);
    const supabase = supabaseServer();
    const reportIdParameter = new URL(request.url).searchParams.get('reportId');
    const reportId = reportIdParameter === null ? null : Number(reportIdParameter);
    if (reportIdParameter !== null && (!Number.isSafeInteger(reportId) || (reportId ?? 0) <= 0)) {
      return NextResponse.json({ error: 'Report ID must be a positive integer.' }, { status: 400 });
    }
    const recentReportsQuery = supabase
      .from('issue_reports')
      .select('id, user_id, title, category, description, page_url, screenshot_path, status, resolution_note, created_at, updated_at, resolved_at')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(REPORT_LIMIT);
    const [recentResult, focusedResult] = await Promise.all([
      recentReportsQuery,
      reportId === null
        ? Promise.resolve({ data: null, error: null })
        : supabase.from('issue_reports')
          .select('id, user_id, title, category, description, page_url, screenshot_path, status, resolution_note, created_at, updated_at, resolved_at')
          .eq('user_id', auth.userId)
          .eq('id', reportId)
          .maybeSingle(),
    ]);
    if (recentResult.error || focusedResult.error) {
      throw new Error(`Unable to load your issue reports: ${recentResult.error?.message ?? focusedResult.error?.message}`);
    }
    const reports = (recentResult.data ?? []) as IssueReportRow[];
    const focusedReport = focusedResult.data as IssueReportRow | null;
    if (focusedReport && !reports.some((report) => report.id === focusedReport.id)) reports.unshift(focusedReport);
    const ids = reports.map((report) => report.id);
    const historyResult = ids.length
      ? await supabase.from('issue_report_status_history')
        .select('id, issue_report_id, old_status, new_status, resolution_note, created_at')
        .in('issue_report_id', ids)
        .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (historyResult.error) throw new Error(`Unable to load report status history: ${historyResult.error.message}`);

    const signedReports = await Promise.all(reports.map((report) => addScreenshotUrl(supabase, report)));
    const response = NextResponse.json({
      reports: signedReports,
      history: historyResult.data ?? [],
    }, { headers: { 'Cache-Control': 'private, no-store' } });
    applyRefreshedTokens(response, auth);
    return response;
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: number }).status)
      : 500;
    const message = error instanceof Error ? error.message : 'Unable to load issue reports.';
    if (status >= 500) console.error('[IssueReports] Failed to load user reports:', error);
    const response = NextResponse.json({ error: message }, { status });
    if (auth) applyRefreshedTokens(response, auth);
    return response;
  }
}

async function postHandler(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  let uploadedPath: string | null = null;
  let reportCreated = false;
  let storageClient: ReturnType<typeof supabaseServer> | undefined;
  try {
    auth = await verifyAuth(request);
    const supabase = supabaseServer();
    storageClient = supabase;
    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_SCREENSHOT_SIZE + 64 * 1024) {
      return NextResponse.json({ error: 'Screenshots must be 5 MB or smaller.' }, { status: 413 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Submit the report using the issue report form.' }, { status: 400 });
    }
    const titleValue = formData.get('title');
    const categoryValue = formData.get('category');
    const descriptionValue = formData.get('description');
    const pageUrlValue = formData.get('page_url');
    if (typeof titleValue !== 'string' || typeof categoryValue !== 'string' || typeof descriptionValue !== 'string') {
      return NextResponse.json({ error: 'Title, category, and description are required.' }, { status: 400 });
    }
    const title = titleValue.trim();
    const description = descriptionValue.trim();
    if (title.length < 5 || title.length > 120) {
      return NextResponse.json({ error: 'Title must be between 5 and 120 characters.' }, { status: 400 });
    }
    if (!['bug', 'error', 'ui'].includes(categoryValue)) {
      return NextResponse.json({ error: 'Choose a valid report category.' }, { status: 400 });
    }
    if (description.length < 10 || description.length > 5000) {
      return NextResponse.json({ error: 'Description must be between 10 and 5,000 characters.' }, { status: 400 });
    }
    if (typeof pageUrlValue !== 'string') {
      return NextResponse.json({ error: 'The page URL is required.' }, { status: 400 });
    }
    let pageUrl: string | null;
    try {
      pageUrl = normalizePageUrl(pageUrlValue);
    } catch (error: unknown) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid page URL.' }, { status: 400 });
    }

    const screenshotValue = formData.get('screenshot');
    if (screenshotValue && typeof screenshotValue !== 'string') {
      const file = screenshotValue;
      if (file.size === 0 || file.size > MAX_SCREENSHOT_SIZE) {
        return NextResponse.json({ error: 'Screenshots must be larger than 0 bytes and no more than 5 MB.' }, { status: 400 });
      }
      if (!isImageMimeType(file.type)) {
        return NextResponse.json({ error: 'Upload a JPEG, PNG, or WebP screenshot.' }, { status: 400 });
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasValidImageSignature(file.type, bytes)) {
        return NextResponse.json({ error: 'The screenshot content does not match its file type.' }, { status: 400 });
      }
      uploadedPath = `${auth.userId}/${randomUUID()}.${IMAGE_TYPES[file.type].extension}`;
      const { error } = await supabase.storage.from(BUCKET).upload(uploadedPath, bytes, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw new Error(`Unable to upload screenshot: ${error.message}`);
    }

    const { data, error } = await supabase.rpc('create_issue_report', {
      p_user_id: auth.userId,
      p_title: title,
      p_category: categoryValue,
      p_description: description,
      p_page_url: pageUrl,
      p_screenshot_path: uploadedPath,
    });
    if (error) {
      if (error.code === 'P0001') {
        if (uploadedPath) {
          const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([uploadedPath]);
          if (cleanupError) console.error('[IssueReports] Failed to remove rate-limited screenshot:', cleanupError);
          uploadedPath = null;
        }
        const response = NextResponse.json({ error: error.message }, { status: 429 });
        applyRefreshedTokens(response, auth);
        return response;
      }
      throw new Error(`Unable to save issue report: ${error.message}`);
    }

    const report = data as IssueReportRow;
    reportCreated = true;
    let reportWithScreenshot: IssueReportRow & { screenshot_url: string | null } = {
      ...report,
      screenshot_url: null,
    };
    if (report.screenshot_path) {
      try {
        reportWithScreenshot = await addScreenshotUrl(supabase, report);
      } catch (error: unknown) {
        console.error('[IssueReports] Report was saved, but its screenshot link could not be created:', error);
      }
    }
    const response = NextResponse.json({
      report: reportWithScreenshot,
      message: 'Your report was submitted.',
    }, { status: 201 });
    applyRefreshedTokens(response, auth);
    return response;
  } catch (error: unknown) {
    if (uploadedPath && !reportCreated && storageClient) {
      const { error: cleanupError } = await storageClient.storage.from(BUCKET).remove([uploadedPath]);
      if (cleanupError) console.error('[IssueReports] Failed to remove orphan screenshot:', cleanupError);
    }
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: number }).status)
      : 500;
    if (status >= 500) console.error('[IssueReports] Failed to submit report:', error);
    const message = error instanceof Error ? error.message : 'Unable to submit issue report.';
    const response = NextResponse.json({ error: message }, { status });
    if (auth) applyRefreshedTokens(response, auth);
    return response;
  }
}

export const GET = withApiTelemetry('GET', '/api/issue-reports', getHandler);
export const POST = withApiTelemetry('POST', '/api/issue-reports', postHandler);
