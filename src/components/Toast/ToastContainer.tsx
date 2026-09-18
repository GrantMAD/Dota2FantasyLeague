'use client';

import React from 'react';
import { useToastState } from './ToastContext';
import { ToastItem } from './ToastItem';

export function ToastContainer() {
  const { toasts } = useToastState();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto animate-toast-in">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
