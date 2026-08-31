import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Verify user authorization
 * Returns user object if authorized, null if not
 */
export async function verifyAuth(request: NextRequest) {
  void request;

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch {
    return null;
  }
}

/**
 * Check if user is admin (placeholder for now)
 */
export async function isAdmin(userId: string): Promise<boolean> {
  void userId;
  // TODO: Implement admin role check from database
  return false;
}

/**
 * Return unauthorized response
 */
export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * Return forbidden response
 */
export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Return error response
 */
export function errorResponse(error: string, details?: string, status = 500) {
  return NextResponse.json(
    {
      error,
      ...(details && { details }),
    },
    { status }
  );
}

/**
 * Return success response
 */
export function successResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
