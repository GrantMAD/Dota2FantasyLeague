import { NextRequest } from 'next/server';
import { POST } from './route';

const mockSignUp = jest.fn();
const mockSupabaseServer = jest.fn();
const mockDeleteUser = jest.fn();
const mockInsert = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signUp: (...args: unknown[]) => mockSignUp(...args) } },
  supabaseServer: (...args: unknown[]) => mockSupabaseServer(...args),
}));

jest.mock('@/lib/api-telemetry', () => ({
  withApiTelemetry: (_method: string, _route: string, handler: unknown) => handler,
}));

function createRequest() {
  return new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'manager@example.test',
      password: 'secure-password',
      username: 'manager',
    }),
  });
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'auth-user-1' } },
      error: null,
    });
    mockInsert.mockResolvedValue({ error: null });
    mockDeleteUser.mockResolvedValue({ error: null });
    mockSupabaseServer.mockReturnValue({
      from: () => ({ insert: mockInsert }),
      auth: { admin: { deleteUser: mockDeleteUser } },
    });
  });

  it('creates the profile without deleting the newly created auth user', async () => {
    const response = await POST(createRequest());

    expect(response.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith([{
      id: 'auth-user-1',
      username: 'manager',
      display_name: 'manager',
    }]);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it('deletes the auth user when profile creation fails', async () => {
    mockInsert.mockResolvedValue({
      error: { code: '23505', message: 'Username already exists' },
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: 'Username is already taken' });
    expect(mockDeleteUser).toHaveBeenCalledWith('auth-user-1');
  });

  it('deletes the auth user when profile insertion throws', async () => {
    mockInsert.mockRejectedValue(new Error('Database connection failed'));

    const response = await POST(createRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: 'Profile creation failed' });
    expect(mockDeleteUser).toHaveBeenCalledWith('auth-user-1');
  });

  it('checks service-role configuration before creating an auth user', async () => {
    mockSupabaseServer.mockImplementation(() => {
      throw new Error('Missing Supabase service role key');
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(500);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('reports and logs a cleanup failure instead of implying rollback succeeded', async () => {
    const logError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockInsert.mockResolvedValue({
      error: { code: '23505', message: 'Username already exists' },
    });
    mockDeleteUser.mockResolvedValue({
      error: { message: 'Auth deletion failed' },
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: 'Profile creation failed and account cleanup failed. Please contact support.',
    });
    expect(logError).toHaveBeenCalledWith(
      'Failed to clean up auth user after profile creation failed',
      { userId: 'auth-user-1', error: 'Auth deletion failed' },
    );
    logError.mockRestore();
  });
});
