import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseServer } from '@/lib/supabase';

/**
 * POST /api/auth/signup - Sign up a new user
 * Body:
 *   - email: User email
 *   - password: User password
 *   - username: Display username
 */
export async function POST(request: NextRequest) {
  try {
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
    
    // Sign up user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
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
    
    // Create user profile
    const { error: profileError } = await supabaseServer().from('users').insert([
      {
        id: authData.user.id,
        username,
        display_name: username,
      },
    ]);
    
    if (profileError) {
      // Clean up auth user if profile creation fails
      const isDuplicateUsername = profileError.code === '23505';
      return NextResponse.json(
        {
          error: isDuplicateUsername ? 'Username is already taken' : 'Profile creation failed',
          details: profileError.message,
        },
        { status: isDuplicateUsername ? 409 : 500 }
      );
    }
    
    return NextResponse.json(
      {
        message: 'User created successfully. Please check your email to confirm.',
        user: authData.user,
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
