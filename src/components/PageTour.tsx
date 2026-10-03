'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useTour } from '@/context/TourContext';
import { getPageTour } from '@/lib/tourSteps';

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function PageTour() {
  const pathname = usePathname();
  const { isOpen, closeTour, stepIndex, setStepIndex, markCompleted } = useTour();
  const pageTour = useMemo(() => getPageTour(pathname), [pathname]);
  const [target, setTarget] = useState<TargetRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const currentStep = pageTour?.steps[Math.min(stepIndex, (pageTour.steps.length || 1) - 1)] ?? null;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen || !pageTour || !currentStep) return;

    const selector = `[data-tour="${currentStep.targetKey}"]`;
    const targetElement = document.querySelector<HTMLElement>(selector);

    const activateTarget = () => {
      document.querySelectorAll('[data-tour-active="true"]').forEach((node) => {
        node.removeAttribute('data-tour-active');
      });

      if (targetElement) {
        targetElement.setAttribute('data-tour-active', 'true');
        targetElement.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    };

    const measureTarget = () => {
      if (!targetElement) return;
      const rect = targetElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setTarget({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    activateTarget();
    measureTarget();

    const resizeObserver = new ResizeObserver(() => measureTarget());
    if (targetElement) {
      resizeObserver.observe(targetElement);
    }

    const onScroll = () => measureTarget();
    window.addEventListener('scroll', onScroll, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', onScroll, true);
      document.querySelectorAll('[data-tour-active="true"]').forEach((node) => {
        node.removeAttribute('data-tour-active');
      });
    };
  }, [currentStep, isOpen, pageTour]);

  if (!isOpen || !pageTour || !currentStep) return null;

  const isLastStep = stepIndex >= pageTour.steps.length - 1;

  const nextStep = () => {
    if (isLastStep) {
      markCompleted();
      closeTour();
      return;
    }

    setStepIndex(stepIndex + 1);
  };

  const previousStep = () => {
    if (stepIndex === 0) return;
    setStepIndex(stepIndex - 1);
  };

  const skipTour = () => {
    markCompleted();
    closeTour();
  };

  const cardWidth = 360;
  const cardHeight = 220;

  let tooltipStyle: { top?: number; left?: number; right?: number; bottom?: number } = {
    top: 50,
    left: 50,
  };

  if (target && !isMobile && typeof window !== 'undefined') {
    const spaceBelow = window.innerHeight - (target.top + target.height);
    const spaceAbove = target.top;

    let nextTop = 0;
    if (spaceBelow >= cardHeight + 24 || spaceBelow >= spaceAbove) {
      nextTop = target.top + target.height + 18;
    } else {
      nextTop = target.top - cardHeight - 18;
    }

    const idealLeft = target.left + target.width / 2 - cardWidth / 2;
    const clampedLeft = clamp(idealLeft, 16, window.innerWidth - cardWidth - 16);

    tooltipStyle = {
      top: clamp(nextTop, 16, window.innerHeight - cardHeight - 16),
      left: clampedLeft,
    };
  }

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-130 pointer-events-none" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <div className="absolute inset-0 bg-slate-950/10" />
        <div className="absolute inset-x-0 bottom-0 z-131 rounded-t-3xl border border-cyan-400/30 bg-slate-900/95 p-5 shadow-[0_-20px_50px_rgba(34,211,238,0.12)] backdrop-blur-md pointer-events-auto">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-600/80" />
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">{pageTour.pageTitle.toUpperCase()} · STEP {stepIndex + 1} OF {pageTour.steps.length}</p>
            </div>
            <button type="button" onClick={skipTour} className="rounded-full border border-slate-700 p-1.5 text-slate-400 transition hover:border-slate-500 hover:text-white" aria-label="Close tour">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 flex h-2 overflow-hidden rounded-full bg-slate-800">
            {pageTour.steps.map((_, index) => (
              <div
                key={index}
                className={`h-full ${index <= stepIndex ? 'bg-cyan-400' : 'bg-slate-700'} ${index === 0 ? 'rounded-l-full' : ''} ${index === pageTour.steps.length - 1 ? 'rounded-r-full' : ''}`}
                style={{ width: `${100 / pageTour.steps.length}%` }}
              />
            ))}
          </div>

          <div className="mb-3">
            <h2 id="tour-title" className="text-xl font-bold text-white">{currentStep.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{currentStep.body}</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={skipTour} className="text-sm font-medium text-slate-300 transition hover:text-white">Skip tour</button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={previousStep} disabled={stepIndex === 0} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50">
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button type="button" onClick={nextStep} className="inline-flex items-center gap-1 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
                {isLastStep ? 'Finish' : 'Next'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-120" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {target && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <mask id="tour-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect x={target.left - 16} y={target.top - 16} width={target.width + 32} height={target.height + 32} rx={22} fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(2,6,23,0.72)" mask="url(#tour-spotlight-mask)" />
        </svg>
      )}

      <div className="fixed z-121 w-[min(360px,calc(100vw-32px))] rounded-2xl border border-cyan-400/50 bg-slate-900/95 p-5 shadow-[0_20px_60px_rgba(34,211,238,0.2)] backdrop-blur-md" style={tooltipStyle}>
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">{pageTour.pageTitle.toUpperCase()} · STEP {stepIndex + 1} OF {pageTour.steps.length}</p>
            <h2 id="tour-title" className="text-lg font-bold text-white">{currentStep.title}</h2>
          </div>
          <button type="button" onClick={skipTour} className="rounded-full border border-slate-700 p-1.5 text-slate-400 transition hover:border-slate-500 hover:text-white" aria-label="Close tour">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex h-2 overflow-hidden rounded-full bg-slate-800">
          {pageTour.steps.map((_, index) => (
            <div
              key={index}
              className={`h-full ${index <= stepIndex ? 'bg-cyan-400' : 'bg-slate-700'} ${index === 0 ? 'rounded-l-full' : ''} ${index === pageTour.steps.length - 1 ? 'rounded-r-full' : ''}`}
              style={{ width: `${100 / pageTour.steps.length}%` }}
            />
          ))}
        </div>

        <div className="mb-5">
          <p className="text-sm leading-relaxed text-slate-300">{currentStep.body}</p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={skipTour} className="text-sm font-medium text-slate-300 transition hover:text-white">Skip tour</button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={previousStep} disabled={stepIndex === 0} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button type="button" onClick={nextStep} className="inline-flex items-center gap-1 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
              {isLastStep ? 'Finish' : 'Next'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
