'use client';

import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  targetDate: Date;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    function calculate(): TimeLeft {
      const diff = Math.max(0, targetDate.getTime() - Date.now());
      const days = Math.floor(diff / 86_400_000);
      const hours = Math.floor((diff % 86_400_000) / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1_000);
      return { days, hours, minutes, seconds };
    }

    setTimeLeft(calculate());
    const id = setInterval(() => setTimeLeft(calculate()), 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!mounted || !timeLeft) {
    return <div className="h-20" />;
  }

  const segments = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hrs', value: timeLeft.hours },
    { label: 'Min', value: timeLeft.minutes },
    { label: 'Sec', value: timeLeft.seconds },
  ];

  return (
    <div className="landing-countdown inline-flex items-center gap-1 rounded-2xl border border-amber-500/20 bg-slate-900/70 px-5 py-3 backdrop-blur-sm shadow-[0_0_30px_rgba(245,158,11,0.08)]">
      <span className="mr-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
        Next GW
      </span>
      {segments.map((seg, i) => (
        <span key={seg.label} className="flex items-center">
          <span className="flex flex-col items-center">
            <span className="min-w-[2.2rem] rounded-lg bg-slate-800/80 px-2 py-1 text-center text-xl font-black tabular-nums text-amber-400 ring-1 ring-slate-700/60">
              {pad(seg.value)}
            </span>
            <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-500">
              {seg.label}
            </span>
          </span>
          {i < segments.length - 1 && (
            <span className="mx-1 mb-3 text-xl font-bold text-amber-500/60">:</span>
          )}
        </span>
      ))}
    </div>
  );
}
