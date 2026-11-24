import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

interface AuthInputProps {
  id: string;
  name: string;
  type?: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
  error?: string;
  rightElement?: ReactNode;
}

export function AuthInput({
  id,
  name,
  type = 'text',
  label,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  hint,
  error,
  rightElement,
}: AuthInputProps) {
  const describedBy = [
    hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className="group">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[13px] font-semibold tracking-wide text-slate-400 transition-colors group-focus-within:text-slate-200"
      >
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`
            w-full rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3.5 text-sm text-white
            placeholder-slate-600 backdrop-blur-sm
            transition-all duration-200
            focus:border-amber-500/60 focus:bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-amber-500/20
            ${error ? 'border-red-500/60 focus:border-red-400/80 focus:ring-red-500/20' : ''}
            ${rightElement ? 'pr-12' : ''}
          `}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3.5">
            {rightElement}
          </div>
        )}
      </div>
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-[11px] text-slate-600">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-red-300">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
