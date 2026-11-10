import { NextRequest } from 'next/server';
import { GET, POST } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  applyRefreshedTokens: jest.fn(),
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

function makeRequest(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

describe('/api/issue-reports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'user-1', email: 'manager@example.test', role: 'user' });
  });

  it('requires authentication before loading user reports', async () => {
    mockVerifyAuth.mockRejectedValueOnce({ status: 401, message: 'Missing authentication' });

    const response = await GET(makeRequest('/api/issue-reports'));

    expect(response.status).toBe(401);
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });

  it('validates required fields before inserting a report', async () => {
    mockSupabaseServer.mockReturnValue({});
    const formData = new FormData();
    formData.set('title', 'A valid title');
    formData.set('category', 'invalid');
    formData.set('description', 'A sufficiently long description.');
    formData.set('page_url', '/report-issue');

    const response = await POST(makeRequest('/api/issue-reports', { method: 'POST', body: formData }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Choose a valid report category.');
  });

  it('requires a valid reporter-estimated impact level', async () => {
    mockSupabaseServer.mockReturnValue({});
    const formData = new FormData();
    formData.set('title', 'A valid title');
    formData.set('category', 'feature_request');
    formData.set('description', 'A sufficiently long description.');
    formData.set('page_url', '/report-issue');

    const response = await POST(makeRequest('/api/issue-reports', { method: 'POST', body: formData }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Choose a valid impact level.');
  });

  it('submits new categories and impact levels to the database RPC', async () => {
    const report = {
      id: 12,
      user_id: 'user-1',
      title: 'Slow fixture loading',
      category: 'performance',
      severity: 'critical',
      description: 'The fixture page takes a long time to load.',
      page_url: '/fixtures',
      screenshot_path: null,
      status: 'new',
      resolution_note: null,
      created_at: '2026-10-26T10:00:00.000Z',
      updated_at: '2026-10-26T10:00:00.000Z',
      resolved_at: null,
    };
    const rpc = jest.fn().mockResolvedValue({ data: report, error: null });
    mockSupabaseServer.mockReturnValue({ rpc });
    const formData = new FormData();
    formData.set('title', report.title);
    formData.set('category', 'performance');
    formData.set('severity', 'critical');
    formData.set('description', report.description);
    formData.set('page_url', report.page_url);

    const response = await POST(makeRequest('/api/issue-reports', { method: 'POST', body: formData }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.report).toMatchObject({ category: 'performance', severity: 'critical' });
    expect(rpc).toHaveBeenCalledWith('create_issue_report', {
      p_user_id: 'user-1',
      p_title: report.title,
      p_category: 'performance',
      p_severity: 'critical',
      p_description: report.description,
      p_page_url: report.page_url,
      p_screenshot_path: null,
    });
  });

  it('validates report links before querying owned reports', async () => {
    mockSupabaseServer.mockReturnValue({});

    const response = await GET(makeRequest('/api/issue-reports?reportId=invalid'));

    expect(response.status).toBe(400);
  });
});
