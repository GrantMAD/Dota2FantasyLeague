import { NextRequest } from 'next/server';
import { POST } from '../route';
import { verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';

jest.mock('@/lib/auth-utils', () => ({
  applyRefreshedTokens: jest.fn(),
  verifyAuth: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseServer: jest.fn(),
}));

describe('profile avatar API', () => {
  const query = {
    select: jest.fn(),
    update: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn(),
  };
  const upload = jest.fn();
  const getPublicUrl = jest.fn();
  const remove = jest.fn();
  const storageBucket = { upload, getPublicUrl, remove };
  const getBucket = jest.fn();
  const createBucket = jest.fn();
  const storage = {
    getBucket,
    createBucket,
    from: jest.fn(() => storageBucket),
  };
  const client = {
    from: jest.fn(() => query),
    storage,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(verifyAuth).mockResolvedValue({ userId: 'user-1' } as Awaited<ReturnType<typeof verifyAuth>>);
    jest.mocked(supabaseServer).mockReturnValue(client as unknown as ReturnType<typeof supabaseServer>);
    query.select.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: { avatar_url: null }, error: null });
    Object.defineProperty(query, 'then', {
      configurable: true,
      value: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(resolve, reject),
    });
    getBucket.mockResolvedValue({ data: { public: true }, error: null });
    upload.mockResolvedValue({ error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/profile-avatars/user-1/avatar.png' } });
    remove.mockResolvedValue({ error: null });
  });

  function createRequest(file: File): NextRequest {
    const body = new FormData();
    body.append('avatar', file);
    return new NextRequest('http://localhost/api/user/avatar', {
      method: 'POST',
      headers: { authorization: 'Bearer access-token' },
      body,
    });
  }

  it('rejects image content that does not match its declared file type', async () => {
    const file = new File(['not a png'], 'avatar.png', { type: 'image/png' });
    const response = await POST(createRequest(file));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'The selected file does not match its image type.' });
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads valid images to the authenticated user folder and saves the public URL', async () => {
    const file = new File([
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ], 'avatar.png', { type: 'image/png' });
    const response = await POST(createRequest(file));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      avatar_url: 'https://example.supabase.co/storage/v1/object/public/profile-avatars/user-1/avatar.png',
    });
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/.+\.png$/),
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'image/png', upsert: false }),
    );
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      avatar_url: 'https://example.supabase.co/storage/v1/object/public/profile-avatars/user-1/avatar.png',
    }));
  });

  it('creates the public bucket when it has not been provisioned yet', async () => {
    getBucket
      .mockResolvedValueOnce({ data: null, error: { statusCode: '404', message: 'Not found' } })
      .mockResolvedValueOnce({ data: { public: true }, error: null });
    createBucket.mockResolvedValue({ error: null });
    const file = new File([
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ], 'avatar.png', { type: 'image/png' });

    const response = await POST(createRequest(file));

    expect(response.status).toBe(200);
    expect(createBucket).toHaveBeenCalledWith('profile-avatars', expect.objectContaining({
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    }));
  });
});
