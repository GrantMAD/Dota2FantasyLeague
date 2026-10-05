'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
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
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-950 to-slate-900 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-linear-to-br from-amber-500 to-orange-600 font-bold text-white">D2</span>
          <span className="bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-xl font-bold text-transparent">Fantasy Dota 2</span>
        </Link>

        {updated ? (
          <div>
            <h1 className="text-2xl font-bold text-white">Password updated</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">Your password has been changed. Sign in with your new password to continue.</p>
            <Link href="/login" className="mt-6 inline-flex rounded-lg bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-500">Back to sign in</Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white">Choose a new password</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Use at least 8 characters. This password will replace the one currently on your account.</p>

            {error && <div role="alert" className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

            {checkingRecovery ? (
              <p role="status" className="mt-6 text-sm text-slate-400">Verifying your password reset link…</p>
            ) : recoveryReady ? (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-slate-300">New password</label>
                  <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-slate-300">Confirm new password</label>
                  <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-amber-500" />
                </div>
                <button type="submit" disabled={saving} className="w-full rounded-lg bg-linear-to-r from-amber-500 to-orange-600 px-4 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? 'Updating password…' : 'Update password'}
                </button>
              </form>
            ) : (
              <div className="mt-6">
                {!error && <p className="text-sm text-slate-400">This link is missing or expired. Request a fresh password reset link to continue.</p>}
                <Link href="/forgot-password" className="mt-4 inline-flex text-sm font-semibold text-amber-400 hover:text-amber-300">Request another reset link</Link>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
