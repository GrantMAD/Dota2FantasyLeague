'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // 0 means persistent (e.g. for loading toasts)
}

interface ToastContextValue {
  toasts: Toast[];
  exitingToastIds: ReadonlySet<string>;
  toast: {
    success: (title: string, message?: string, duration?: number) => string;
    error: (title: string, message?: string, duration?: number) => string;
    info: (title: string, message?: string, duration?: number) => string;
    loading: (title: string, message?: string) => string;
    dismiss: (id: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [exitingToastIds, setExitingToastIds] = useState<Set<string>>(new Set());
  const exitingToastIdsRef = useRef(new Set<string>());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const exitTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timeoutsRef.current.get(id);
    if (timer) clearTimeout(timer);
    timeoutsRef.current.delete(id);

    if (exitingToastIdsRef.current.has(id)) return;
    exitingToastIdsRef.current.add(id);
    setExitingToastIds((current) => new Set(current).add(id));

    const exitTimer = setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      setExitingToastIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      exitingToastIdsRef.current.delete(id);
      exitTimeoutsRef.current.delete(id);
    }, 180);
    exitTimeoutsRef.current.set(id, exitTimer);
  }, []);

  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
    exitTimeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
    exitTimeoutsRef.current.clear();
  }, []);

  const addToast = useCallback(
    (type: ToastType, title: string, message?: string, duration?: number): string => {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 9);

      const toastDuration = duration !== undefined ? duration : (type === 'loading' ? 0 : DEFAULT_DURATION);
      const newToast: Toast = { id, type, title, message, duration: toastDuration };

      setToasts((current) => [newToast, ...current].slice(0, 3));

      if (toastDuration > 0) {
        const timer = setTimeout(() => {
          timeoutsRef.current.delete(id);
          dismiss(id);
        }, toastDuration);
        timeoutsRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  const success = useCallback((title: string, message?: string, duration?: number) => {
    return addToast('success', title, message, duration);
  }, [addToast]);

  const error = useCallback((title: string, message?: string, duration?: number) => {
    return addToast('error', title, message, duration);
  }, [addToast]);

  const info = useCallback((title: string, message?: string, duration?: number) => {
    return addToast('info', title, message, duration);
  }, [addToast]);

  const loading = useCallback((title: string, message?: string) => {
    return addToast('loading', title, message, 0);
  }, [addToast]);

  const value: ToastContextValue = {
    toasts,
    exitingToastIds,
    toast: {
      success,
      error,
      info,
      loading,
      dismiss,
    },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
}

export function useToastState() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastState must be used within a ToastProvider');
  }
  return context;
}
