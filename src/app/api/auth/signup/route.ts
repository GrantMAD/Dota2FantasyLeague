import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseServer } from '@/lib/supabase';
import { withApiTelemetry } from '@/lib/api-telemetry';
import { enforceAuthRateLimit } from '@/lib/auth-rate-limit';
import { getEmailConfirmationRedirectUrl } from '@/lib/auth-redirect';


/**
 * POST /api/auth/signup - Sign up a new user
 * Body:
 *   - email: User email
 *   - password: User password
 *   - username: Display username
 */
async function postHandler(request: NextRequest) {
  try {
    const rateLimitResponse = await enforceAuthRateLimit(request, 'signup');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    
    if (!email || !password || !username) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, username' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }
    
    const adminSupabase = supabaseServer();

    // Sign up user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getEmailConfirmationRedirectUrl(request.url),
      },
    });
    
    if (signUpError) {
      return NextResponse.json(
        { error: 'Sign up failed', details: signUpError.message },
        { status: 400 }
      );
    }
    
    if (!authData.user) {
      return NextResponse.json(
        { error: 'User creation failed' },
        { status: 500 }
      );
    }

    if (authData.user.identities?.length === 0) {
      return NextResponse.json(
        {
          message: 'If this address can be registered, a confirmation email will be sent.',
          user: authData.user,
        },
        { status: 201 }
      );
    }
    
    // Create user profile
    let profileError: { code?: string; message: string } | null = null;
    try {
      const { error } = await adminSupabase.from('users').insert([
        {
          id: authData.user.id,
          username,
          display_name: username,
        },
      ]);
      profileError = error;
    } catch (error: unknown) {
      profileError = {
        message: error instanceof Error ? error.message : String(error),
      };
    }
    
    if (profileError) {
      let cleanupSucceeded = false;
      try {
        const { error: cleanupError } = await adminSupabase.auth.admin.deleteUser(authData.user.id);
        if (cleanupError) throw cleanupError;
        cleanupSucceeded = true;
      } catch (cleanupError: unknown) {
        const cleanupErrorMessage = typeof cleanupError === 'object'
          && cleanupError !== null
          && 'message' in cleanupError
          && typeof cleanupError.message === 'string'
          ? cleanupError.message
          : String(cleanupError);
        console.error('Failed to clean up auth user after profile creation failed', {
          userId: authData.user.id,
          error: cleanupErrorMessage,
        });
      }

      const isDuplicateUsername = profileError.code === '23505';
      return NextResponse.json(
        {
          error: cleanupSucceeded
            ? isDuplicateUsername ? 'Username is already taken' : 'Profile creation failed'
            : 'Profile creation failed and account cleanup failed. Please contact support.',
          details: profileError.message,
        },
        { status: cleanupSucceeded && isDuplicateUsername ? 409 : 500 }
      );
    }
    
    return NextResponse.json(
      {
        message: 'User created successfully. Please check your email to confirm.',
        user: authData.user,
        session: authData.session,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export const POST = withApiTelemetry('POST', '/api/auth/signup', postHandler);
