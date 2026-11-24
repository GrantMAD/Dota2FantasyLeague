import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

interface AuthErrorProps {
  children: ReactNode;
  className?: string;
}

export function AuthError({ children, className = '' }: AuthErrorProps) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300 backdrop-blur-sm ${className}`}
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
