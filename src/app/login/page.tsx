'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BrandLogo } from '@/components/BrandLogo';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to sign in');
      }

      // Sync session tokens to the browser's Supabase client (localStorage).
      const responseData = await response.json();
      if (responseData.session?.access_token && responseData.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: responseData.session.access_token,
          refresh_token: responseData.session.refresh_token,
        });
      }

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 text-slate-100">
      <AuthBackground />

      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        {/* Brand header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="group mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950/80 ring-1 ring-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.18)] transition-all group-hover:shadow-[0_0_36px_rgba(245,158,11,0.32)] group-hover:ring-amber-400/60">
              <BrandLogo className="h-9 w-9" priority />
            </div>
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent font-bold text-xl">
              Fantasy Dota 2
            </span>
          </Link>
          <h1 className="text-3xl font-black text-white tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-sm text-slate-400">Sign in to continue your season</p>
        </div>

        {/* Card */}
        <AuthCard>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-400 backdrop-blur-sm">
                <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <AuthInput
              id="email"
              name="email"
              type="email"
              label="Email address"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-[13px] font-semibold tracking-wide text-slate-400">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-amber-500/80 transition-colors hover:text-amber-400"
                >
                  Forgot password?
                </Link>
              </div>
              <AuthInput
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                label=""
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="rounded-lg p-1 text-slate-500 transition-colors hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </div>

            <button
              type="submit"
              id="login-submit"
              disabled={isLoading}
              className="animate-glow-pulse mt-2 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 hover:from-amber-400 hover:to-orange-500 hover:shadow-orange-500/35 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeOpacity="0.3"/><path d="M21 12a9 9 0 0 1-9 9" /></svg>
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign In
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-600">or</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          {/* Sign up link */}
          <p className="text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold text-amber-400 transition-colors hover:text-amber-300">
              Create one free →
            </Link>
          </p>
        </AuthCard>

        {/* Trust footer */}
        <div className="mt-6 flex flex-wrap justify-center gap-4 text-[11px] font-medium text-slate-600">
          {['Free to play', 'No credit card required', 'Live match data'].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <svg className="h-3 w-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
