'use client';

import { useState } from 'react';
import Image from 'next/image';

interface TeamLogoProps {
  name: string;
  logoUrl?: string | null;
  tag?: string;
  size?: 'sm' | 'md' | 'lg';
  faction?: 'radiant' | 'dire';
  isWinner?: boolean;
}

export function TeamLogo({
  name,
  logoUrl,
  tag,
  size = 'md',
  faction,
  isWinner,
}: TeamLogoProps) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base',
  };

  const factionBorder = faction === 'radiant'
    ? isWinner
      ? 'border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
      : 'border-emerald-500/30'
    : faction === 'dire'
    ? isWinner
      ? 'border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.35)]'
      : 'border-rose-500/30'
    : 'border-slate-700';

  const initials = tag || name?.slice(0, 3).toUpperCase() || '???';

  return (
    <div
      className={`relative ${sizeClasses[size]} rounded-xl shrink-0 flex items-center justify-center font-bold tracking-wider overflow-hidden bg-slate-900/90 border ${factionBorder} transition-all duration-300 group-hover:scale-105`}
      title={name}
    >
      {logoUrl && !imageError ? (
        <Image
          src={logoUrl}
          alt={name}
          fill
          sizes="(max-width: 768px) 48px, 64px"
          className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-110"
          onError={() => setImageError(true)}
          unoptimized={logoUrl.startsWith('http')}
        />
      ) : (
        <span
          className={`${
            faction === 'radiant'
              ? 'text-emerald-400'
              : faction === 'dire'
              ? 'text-rose-400'
              : 'text-slate-300'
          }`}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
