import Link from 'next/link';
import { ArrowRight, LockKeyhole, Settings, ShieldCheck } from 'lucide-react';

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <section className="overflow-hidden rounded-2xl border border-cyan-500/25 bg-linear-to-br from-slate-900 via-slate-900 to-cyan-950/30 shadow-xl">
        <div className="p-6 sm:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            <Settings className="h-3.5 w-3.5" /> Account settings
          </div>
          <h1 className="text-3xl font-black text-white">Account management has moved</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Your account identity, regional details, email guidance, security actions, and preferences are now organised together inside Settings.</p>
          <Link href="/settings?section=account" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400">
            Open Account Settings <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <ShieldCheck className="h-6 w-6 text-emerald-300" />
          <h2 className="mt-4 text-lg font-bold text-white">One account workspace</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Username, login email, country, timezone, and account status now live in one Settings section.</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <LockKeyhole className="h-6 w-6 text-amber-300" />
          <h2 className="mt-4 text-lg font-bold text-white">Security stays protected</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Password reset and account protection continue through the existing authenticated security flow.</p>
        </div>
      </div>
    </div>
  );
}
