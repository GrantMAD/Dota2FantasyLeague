'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, KeyRound } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checkingRecovery, setCheckingRecovery] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        active &&
        session &&
        (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
      ) {
        setRecoveryReady(true);
        setCheckingRecovery(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError('The password reset link could not be verified. Request a new link and try again.');
      } else if (data.session) {
        setRecoveryReady(true);
      }
      setCheckingRecovery(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Your new password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setUpdated(true);
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update your password.');
    } finally {
      setSaving(false);
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
          {updated ? (
            <section aria-labelledby="password-updated-title" aria-live="polite" className="text-center">
              <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/35 shadow-[0_0_32px_rgba(52,211,153,0.16)]">
                <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full border border-emerald-300/40" />
                <Check className="relative h-8 w-8 animate-fade-up" strokeWidth={3} aria-hidden="true" />
              </div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Password changed</p>
              <h1 id="password-updated-title" className="text-2xl font-black tracking-tight text-white">You&apos;re all set</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Your password has been updated. Sign in using your new password to continue.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 hover:from-amber-400 hover:to-orange-500"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to sign in
              </Link>
            </section>
          ) : (
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-300">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">Secure account recovery</p>
                <h1 className="text-2xl font-black tracking-tight text-white">Choose a new password</h1>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Set a password with at least 8 characters. You&apos;ll use it next time you sign in.
                </p>
              </div>

              {error && (
                <div role="alert" className="mb-5 rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {checkingRecovery ? (
                <p role="status" className="py-5 text-center text-sm text-slate-400">Verifying your password reset link…</p>
              ) : recoveryReady ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <AuthInput
                      id="new-password"
                      name="new-password"
                      type="password"
                      label="New password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      required
                      autoComplete="new-password"
                      hint="Use at least 8 characters."
                    />
                    <PasswordStrength password={password} />
                  </div>
                  <AuthInput
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    label="Confirm new password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Enter your new password again"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 hover:from-amber-400 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {saving ? 'Updating password…' : 'Update password'}
                  </button>
                </form>
              ) : (
                <div className="text-center">
                  {!error && (
                    <p className="text-sm leading-6 text-slate-400">
                      This reset link is missing or could not be verified. Request a fresh link to continue.
                    </p>
                  )}
                  <Link
                    href="/forgot-password"
                    className="mt-5 inline-flex items-center justify-center gap-2 text-sm font-semibold text-amber-300 transition hover:text-amber-200"
                  >
                    Request another reset link
                  </Link>
                </div>
              )}

              <Link
                href="/login"
                className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-300"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to sign in
              </Link>
            </>
          )}
        </AuthCard>
      </div>
    </main>
  );
}
