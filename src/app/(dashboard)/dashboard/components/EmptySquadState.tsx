import Link from 'next/link';
import { ArrowRight, Shield, Sparkles, Users } from 'lucide-react';

export function EmptySquadState() {
  return (
    <section
      aria-labelledby="empty-squad-title"
      className="relative overflow-hidden rounded-2xl border border-dashed p-8 text-center sm:p-10"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={{ background: 'var(--accent-primary)' }}
      />
      <div aria-hidden="true" className="relative mx-auto mb-6 flex h-24 max-w-64 items-center justify-center gap-2">
        <div className="absolute inset-x-8 bottom-1 h-12 rounded-full opacity-25 blur-2xl" style={{ background: 'var(--accent-primary)' }} />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--accent-primary)' }}>
          <Shield className="h-8 w-8" />
        </div>
        <div className="relative -ml-2 mt-8 flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--accent-secondary)' }}>
          <Users className="h-6 w-6" />
        </div>
        <Sparkles className="absolute right-8 top-1 h-5 w-5" style={{ color: 'var(--accent-secondary)' }} />
      </div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--accent-primary)' }}>
        Your season starts here
      </p>
      <h3 id="empty-squad-title" className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        Build your first fantasy squad
      </h3>
      <p className="mx-auto mb-6 mt-2 max-w-md text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
        Pick your players, set a captain, and start competing for points with managers around the world.
      </p>
      <Link
        href="/squads"
        className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ background: 'var(--accent-primary)' }}
      >
        Build your squad
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </section>
  );
}
