'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { AuthBackground } from '@/components/auth/AuthBackground';

interface AuthSuccessOverlayProps {
  title: string;
  message: string;
  redirectHref: string;
  redirectLabel: string;
  redirectDelay?: number; // ms
}

export function AuthSuccessOverlay({
  title,
  message,
  redirectHref,
  redirectLabel,
  redirectDelay = 4000,
}: AuthSuccessOverlayProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min((elapsed / redirectDelay) * 100, 100));
      if (elapsed >= redirectDelay) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [redirectDelay]);

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 text-slate-100">
      <AuthBackground />

      <div className="relative z-10 w-full max-w-sm text-center animate-fade-up">
        {/* Floating logo */}
        <div className="mb-8 inline-flex animate-float h-24 w-24 items-center justify-center rounded-3xl border border-amber-500/40 bg-slate-900/70 shadow-[0_0_50px_rgba(245,158,11,0.2)] backdrop-blur-sm">
          <BrandLogo className="h-16 w-16" />
        </div>

        {/* Success icon */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30 shadow-[0_0_30px_rgba(52,211,153,0.15)]">
            <svg className="h-8 w-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <h1 className="mb-3 text-3xl font-black text-white">
          {title.split(' ').map((word, i, arr) =>
            i === arr.length - 1 ? (
              <span key={i} className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                {word}
              </span>
            ) : (
              <span key={i}>{word} </span>
            )
          )}
        </h1>

        {/* Message card */}
        <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-6 py-4 backdrop-blur-sm">
          <p className="text-sm leading-relaxed text-slate-300">{message}</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">Redirecting you shortly…</p>
        </div>

        <Link
          href={redirectHref}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/60 px-6 py-2.5 text-sm font-semibold text-slate-300 backdrop-blur-sm transition-all hover:border-slate-600 hover:text-white"
        >
          {redirectLabel}
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </Link>
      </div>
    </div>
  );
}
