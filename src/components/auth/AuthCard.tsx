import type { ReactNode } from 'react';

interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

export function AuthCard({ children, className = '' }: AuthCardProps) {
  return (
    <div className={`relative w-full ${className}`}>
      {/* Outer glow */}
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl"
        style={{
          background:
            'linear-gradient(180deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.04) 40%, transparent 100%)',
        }}
      />

      {/* Card */}
      <div
        className="relative rounded-3xl border border-white/8 bg-slate-900/70 shadow-[0_40px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl overflow-hidden"
      >
        {/* Top amber accent line */}
        <div
          className="h-px w-full"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.5) 35%, rgba(245,158,11,0.7) 50%, rgba(245,158,11,0.5) 65%, transparent 100%)',
          }}
        />

        <div className="px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
