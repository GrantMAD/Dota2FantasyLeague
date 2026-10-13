'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';
import { PasswordStrength } from '@/components/auth/PasswordStrength';
import { AuthSuccessOverlay } from '@/components/auth/AuthSuccessOverlay';

const TRUST_POINTS = [
  { text: 'Free forever — no subscription' },
  { text: 'Live DPC & tournament data' },
  { text: 'Compete in global leagues' },
  { text: '4 600+ professional players' },
];

const MINI_PLAYERS = [
  { name: 'Yatoro', role: 'Carry', pts: 184 },
  { name: 'Collapse', role: 'Offlane', pts: 147 },
  { name: 'Tobi', role: 'Support', pts: 139 },
];

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          username: formData.username,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details ? `${data.error}: ${data.details}` : data.error || 'Failed to sign up');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthSuccessOverlay
        title="Account Created!"
        message="Check your inbox to confirm your email address, then sign in to build your squad."
        redirectHref="/login"
        redirectLabel="Go to Sign In"
        redirectDelay={4000}
      />
    );
  }

  return (
    <div className="relative min-h-screen text-slate-100">
      <AuthBackground />

      {/* ── LAYOUT ───────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex min-h-screen items-center justify-center py-14 px-4">
        <div className="flex w-full max-w-5xl flex-col lg:flex-row lg:gap-0">

        {/* ── LEFT PANEL (brand story) ───────────────────────────────────── */}
        <div className="flex flex-col justify-center py-10 pr-12 lg:w-[400px] lg:shrink-0 xl:w-[440px] xl:pr-16">
          <div className="w-full">
          {/* Logo */}
          <Link href="/" className="group mb-10 flex items-center gap-3 self-start">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950/80 ring-1 ring-amber-500/40 shadow-[0_0_24px_rgba(245,158,11,0.18)] transition-all group-hover:shadow-[0_0_36px_rgba(245,158,11,0.3)]">
              <BrandLogo className="h-8 w-8" priority />
            </div>
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent font-bold text-xl">
              Fantasy Dota 2
            </span>
          </Link>

          {/* Headline */}
          <div className="mb-8 animate-fade-up">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Season 2026 Live
            </span>
            <h1 className="mt-4 text-4xl font-black leading-[1.1] tracking-tight text-white xl:text-5xl">
              Build your{' '}
              <span className="block bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 bg-clip-text text-transparent">
                dream squad.
              </span>
            </h1>
            <p className="mt-4 text-slate-400 leading-relaxed">
              Draft top pro players, track live stats, and climb the global leaderboard every gameweek.
            </p>
          </div>

          {/* Trust bullets */}
          <ul className="mb-10 animate-fade-up-delay-1 space-y-3">
            {TRUST_POINTS.map(({ text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
                  <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                {text}
              </li>
            ))}
          </ul>

          {/* Mini squad preview */}
          <div className="animate-fade-up-delay-2 rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Live Example</p>
              <p className="text-xs font-bold text-amber-400">GW14 · 894 pts</p>
            </div>
            <div className="space-y-2">
              {MINI_PLAYERS.map((p) => (
                <div key={p.name} className="flex items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-900/60 px-3 py-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 ring-1 ring-slate-600/50 text-[10px] font-bold text-slate-300">
                    {p.name.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                    <p className="text-[10px] text-slate-500">{p.role}</p>
                  </div>
                  <p className="text-sm font-bold text-amber-400">{p.pts}</p>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>

        {/* ── RIGHT PANEL (form) ─────────────────────────────────────────── */}
        <div className="flex flex-1 items-center justify-start border-l border-slate-800/60 pl-12 py-10 xl:pl-16">
          <div className="w-full max-w-md animate-fade-up-delay-1">
            {/* Heading above card */}
            <div className="mb-6 text-center lg:text-left">
              <h2 className="text-2xl font-black text-white">Join the Arena</h2>
              <p className="mt-1 text-sm text-slate-400">Create your free account — it takes 30 seconds.</p>
            </div>

            <AuthCard>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  id="username"
                  name="username"
                  type="text"
                  label="Username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Choose your manager name"
                  required
                  autoComplete="username"
                />

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
                  <AuthInput
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    label="Password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    hint="At least 8 characters"
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
                  <PasswordStrength password={formData.password} />
                </div>

                <AuthInput
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  label="Confirm password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      className="rounded-lg p-1 text-slate-500 transition-colors hover:text-slate-300"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />

                <button
                  type="submit"
                  id="signup-submit"
                  disabled={isLoading}
                  className="animate-glow-pulse mt-2 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 hover:from-amber-400 hover:to-orange-500 hover:shadow-orange-500/35 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeOpacity="0.3"/><path d="M21 12a9 9 0 0 1-9 9" /></svg>
                      Creating Account…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Create Free Account
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </span>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-800" />
                <span className="text-xs text-slate-600">or</span>
                <div className="h-px flex-1 bg-slate-800" />
              </div>

              <p className="text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-amber-400 transition-colors hover:text-amber-300">
                  Sign in →
                </Link>
              </p>
            </AuthCard>

            {/* Legal */}
            <p className="mt-5 text-center text-[11px] text-slate-600">
              By creating an account you agree to our{' '}
              <Link href="/terms" className="underline hover:text-slate-400">Terms</Link>
              {' '}and{' '}
              <Link href="/privacy" className="underline hover:text-slate-400">Privacy Policy</Link>.
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
