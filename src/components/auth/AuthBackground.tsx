'use client';

import { ParticleCanvas } from '@/components/landing/ParticleCanvas';

export function AuthBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, #05080f 0%, #08101e 50%, #0a1428 100%)' }}
      />

      {/* Particle layer */}
      <ParticleCanvas />

      {/* Amber orb — top centre */}
      <div
        className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(245,158,11,0.16) 0%, rgba(245,158,11,0.05) 45%, transparent 70%)',
        }}
      />

      {/* Cyan orb — right edge */}
      <div
        className="absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Violet orb — bottom left */}
      <div
        className="absolute -left-24 bottom-0 h-[400px] w-[400px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}
