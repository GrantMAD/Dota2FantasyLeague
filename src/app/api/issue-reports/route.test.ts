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

  it('validates report links before querying owned reports', async () => {
    mockSupabaseServer.mockReturnValue({});

    const response = await GET(makeRequest('/api/issue-reports?reportId=invalid'));

    expect(response.status).toBe(400);
  });
});
