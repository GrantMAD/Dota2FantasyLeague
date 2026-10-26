import { NextRequest } from 'next/server';
import { GET, PATCH } from './route';

const mockVerifyAuth = jest.fn();
const mockSupabaseServer = jest.fn();
const mockDeliverPushNotifications = jest.fn();

jest.mock('@/lib/auth-utils', () => ({
  applyRefreshedTokens: jest.fn(),
  verifyAuth: (...args: unknown[]) => mockVerifyAuth(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/push-notifications', () => ({
  deliverPushNotifications: (...args: unknown[]) => mockDeliverPushNotifications(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

function makeRequest(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

describe('/api/admin/issue-reports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue({ userId: 'admin-1', email: 'admin@example.test', role: 'admin' });
    mockDeliverPushNotifications.mockResolvedValue({ accepted: 1, errors: [] });
  });

  it('denies report access to non-admin users', async () => {
    mockVerifyAuth.mockResolvedValueOnce({ userId: 'user-1', role: 'user' });

    const response = await GET(makeRequest('/api/admin/issue-reports'));

    expect(response.status).toBe(403);
    expect(mockSupabaseServer).not.toHaveBeenCalled();
  });

  it('notifies the reporter after a status change', async () => {
    const report = {
      id: 28,
      user_id: 'reporter-1',
      title: 'Save button is not working',
      status: 'resolved',
      resolution_note: 'Fixed in the latest release.',
    };
    const rpc = jest.fn().mockResolvedValue({ data: { report, status_changed: true }, error: null });
    mockSupabaseServer.mockReturnValue({ rpc });

    const response = await PATCH(makeRequest('/api/admin/issue-reports', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        report_id: 28,
        status: 'resolved',
        resolution_note: 'Fixed in the latest release.',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('update_issue_report_status', {
      p_report_id: 28,
      p_admin_id: 'admin-1',
      p_status: 'resolved',
      p_resolution_note: 'Fixed in the latest release.',
    });
    expect(mockDeliverPushNotifications).toHaveBeenCalledWith(expect.anything(), [{
      userId: 'reporter-1',
      type: 'issue_report_status',
      title: 'Issue report updated',
      body: 'Your report status is now resolved.',
      metadata: { issue_report_id: 28 },
    }]);
    expect(body.status_changed).toBe(true);
  });

  it('does not send a duplicate push when status remains unchanged', async () => {
    mockSupabaseServer.mockReturnValue({
      rpc: jest.fn().mockResolvedValue({
        data: { report: { id: 28, user_id: 'reporter-1', status: 'new' }, status_changed: false },
        error: null,
      }),
    });

    const response = await PATCH(makeRequest('/api/admin/issue-reports', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ report_id: 28, status: 'new' }),
    }));

    expect(response.status).toBe(200);
    expect(mockDeliverPushNotifications).not.toHaveBeenCalled();
  });
});
