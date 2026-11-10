'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { AuthCard } from '@/components/auth/AuthCard';
import { BrandLogo } from '@/components/BrandLogo';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function completeConfirmation() {
      try {
        const url = new URL(window.location.href);
        const query = url.searchParams;
        const fragment = new URLSearchParams(url.hash.slice(1));
        if (query.has('error') || fragment.has('error')) {
          throw new Error('This confirmation link is invalid or has expired. Request a new one and try again.');
        }

        let session: Session | null = null;
        const tokenHash = query.get('token_hash');
        const otpType = query.get('type');
        const code = query.get('code');

        if (tokenHash && (otpType === 'signup' || otpType === 'email')) {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (verifyError) throw verifyError;
          session = data.session;
        } else if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          session = data.session;
        } else {
          const accessToken = fragment.get('access_token');
          const refreshToken = fragment.get('refresh_token');
          if (!accessToken || !refreshToken) {
            throw new Error('This confirmation link is missing the required credentials. Request a new one and try again.');
          }
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          session = data.session;
        }

        if (!session) throw new Error('Email confirmation did not create a session. Please sign in to continue.');

        const cookieResponse = await fetch('/api/auth/refresh-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        });
        if (!cookieResponse.ok) throw new Error('Email confirmed, but your session could not be started. Please sign in.');

        window.history.replaceState(null, '', '/auth/callback');
        router.replace('/dashboard');
      } catch (caughtError: unknown) {
        setError(caughtError instanceof Error
          ? caughtError.message
          : 'Email confirmation failed. Request a new confirmation email and try again.');
      }
    }

    void completeConfirmation();
  }, [router]);

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10 text-slate-100">
      <AuthBackground />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <BrandLogo className="mx-auto h-12 w-12" />
          <h1 className="mt-5 text-3xl font-black text-white">
            {error ? 'Confirmation link issue' : 'Confirming your email'}
          </h1>
        </div>
        <AuthCard>
          {error ? (
            <div className="space-y-4 text-center">
              <p role="alert" className="text-sm leading-6 text-slate-300">{error}</p>
              <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-500 px-5 text-sm font-bold text-amber-950 hover:bg-amber-400">
                Go to sign in
              </Link>
            </div>
          ) : (
            <p role="status" className="text-center text-sm text-slate-300">
              Please wait while we verify your email and prepare your account.
            </p>
          )}
        </AuthCard>
      </div>
    </main>
  );
}
