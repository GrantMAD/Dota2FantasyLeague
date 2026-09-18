'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Info, Loader2, X } from 'lucide-react';
import { Toast, useToast } from './ToastContext';

interface ToastItemProps {
  toast: Toast;
}

export function ToastItem({ toast }: ToastItemProps) {
  const { dismiss } = useToast();
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  const duration = toast.duration ?? 4000;

  useEffect(() => {
    if (duration <= 0) return;

    const interval = 20; // 50fps
    const decrement = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - decrement;
        return next <= 0 ? 0 : next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      dismiss(toast.id);
    }, 150);
  };

  const getThemeConfig = () => {
    switch (toast.type) {
      case 'success':
        return {
          stripClass: 'bg-teal-500',
          icon: <CheckCircle className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />,
          progressClass: 'bg-teal-500/80',
        };
      case 'error':
        return {
          stripClass: 'bg-red-500',
          icon: <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />,
          progressClass: 'bg-red-500/80',
        };
      case 'loading':
        return {
          stripClass: 'bg-amber-500',
          icon: <Loader2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-spin" />,
          progressClass: 'bg-amber-500/80',
        };
      case 'info':
      default:
        return {
          stripClass: 'bg-amber-500',
          icon: <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
          progressClass: 'bg-amber-500/80',
        };
    }
  };

  const config = getThemeConfig();

  return (
    <div
      role="alert"
      className={`relative flex flex-col w-84 max-w-sm rounded-xl border border-slate-700 bg-slate-800 shadow-2xl overflow-hidden transition-all duration-200 ease-out transform ${
        isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
      }`}
    >
      <div className="flex items-start gap-3 p-3.5 pr-2">
        {/* Left accent strip */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.stripClass}`} />

        {/* Status Icon */}
        <div className="pl-1.5">{config.icon}</div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-2">
          <h4 className="text-sm font-semibold text-white truncate leading-tight">
            {toast.title}
          </h4>
          {toast.message && (
            <p className="text-xs text-slate-400 mt-1 leading-normal break-words">
              {toast.message}
            </p>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          type="button"
          aria-label="Dismiss notification"
          className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar (only if duration > 0) */}
      {duration > 0 && (
        <div className="h-0.5 w-full bg-slate-700/50 overflow-hidden">
          <div
            className={`h-full ${config.progressClass} transition-all duration-75 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
