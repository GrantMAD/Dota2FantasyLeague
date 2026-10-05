'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, BookOpen, Lightbulb, Play, TriangleAlert, X } from 'lucide-react';
import { useTour } from '@/context/TourContext';
import { getPageGuide } from '@/lib/pageGuides';
import { getPageTour } from '@/lib/tourSteps';
import { useTheme } from '@/components/theme/ThemeProvider';

export function PageGuideModal() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const { isGuideOpen, openGuide, closeGuide, startTour } = useTour();
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const pageGuide = getPageGuide(pathname);
  const pageTour = getPageTour(pathname);
  const pageTitle = pageTour?.pageTitle ?? (pathname === '/guide' ? 'Interactive Guide Directory' : pathname === '/learn' ? 'Learn Hub' : 'Page guide');
  const dark = theme === 'dark';

  useEffect(() => {
    if (searchParams.get('guide') !== '1') return;
    openGuide();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('guide');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [openGuide, pathname, router, searchParams]);

  useEffect(() => {
    if (!isGuideOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeGuide();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('hidden'));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    };
  }, [closeGuide, isGuideOpen]);

  if (!isGuideOpen || !pageGuide) return null;

  const panelClass = dark
    ? 'border-slate-700 bg-slate-900 text-white'
    : 'border-slate-200 bg-white text-slate-900';
  const secondaryTextClass = dark ? 'text-slate-300' : 'text-slate-600';
  const cardClass = dark
    ? 'border-slate-700 bg-slate-950/60'
    : 'border-slate-200 bg-slate-50';

  return (
    <div
      className="fixed inset-0 z-130 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeGuide();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-guide-title"
        aria-describedby="page-guide-overview"
        tabIndex={-1}
        className={`flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:max-h-[min(88dvh,900px)] sm:rounded-3xl ${panelClass}`}
      >
        <header className={`flex items-start justify-between gap-4 border-b p-5 sm:p-7 ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${dark ? 'bg-cyan-400/10 text-cyan-300' : 'bg-cyan-50 text-cyan-800'}`}>
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.2em] ${dark ? 'text-cyan-300' : 'text-cyan-800'}`}>Page guide</p>
              <h2 id="page-guide-title" className="mt-1 text-xl font-bold sm:text-2xl">{pageTitle}</h2>
              <p id="page-guide-overview" className={`mt-2 max-w-2xl text-sm leading-6 ${secondaryTextClass}`}>{pageGuide.overview}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeGuide}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${dark ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            aria-label="Close page guide"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-7">
          <section aria-labelledby="page-guide-steps-title">
            <h3 id="page-guide-steps-title" className="text-base font-bold">How to use this page</h3>
            <ol className="mt-4 space-y-3">
              {pageGuide.steps.map((step, index) => (
                <li key={step} className={`flex gap-3 rounded-xl border p-4 ${cardClass}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${dark ? 'bg-cyan-400/15 text-cyan-200' : 'bg-cyan-100 text-cyan-900'}`}>
                    {index + 1}
                  </span>
                  <p className={`pt-0.5 text-sm leading-6 ${secondaryTextClass}`}>{step}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className={`mt-6 rounded-xl border p-4 sm:p-5 ${dark ? 'border-amber-400/25 bg-amber-400/5' : 'border-amber-300 bg-amber-50'}`} aria-labelledby="page-guide-impact-title">
            <h3 id="page-guide-impact-title" className={`flex items-center gap-2 text-sm font-bold ${dark ? 'text-amber-200' : 'text-amber-900'}`}>
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
              What your actions affect
            </h3>
            <p className={`mt-2 text-sm leading-6 ${dark ? 'text-amber-100/80' : 'text-amber-950/80'}`}>{pageGuide.implications}</p>
          </section>

          <section className="mt-6" aria-labelledby="page-guide-tips-title">
            <h3 id="page-guide-tips-title" className="flex items-center gap-2 text-base font-bold">
              <Lightbulb className={`h-4 w-4 ${dark ? 'text-cyan-300' : 'text-cyan-800'}`} aria-hidden="true" />
              Helpful tips
            </h3>
            <ul className={`mt-3 list-inside list-disc space-y-2 text-sm leading-6 ${secondaryTextClass}`}>
              {pageGuide.tips.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </section>

          <section className="mt-6" aria-labelledby="page-guide-related-title">
            <h3 id="page-guide-related-title" className="text-base font-bold">Related pages</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {pageGuide.related.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeGuide}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${dark ? 'border-slate-700 text-cyan-200 hover:border-cyan-400/50 hover:bg-slate-800' : 'border-slate-300 text-cyan-900 hover:border-cyan-600 hover:bg-cyan-50'}`}
                >
                  {link.label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        </div>

        <footer className={`flex flex-col-reverse gap-3 border-t p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 ${dark ? 'border-slate-700' : 'border-slate-200'}`}>
          <p className={`text-xs ${secondaryTextClass}`}>You can reopen this guide at any time with the help icon.</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeGuide}
              className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${dark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
            >
              Close
            </button>
            {pageTour && (
              <button
                type="button"
                onClick={startTour}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                Start page tour
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
