const mockCreateClient = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

describe('getSupabaseServerClient', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = { from: jest.fn() };

  beforeEach(() => {
    jest.resetModules();
    mockCreateClient.mockReset();
    mockCreateClient.mockReturnValue(client);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  afterAll(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalAnonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  });

  it('creates and reuses a server client with the service-role key', async () => {
    const { getSupabaseServerClient } = await import('./supabase-server');

    expect(getSupabaseServerClient()).toBe(client);
    expect(getSupabaseServerClient()).toBe(client);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'test-service-role-key',
      expect.objectContaining({
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    );
  });

  it('throws instead of falling back to the anon key when the service-role key is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { getSupabaseServerClient } = await import('./supabase-server');

    expect(() => getSupabaseServerClient()).toThrow(
      'Missing Supabase environment variable: SUPABASE_SERVICE_ROLE_KEY'
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('reports a missing Supabase URL explicitly', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { getSupabaseServerClient } = await import('./supabase-server');

    expect(() => getSupabaseServerClient()).toThrow(
      'Missing Supabase environment variable: NEXT_PUBLIC_SUPABASE_URL'
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
