'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Mail } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw new Error(resetError.message);
      setSuccess(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12 text-slate-100">
      <AuthBackground />
      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="mb-7 flex justify-center">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950/80 shadow-[0_0_24px_rgba(245,158,11,0.18)] ring-1 ring-amber-500/40 transition group-hover:ring-amber-400/60">
              <BrandLogo className="h-8 w-8" priority />
            </div>
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-xl font-bold text-transparent">
              Fantasy Dota 2
            </span>
          </Link>
        </div>

        <AuthCard>
          {success ? (
            <section aria-labelledby="recovery-success-title" aria-live="polite" className="text-center">
              <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/35 shadow-[0_0_32px_rgba(52,211,153,0.16)]">
                <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full border border-emerald-300/40" />
                <Check className="relative h-8 w-8 animate-fade-up" strokeWidth={3} aria-hidden="true" />
              </div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Recovery email sent</p>
              <h1 id="recovery-success-title" className="text-2xl font-black tracking-tight text-white">Check your email</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                If an account is registered with <span className="font-semibold text-amber-300">{email}</span>, you will receive a password reset link.
              </p>

              <ol className="mt-6 space-y-3 rounded-2xl border border-white/8 bg-slate-950/35 p-4 text-left text-sm text-slate-300">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-300">1</span>
                  <span>Open the recovery email and follow its reset link.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-300">2</span>
                  <span>Choose a new password on the page the link opens.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-300">3</span>
                  <span>Return here to sign in with your new password.</span>
                </li>
              </ol>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Nothing in your inbox? Check spam or junk, or try sending the link again.
              </p>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="mt-5 text-sm font-semibold text-amber-300 transition hover:text-amber-200"
              >
                Try again
              </button>
              <Link
                href="/login"
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to sign in
              </Link>
            </section>
          ) : (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-300">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Account recovery</p>
                <h1 className="text-2xl font-black tracking-tight text-white">Reset your password</h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Enter the email address for your account and we&apos;ll send you a secure reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                )}
                <AuthInput
                  id="email"
                  name="email"
                  type="email"
                  label="Email address"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
                <button
                  type="submit"
                  id="forgot-password-submit"
                  disabled={isLoading}
                  className="mt-2 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 hover:from-amber-400 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {isLoading ? 'Sending reset link…' : 'Send reset link'}
                </button>
              </form>

              <Link
                href="/login"
                className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Remember your password? Sign in
              </Link>
            </>
          )}
        </AuthCard>
      </div>
    </main>
  );
}
