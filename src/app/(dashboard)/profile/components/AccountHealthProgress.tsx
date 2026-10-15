'use client';

interface AccountHealthProgressProps {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
}

export function AccountHealthProgress({
  completed,
  total,
  size = 72,
  strokeWidth = 7,
}: AccountHealthProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0;
  const strokeDashoffset = circumference - fraction * circumference;
  const percent = Math.round(fraction * 100);

  const isAllComplete = completed === total && total > 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 transform"
        aria-label={`Account health: ${completed} of ${total} complete (${percent}%)`}
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        {/* Track background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-slate-800"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`transition-all duration-700 ease-out ${
            isAllComplete
              ? 'stroke-emerald-400'
              : fraction >= 0.5
                ? 'stroke-cyan-400'
                : 'stroke-amber-400'
          }`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {/* Centered label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
        <span className="text-xs font-black text-white">{completed}/{total}</span>
        <span className="mt-0.5 text-[9px] font-semibold text-slate-400">{percent}%</span>
      </div>
    </div>
  );
}
