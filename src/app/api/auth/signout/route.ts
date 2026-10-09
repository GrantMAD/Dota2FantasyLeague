import { NextResponse } from 'next/server';
import { withApiTelemetry } from '@/lib/api-telemetry';


async function postHandler() {
  const response = NextResponse.json({ message: 'Signed out successfully' });

  response.cookies.set('sb-auth-token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set('sb-refresh-token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return response;
}

export const POST = withApiTelemetry('POST', '/api/auth/signout', postHandler);
