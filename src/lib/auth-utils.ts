/**
 * Authentication Utilities
 * 
 * Helper functions for checking authentication and authorization
 */

import { supabaseServer } from '@/lib/supabase';

export interface AuthError {
  status: number;
  message: string;
}

/**
 * Check if a request has valid authentication headers
 * Returns the session if valid, or throws an error
 */
export async function verifyAuth(request: Request): Promise<{
  userId: string;
  email: string;
  role?: string;
}> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw {
      status: 401,
      message: 'Missing or invalid authorization header',
    } as AuthError;
  }

  const token = authHeader.substring(7);
  const supabase = supabaseServer();

  // Verify the JWT token
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw {
      status: 401,
      message: 'Invalid or expired token',
    } as AuthError;
  }

  return {
    userId: data.user.id,
    email: data.user.email || '',
    role: data.user.user_metadata?.role,
  };
}

/**
 * Check if user has admin role
 */
export async function verifyAdminAuth(request: Request): Promise<string> {
  const auth = await verifyAuth(request);

  // Check if user has admin role (stored in user metadata)
  if (auth.role !== 'admin') {
    throw {
      status: 403,
      message: 'Admin access required. Your role: ' + (auth.role || 'user'),
    } as AuthError;
  }

  return auth.userId;
}

/**
 * Create a JSON error response
 */
export function createErrorResponse(error: AuthError | Error): Response {
  if ('status' in error) {
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: error.status }
    );
  }

  return Response.json(
    {
      success: false,
      error: error.message,
    },
    { status: 500 }
  );
}
