'use client';

interface PasswordStrengthProps {
  password: string;
}

function getStrength(password: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (!password) return { level: 0, label: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[0-9!@#$%^&*]/.test(password)) score++;
  if (score === 0) return { level: 1, label: 'Weak' };
  if (score === 1) return { level: 2, label: 'Fair' };
  return { level: 3, label: 'Strong' };
}

const LEVEL_STYLES: Record<number, { bar: string; text: string }> = {
  0: { bar: 'bg-slate-700', text: 'text-slate-600' },
  1: { bar: 'bg-red-500',    text: 'text-red-400' },
  2: { bar: 'bg-amber-400',  text: 'text-amber-400' },
  3: { bar: 'bg-emerald-400',text: 'text-emerald-400' },
};

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { level, label } = getStrength(password);
  const styles = LEVEL_STYLES[level];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1.5">
        {[1, 2, 3].map((seg) => (
          <div
            key={seg}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              level >= seg ? styles.bar : 'bg-slate-800'
            }`}
          />
        ))}
      </div>
      {label && (
        <p className={`text-[11px] font-semibold ${styles.text}`}>
          {label} password
        </p>
      )}
    </div>
  );
}
