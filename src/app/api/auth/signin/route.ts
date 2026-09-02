import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/auth/signin - Sign in a user
 * Body:
 *   - email: User email
 *   - password: User password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password' },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return NextResponse.json(
        { error: 'Sign in failed', details: error.message },
        { status: 401 }
      );
    }
    
    const response = NextResponse.json(
      {
        message: 'Signed in successfully',
        user: data.user,
        session: data.session,
      },
      { status: 200 }
    );

    if (data.session?.access_token) {
      response.cookies.set('sb-auth-token', data.session.access_token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: data.session.expires_in ?? 3600,
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
