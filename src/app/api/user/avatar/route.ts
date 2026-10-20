import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyRefreshedTokens, verifyAuth } from '@/lib/auth-utils';
import { supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';

const AVATAR_BUCKET = 'profile-avatars';
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = {
  'image/jpeg': { extension: 'jpg', signature: [0xff, 0xd8, 0xff] },
  'image/png': { extension: 'png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'image/webp': { extension: 'webp', signature: null },
} as const;

type AvatarMimeType = keyof typeof ALLOWED_TYPES;

function hasValidImageSignature(type: AvatarMimeType, bytes: Uint8Array): boolean {
  if (type === 'image/webp') {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  }

  return ALLOWED_TYPES[type].signature.every((byte, index) => bytes[index] === byte);
}

async function ensureAvatarBucket(storage: SupabaseClient['storage']) {
  const { data, error } = await storage.getBucket(AVATAR_BUCKET);
  if (!error) {
    if (!data.public) throw new Error('The profile avatar bucket must be public.');
    return;
  }
  if (error.statusCode !== '404') {
    throw new Error(`Unable to check profile avatar storage: ${error.message}`);
  }

  const { error: createError } = await storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: MAX_AVATAR_SIZE,
    allowedMimeTypes: Object.keys(ALLOWED_TYPES),
  });
  if (!createError) return;

  const { data: createdBucket, error: verifyError } = await storage.getBucket(AVATAR_BUCKET);
  if (!verifyError && createdBucket.public) return;
  throw new Error(`Unable to initialize profile avatar storage: ${createError.message}`);
}

function getOwnedAvatarPath(avatarUrl: string | null, userId: string): string | null {
  if (!avatarUrl || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  try {
    const avatar = new URL(avatarUrl);
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const publicPrefix = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    if (avatar.origin !== supabaseUrl.origin || !avatar.pathname.startsWith(publicPrefix)) return null;

    const objectPath = decodeURIComponent(avatar.pathname.slice(publicPrefix.length));
    if (!objectPath.startsWith(`${userId}/`) || objectPath.split('/').includes('..')) return null;
    return objectPath;
  } catch {
    return null;
  }
}

async function postHandler(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;

  try {
    auth = await verifyAuth(request);

    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_AVATAR_SIZE + 64 * 1024) {
      return NextResponse.json({ error: 'Profile images must be 5 MB or smaller.' }, { status: 413 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Choose a valid image file to upload.' }, { status: 400 });
    }

    const file = formData.get('avatar');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Choose an image file to upload.' }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json({ error: 'Profile images must be larger than 0 bytes and 5 MB or smaller.' }, { status: 400 });
    }
    if (!Object.hasOwn(ALLOWED_TYPES, file.type)) {
      return NextResponse.json({ error: 'Use a JPEG, PNG, or WebP image.' }, { status: 400 });
    }

    const mimeType = file.type as AvatarMimeType;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidImageSignature(mimeType, bytes)) {
      return NextResponse.json({ error: 'The selected file does not match its image type.' }, { status: 400 });
    }

    const supabase = supabaseServer();
    await ensureAvatarBucket(supabase.storage);

    const { data: existingProfile, error: profileReadError } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', auth.userId)
      .maybeSingle();
    if (profileReadError || !existingProfile) {
      throw new Error(profileReadError?.message ?? 'Profile not found.');
    }

    const objectPath = `${auth.userId}/${randomUUID()}.${ALLOWED_TYPES[mimeType].extension}`;
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(objectPath, bytes, { contentType: mimeType, cacheControl: '3600', upsert: false });
    if (uploadError) throw new Error(`Unable to upload profile image: ${uploadError.message}`);

    const avatarUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath).data.publicUrl;
    const { error: profileUpdateError } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', auth.userId);

    if (profileUpdateError) {
      const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([objectPath]);
      if (cleanupError) {
        console.error('Failed to remove an uploaded avatar after the profile update failed.', cleanupError);
      }
      throw new Error(`Unable to save profile image: ${profileUpdateError.message}`);
    }

    const oldObjectPath = getOwnedAvatarPath(existingProfile.avatar_url, auth.userId);
    if (oldObjectPath && oldObjectPath !== objectPath) {
      const { error: cleanupError } = await supabase.storage.from(AVATAR_BUCKET).remove([oldObjectPath]);
      if (cleanupError) console.error('Failed to remove the previous profile avatar.', cleanupError);
    }

    const response = NextResponse.json({ avatar_url: avatarUrl });
    applyRefreshedTokens(response, auth);
    return response;
  } catch (error: unknown) {
    console.error('Unable to upload profile avatar:', error);
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: number }).status)
      : 500;
    const response = NextResponse.json(
      { error: status === 401 ? 'You must be signed in to update your profile image.' : 'Unable to upload profile image.' },
      { status },
    );
    if (auth) applyRefreshedTokens(response, auth);
    return response;
  }
}

export const POST = withApiTelemetry('POST', '/api/user/avatar', postHandler);
